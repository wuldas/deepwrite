import {
  WEB_SERVICE_HTTP_PREFIX,
  WebServiceInvokeRequestSchema,
  WebServiceInvokeResponseSchema
} from "@deepwrite/contracts";
import type { DeepWriteTransport } from "./invoke";

/**
 * Resolve a web-service endpoint against the document base.
 *
 * The renderer may be served from a sub-path (for example behind a reverse
 * proxy at /p/<key>/), so endpoints must follow the document base instead of
 * the site root. `document.baseURI` honours a <base href> injected by the
 * proxy, and falls back to the page URL for root deployments.
 */
function webServiceEndpoint(suffix: string): string {
  const prefix = WEB_SERVICE_HTTP_PREFIX.replace(/^\/+/, "").replace(/\/+$/, "");
  let basePath = "/";
  try {
    basePath = new URL(document.baseURI ?? window.location.href).pathname;
  } catch {
    basePath = window.location.pathname;
  }
  if (!basePath.endsWith("/")) {
    basePath = `${basePath.slice(0, basePath.lastIndexOf("/") + 1)}`;
  }
  return `${basePath}${prefix}${suffix}`;
}

/**
 * Browser transport for the DeepWrite API: invoke channels over HTTP POST and
 * receive main-process events through a shared SSE stream.
 */
export function createWebTransport(): DeepWriteTransport {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let source: EventSource | null = null;

  function ensureEventSource(): EventSource {
    if (source) return source;
    source = new EventSource(webServiceEndpoint("/events"));
    source.onmessage = (message: MessageEvent<string>) => {
      let frame: { channel?: unknown; payload?: unknown };
      try {
        frame = JSON.parse(message.data);
      } catch {
        return;
      }
      if (typeof frame.channel !== "string") return;
      const channelListeners = listeners.get(frame.channel);
      if (!channelListeners) return;
      for (const listener of channelListeners) listener(frame.payload);
    };
    return source;
  }

  return {
    async invokeChannel(channel, payload) {
      const request = WebServiceInvokeRequestSchema.parse({ channel, payload });
      const response = await fetch(webServiceEndpoint("/ipc"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request)
      });
      const parsed = WebServiceInvokeResponseSchema.parse(
        await response.json()
      );
      if (!parsed.ok) {
        throw new Error(
          parsed.error
            ? `${parsed.error.code}: ${parsed.error.message}`
            : "DeepWrite web invoke failed."
        );
      }
      return parsed.value;
    },
    onChannelEvent(channel, listener) {
      ensureEventSource();
      let channelListeners = listeners.get(channel);
      if (!channelListeners) {
        channelListeners = new Set();
        listeners.set(channel, channelListeners);
      }
      channelListeners.add(listener);
      return () => {
        const current = listeners.get(channel);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) listeners.delete(channel);
      };
    }
  };
}
