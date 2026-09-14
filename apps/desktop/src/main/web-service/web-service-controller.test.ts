import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  IPC_COMMAND_CHANNEL,
  createEnvelope,
  type CommandResult,
  type WebServiceSettings
} from "@deepwrite/contracts";
import { WebServiceController } from "./web-service-controller";

async function freePort(): Promise<number> {
  const probe = createServer();
  const listening = Promise.withResolvers<void>();
  probe.listen(0, "127.0.0.1", () => listening.resolve());
  await listening.promise;
  const port = (probe.address() as AddressInfo).port;
  const closed = Promise.withResolvers<void>();
  probe.close(() => closed.resolve());
  await closed.promise;
  return port;
}

function settings(port: number, enabled = true): WebServiceSettings {
  return { enabled, port };
}

function baseUrl(controller: WebServiceController): string {
  const status = controller.status();
  if (!status.running || !status.url) {
    throw new Error("web service is not running");
  }
  return status.url;
}

describe("WebServiceController", () => {
  let controller: WebServiceController;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-web-"));
    await mkdir(join(root, "assets"));
    await writeFile(
      join(root, "index.html"),
      `<!doctype html><html><head><title>DeepWrite</title>` +
        `<script type="module" src="/assets/app.js"></script></head>` +
        `<body><div id="app"></div></body></html>`
    );
    await writeFile(join(root, "deepwrite-web.js"), "window.__bridge = true;");
    await writeFile(join(root, "assets", "app.js"), "console.log('app');");
    await writeFile(join(root, "..", "deepwrite-outside.txt"), "outside");
    controller = new WebServiceController({
      rendererRoot: root,
      webEntryDevUrl: "/@fs/dev/web-entry.ts",
      proxyTarget: () => null
    });
    controller.setCommandInvoker(async (rawCommand) => {
      const result: CommandResult = {
        status: "accepted",
        requestId: (rawCommand as { id: string }).id,
        payload: { echoed: true }
      };
      return result;
    });
    controller.registerInvokeChannel("deepwrite:test", (payload) => ({
      received: payload
    }));
    await controller.reconcile(settings(await freePort()));
  });

  afterAll(async () => {
    await controller.stop();
  });

  it("reports health on the loopback service", async () => {
    const response = await fetch(`${baseUrl(controller)}deepwrite/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "deepwrite-web"
    });
  });

  it("injects the web bridge script into the served index.html", async () => {
    const response = await fetch(baseUrl(controller));
    const html = await response.text();
    const bridgeAt = html.indexOf('src="/deepwrite-web.js"');
    const appAt = html.indexOf('src="/assets/app.js"');
    expect(bridgeAt).toBeGreaterThan(-1);
    expect(appAt).toBeGreaterThan(bridgeAt);
  });

  it("serves the built web bridge entry", async () => {
    const response = await fetch(`${baseUrl(controller)}deepwrite-web.js`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("window.__bridge");
  });

  it("serves renderer assets from the build directory", async () => {
    const response = await fetch(`${baseUrl(controller)}assets/app.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
  });

  it("rejects path traversal outside the renderer root", async () => {
    const response = await fetch(
      `${baseUrl(controller)}%2e%2e/deepwrite-outside.txt`
    );
    expect(response.status).toBe(404);
  });

  it("forwards envelope commands to the main-process invoker", async () => {
    const command = createEnvelope(
      "system.health",
      {},
      {
        id: "cmd_web_test_health"
      }
    );
    const response = await fetch(`${baseUrl(controller)}deepwrite/ipc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: IPC_COMMAND_CHANNEL, payload: command })
    });
    const body = (await response.json()) as {
      ok: boolean;
      value: CommandResult;
    };
    expect(body.ok).toBe(true);
    expect(body.value.status).toBe("accepted");
    expect(body.value.requestId).toBe(command.id);
  });

  it("invokes whitelisted non-envelope channels", async () => {
    const response = await fetch(`${baseUrl(controller)}deepwrite/ipc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "deepwrite:test",
        payload: { hello: 1 }
      })
    });
    const body = (await response.json()) as {
      ok: boolean;
      value: { received: { hello: number } };
    };
    expect(body.value.received.hello).toBe(1);
  });

  it("rejects unsupported methods on web endpoints", async () => {
    const response = await fetch(`${baseUrl(controller)}deepwrite/health`, {
      method: "POST"
    });
    expect(response.status).toBe(405);
  });

  it("rejects unknown channels and malformed bodies", async () => {
    const unknown = await fetch(`${baseUrl(controller)}deepwrite/ipc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "deepwrite:nope", payload: {} })
    });
    expect(unknown.status).toBe(404);
    const malformed = await fetch(`${baseUrl(controller)}deepwrite/ipc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json"
    });
    expect(malformed.status).toBe(400);
  });

  it("streams published events to SSE clients", async () => {
    const sseAbort = new AbortController();
    const response = await fetch(`${baseUrl(controller)}deepwrite/events`, {
      signal: sseAbort.signal
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const readFrame = async (): Promise<string> => {
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("\n\n")) return buffer;
      }
      return buffer;
    };
    const connected = await readFrame();
    expect(connected).toContain(": connected");
    controller.publishEvent(IPC_COMMAND_CHANNEL, { hello: "event" });
    const frame = await readFrame();
    expect(frame).toContain('"channel"');
    expect(frame).toContain('"hello"');
    sseAbort.abort();
  });

  it("stops and restarts with the settings reconcile loop", async () => {
    await controller.reconcile(settings(0, false));
    expect(controller.status().running).toBe(false);
    const port = await freePort();
    await controller.reconcile(settings(port));
    expect(controller.status().running).toBe(true);
    expect(controller.status().url).toBe(`http://127.0.0.1:${port}/`);
  });

  it("reports a friendly error when the port is occupied", async () => {
    const occupied = await freePort();
    const blocker = createServer();
    const listening = Promise.withResolvers<void>();
    blocker.listen(occupied, "127.0.0.1", () => listening.resolve());
    await listening.promise;
    try {
      await controller.reconcile(settings(occupied));
      expect(controller.status().running).toBe(false);
      expect(controller.status().error).toContain("端口");
    } finally {
      const closed = Promise.withResolvers<void>();
      blocker.close(() => closed.resolve());
      await closed.promise;
    }
  });

  it("finishes an invoke response when the handler stops the server", async () => {
    const port = await freePort();
    await controller.reconcile(settings(port));
    controller.registerInvokeChannel("deepwrite:stop", async () => {
      await controller.stop();
      return { stopped: true };
    });
    const response = await fetch(`http://127.0.0.1:${port}/deepwrite/ipc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "deepwrite:stop", payload: {} })
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      value: { stopped: true }
    });
  });
});
