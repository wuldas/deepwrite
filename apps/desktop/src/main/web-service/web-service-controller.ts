import { createServer, type IncomingMessage, type Server } from "node:http";
import type { ServerResponse } from "node:http";
import {
  IPC_COMMAND_CHANNEL,
  WebServiceInvokeRequestSchema,
  WebServiceStatusSchema,
  WEB_SERVICE_HTTP_PREFIX,
  type CommandResult,
  type WebServiceSettings,
  type WebServiceStatus
} from "@deepwrite/contracts";
import { WebStaticAssets } from "./web-static-assets";

const MAX_REQUEST_BODY_BYTES = 64 * 1024 * 1024;
const SSE_HEARTBEAT_MS = 25_000;

export interface WebServiceControllerOptions {
  rendererRoot: string;
  webEntryDevUrl: string;
  proxyTarget: () => string | null;
  host?: string;
  publicHost?: string;
}

function describeListenError(port: number, error: unknown): string {
  if (
    error instanceof Error &&
    "code" in error &&
    error.code === "EADDRINUSE"
  ) {
    return `端口 ${port} 已被占用，请更换端口后重试。`;
  }
  return error instanceof Error ? error.message : "Web 服务启动失败。";
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  if (response.writableEnded) return;
  if (response.headersSent) {
    response.end();
    return;
  }
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload)
  });
  response.end(payload);
}

/**
 * Loopback web service: serves the renderer UI over HTTP, forwards envelope
 * commands and whitelisted invoke channels into the existing main-process
 * handlers, and streams system events to browser clients over SSE.
 */
export class WebServiceController {
  private readonly assets: WebStaticAssets;
  private readonly proxyTarget: () => string | null;
  private readonly host: string;
  private readonly publicHost: string;
  private readonly sseClients = new Set<ServerResponse>();
  private readonly channelHandlers = new Map<
    string,
    (payload: unknown) => unknown | Promise<unknown>
  >();
  private commandInvoker:
    ((rawCommand: unknown) => Promise<CommandResult>) | null = null;
  private server: Server | null = null;
  private activeRequests = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private listeningPort: number | null = null;
  private statusValue: WebServiceStatus = WebServiceStatusSchema.parse({
    running: false,
    url: null,
    error: null
  });

  constructor(options: WebServiceControllerOptions) {
    this.assets = new WebStaticAssets({
      rendererRoot: options.rendererRoot,
      webEntryDevUrl: options.webEntryDevUrl
    });
    this.proxyTarget = options.proxyTarget;
    this.host = options.host ?? "127.0.0.1";
    this.publicHost =
      options.publicHost ?? (this.host === "0.0.0.0" ? "localhost" : this.host);

  }
  status(): WebServiceStatus {
    return this.statusValue;
  }

  setCommandInvoker(
    invoker: (rawCommand: unknown) => Promise<CommandResult>
  ): void {
    this.commandInvoker = invoker;
  }

  registerInvokeChannel(
    channel: string,
    handler: (payload: unknown) => unknown | Promise<unknown>
  ): void {
    this.channelHandlers.set(channel, handler);
  }

  publishEvent(channel: string, payload: unknown): void {
    if (this.sseClients.size === 0) return;
    const frame = `data: ${JSON.stringify({ channel, payload })}\n\n`;
    for (const client of this.sseClients) {
      if (client.writableEnded || client.destroyed) {
        this.sseClients.delete(client);
        continue;
      }
      client.write(frame);
    }
  }

  async reconcile(settings: WebServiceSettings): Promise<void> {
    if (!settings.enabled) {
      await this.stop();
      return;
    }
    if (this.server && this.listeningPort === settings.port) return;
    await this.stop();
    await this.listen(settings.port);
  }

  async stop(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    for (const client of this.sseClients) {
      if (!client.writableEnded) client.end();
    }
    this.sseClients.clear();
    const server = this.server;
    this.server = null;
    this.listeningPort = null;
    if (server) {
      const closed = Promise.withResolvers<void>();
      server.close(() => closed.resolve());
      if (this.activeRequests === 0) await closed.promise;
    }
    this.statusValue = WebServiceStatusSchema.parse({
      running: false,
      url: null,
      error: null
    });
  }

  private async listen(port: number): Promise<void> {
    const server = createServer((request, response) => {
      this.activeRequests += 1;
      void this.handleRequest(request, response)
        .catch(() => {
          sendJson(response, 500, {
            ok: false,
            error: {
              code: "web.request_failed",
              message: "Web 请求处理失败。"
            }
          });
        })
        .finally(() => {
          this.activeRequests -= 1;
        });
    });
    const listening = Promise.withResolvers<void>();
    server.once("error", listening.reject);
    server.listen(port, this.host, () => listening.resolve());
    try {
      await listening.promise;
    } catch (error: unknown) {
      this.statusValue = WebServiceStatusSchema.parse({
        running: false,
        url: null,
        error: describeListenError(port, error)
      });
      return;
    }
    this.server = server;
    this.listeningPort = port;
    this.statusValue = WebServiceStatusSchema.parse({
      running: true,
      url: `http://${this.publicHost}:${port}/`,
      error: null
    });
    this.heartbeat = setInterval(() => {
      for (const client of this.sseClients) {
        if (!client.writableEnded && !client.destroyed) {
          client.write(": ping\n\n");
        }
      }
    }, SSE_HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (
      url.pathname === `${WEB_SERVICE_HTTP_PREFIX}/health` &&
      request.method === "GET"
    ) {
      sendJson(response, 200, { ok: true, service: "deepwrite-web" });
      return;
    }
    if (
      url.pathname === `${WEB_SERVICE_HTTP_PREFIX}/events` &&
      request.method === "GET"
    ) {
      this.handleEventStream(response);
      return;
    }
    if (url.pathname === `${WEB_SERVICE_HTTP_PREFIX}/ipc`) {
      if (request.method !== "POST") {
        sendJson(response, 405, {
          ok: false,
          error: { code: "web.method_not_allowed", message: "请使用 POST。" }
        });
        return;
      }
      await this.handleInvoke(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, {
        ok: false,
        error: { code: "web.method_not_allowed", message: "仅支持 GET/POST。" }
      });
      return;
    }
    try {
      const devTarget = this.proxyTarget();
      if (devTarget) {
        await this.assets.proxyHtml(
          url.pathname,
          url.search,
          response,
          devTarget
        );
        return;
      }
      const handled = await this.assets.handle(url.pathname, response);
      if (!handled) {
        sendJson(response, 404, {
          ok: false,
          error: { code: "web.not_found", message: "资源不存在。" }
        });
      }
    } catch {
      sendJson(response, 500, {
        ok: false,
        error: { code: "web.renderer_failed", message: "渲染层资源读取失败。" }
      });
    }
  }
  private handleEventStream(response: ServerResponse): void {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive"
    });
    response.write(": connected\n\n");
    this.sseClients.add(response);
    response.on("close", () => {
      this.sseClients.delete(response);
    });
  }

  private async readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        throw new Error("payload_too_large");
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks, totalBytes).toString("utf8");
  }

  private async handleInvoke(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    let rawBody: string;
    try {
      rawBody = await this.readBody(request);
    } catch (error: unknown) {
      const tooLarge =
        error instanceof Error && error.message === "payload_too_large";
      sendJson(response, tooLarge ? 413 : 400, {
        ok: false,
        error: {
          code: tooLarge ? "web.payload_too_large" : "web.invalid_request",
          message: tooLarge ? "请求体过大。" : "无法读取请求体。"
        }
      });
      return;
    }
    let requestBody: unknown = {};
    if (rawBody) {
      try {
        requestBody = JSON.parse(rawBody);
      } catch {
        sendJson(response, 400, {
          ok: false,
          error: {
            code: "web.invalid_request",
            message: "请求体不是合法 JSON。"
          }
        });
        return;
      }
    }
    const parsed = WebServiceInvokeRequestSchema.safeParse(requestBody);
    if (!parsed.success) {
      sendJson(response, 400, {
        ok: false,
        error: {
          code: "web.invalid_request",
          message: "请求体必须包含 channel 字段。"
        }
      });
      return;
    }
    const { channel, payload } = parsed.data;
    try {
      if (channel === IPC_COMMAND_CHANNEL) {
        if (!this.commandInvoker) {
          sendJson(response, 503, {
            ok: false,
            error: { code: "web.not_ready", message: "命令通道尚未就绪。" }
          });
          return;
        }
        sendJson(response, 200, {
          ok: true,
          value: await this.commandInvoker(payload),
          error: null
        });
        return;
      }
      const handler = this.channelHandlers.get(channel);
      if (!handler) {
        sendJson(response, 404, {
          ok: false,
          error: {
            code: "web.unknown_channel",
            message: `未知通道 ${channel}。`
          }
        });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        value: await handler(payload),
        error: null
      });
    } catch (error: unknown) {
      sendJson(response, 200, {
        ok: false,
        error: {
          code: "web.channel_failed",
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
}
