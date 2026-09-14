import { createReadStream, type Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export const WEB_ENTRY_BUILT_URL = "/deepwrite-web.js";

export function injectWebEntryScript(html: string, scriptUrl: string): string {
  const injected = `<script type="module" src="${scriptUrl}"></script>`;
  const scriptMatch = html.match(/<script\b[^>]*>/);
  if (scriptMatch?.index !== undefined) {
    const at = scriptMatch.index;
    return `${html.slice(0, at)}${injected}${html.slice(at)}`;
  }
  const headMatch = html.match(/<\/head>/i);
  if (headMatch?.index !== undefined) {
    const at = headMatch.index;
    return `${html.slice(0, at)}${injected}${html.slice(at)}`;
  }
  return `${html}${injected}`;
}

export interface WebStaticAssetsOptions {
  rendererRoot: string;
  webEntryDevUrl: string;
}

/**
 * Serves the built renderer assets (or proxies the dev server) and injects
 * the `window.deepwrite` web bridge script into every HTML response.
 */
export class WebStaticAssets {
  private readonly rendererRoot: string;
  private readonly webEntryDevUrl: string;

  constructor(options: WebStaticAssetsOptions) {
    this.rendererRoot = resolve(options.rendererRoot);
    this.webEntryDevUrl = options.webEntryDevUrl;
  }

  async handle(pathname: string, response: ServerResponse): Promise<boolean> {
    if (pathname === WEB_ENTRY_BUILT_URL) {
      return this.serveFile(
        join(this.rendererRoot, "deepwrite-web.js"),
        response
      );
    }
    const candidate = this.resolveRendererPath(pathname);
    if (candidate && (await this.serveFile(candidate, response))) {
      return true;
    }
    if (extname(pathname) !== "" && pathname !== "/") {
      return false;
    }
    await this.serveIndex(response);
    return true;
  }

  private resolveRendererPath(pathname: string): string | null {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname).replace(/^\/+/, "");
    } catch {
      return null;
    }
    if (!decoded) return null;
    const candidate = resolve(this.rendererRoot, decoded);
    if (
      candidate !== this.rendererRoot &&
      !candidate.startsWith(this.rendererRoot + sep)
    ) {
      return null;
    }
    return candidate;
  }

  private async serveIndex(response: ServerResponse): Promise<void> {
    const html = await readFile(join(this.rendererRoot, "index.html"), "utf8");
    this.respondHtml(response, injectWebEntryScript(html, WEB_ENTRY_BUILT_URL));
  }

  private respondHtml(response: ServerResponse, html: string): void {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(html)
    });
    response.end(html);
  }

  private async serveFile(
    filePath: string,
    response: ServerResponse
  ): Promise<boolean> {
    let fileStat: Stats;
    try {
      fileStat = await stat(filePath);
      if (!fileStat.isFile()) return false;
    } catch {
      return false;
    }
    response.writeHead(200, {
      "content-type":
        CONTENT_TYPES[extname(filePath).toLowerCase()] ??
        "application/octet-stream",
      "content-length": fileStat.size,
      "cache-control": "no-store"
    });
    if (response.req?.method === "HEAD") {
      response.end();
      return true;
    }
    const finished = Promise.withResolvers<void>();
    createReadStream(filePath)
      .pipe(response)
      .on("finish", () => finished.resolve())
      .on("error", () => {
        response.destroy();
        finished.resolve();
      });
    await finished.promise;
    return true;
  }

  async proxyHtml(
    pathname: string,
    search: string,
    response: ServerResponse,
    proxyTarget: string
  ): Promise<boolean> {
    let upstream: Response;
    try {
      upstream = await fetch(`${proxyTarget}${pathname}${search}`, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/javascript,*/*"
        }
      });
    } catch {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end("DeepWrite web 模式无法连接渲染层开发服务器。");
      return true;
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      const html = await upstream.text();
      this.respondHtml(
        response,
        injectWebEntryScript(html, encodeURI(this.webEntryDevUrl))
      );
      return true;
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "content-type": contentType || "application/octet-stream",
      "content-length": buffer.byteLength,
      "cache-control": "no-store"
    });
    response.end(buffer);
    return true;
  }
}
