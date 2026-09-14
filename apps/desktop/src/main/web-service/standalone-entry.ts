import { homedir } from "node:os";
import { join, resolve } from "node:path";
import packageMetadata from "../../../../../package.json";
import { StandaloneWebServiceRuntime } from "./standalone-runtime";

const DEFAULT_WEB_PORT = 8742;

export interface StandaloneCliOptions {
  port: number;
  userDataPath: string;
  workspaceDirectory: string | undefined;
  help: boolean;
}

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("--port must be an integer between 1024 and 65535.");
  }
  return port;
}

function configuredDataPath(): string {
  const configured =
    process.env.DEEPWRITE_WEB_DATA_DIR?.trim() ||
    process.env.DEEPWRITE_USER_DATA_PATH?.trim();
  if (configured) return resolve(configured);
  if (process.platform === "win32" && process.env.APPDATA) {
    return join(process.env.APPDATA, "DeepWrite Web");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "DeepWrite Web");
  }
  return join(
    process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config"),
    "deepwrite-web"
  );
}

export function parseStandaloneCliArgs(
  args: readonly string[]
): StandaloneCliOptions {
  let port = DEFAULT_WEB_PORT;
  let userDataPath = configuredDataPath();
  let workspaceDirectory = process.env.DEEPWRITE_WORKSPACE_DIRECTORY?.trim();
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }
    if (arg === "--port") {
      const value = args[index + 1];
      if (!value) throw new Error("--port requires a value.");
      port = parsePort(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--data-dir=")) {
      userDataPath = resolve(arg.slice("--data-dir=".length));
      continue;
    }
    if (arg === "--data-dir") {
      const value = args[index + 1];
      if (!value) throw new Error("--data-dir requires a value.");
      userDataPath = resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--workspace-dir=")) {
      workspaceDirectory = resolve(arg.slice("--workspace-dir=".length));
      continue;
    }
    if (arg === "--workspace-dir") {
      const value = args[index + 1];
      if (!value) throw new Error("--workspace-dir requires a value.");
      workspaceDirectory = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return { port, userDataPath, workspaceDirectory, help };
}

function printHelp(): void {
  console.log(`DeepWrite standalone web service

Usage:
  pnpm web [options]

Options:
  --port <port>             Loopback port (default: ${DEFAULT_WEB_PORT})
  --data-dir <directory>   Standalone data directory
  --workspace-dir <dir>    Initial workspace directory
  --help                   Show this help

No secret is required for localhost access. DEEPWRITE_WEB_SECRET only keeps
standalone model and marketplace credentials portable across data directories.
`);
}

async function main(): Promise<void> {
  const options = parseStandaloneCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const host = process.env.DEEPWRITE_WEB_HOST?.trim() || "127.0.0.1";
  const publicHost =
    process.env.DEEPWRITE_WEB_PUBLIC_HOST?.trim() ||
    (host === "0.0.0.0" ? "localhost" : host);

  const runtime = new StandaloneWebServiceRuntime({
    userDataPath: options.userDataPath,
    rendererRoot: resolve(import.meta.dirname, "../renderer"),
    utilityEntryDirectory: resolve(import.meta.dirname, "utilities"),
    host,
    publicHost,
    port: options.port,
    appVersion: packageMetadata.version,
    documentsPath: join(homedir(), "Documents"),
    ...(options.workspaceDirectory
      ? { workspaceDirectory: options.workspaceDirectory }
      : {})
  });
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await runtime.stop();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  try {
    await runtime.start();
    const status = runtime.controller.status();
    if (!status.running || !status.url) {
      throw new Error(status.error ?? "Web service failed to start.");
    }
    console.log(`DeepWrite web service listening at ${status.url}`);
    console.log(`Data directory: ${options.userDataPath}`);
  } catch (error: unknown) {
    console.error(
      "DeepWrite standalone web service failed:",
      error instanceof Error ? error.message : String(error)
    );
    await shutdown();
    process.exitCode = 1;
  }
}

await main();
