import {
  CommandResultSchema,
  IPC_COMMAND_CHANNEL,
  type CommandEnvelope
} from "@deepwrite/contracts";
import { createId } from "@deepwrite/shared";

export interface DeepWriteTransport {
  invokeChannel(channel: string, payload?: unknown): Promise<unknown>;
  onChannelEvent(
    channel: string,
    listener: (payload: unknown) => void
  ): () => void;
}

let activeTransport: DeepWriteTransport | null = null;

export function setDeepWriteTransport(transport: DeepWriteTransport): void {
  activeTransport = transport;
}

function requireTransport(): DeepWriteTransport {
  if (!activeTransport) {
    throw new Error("DeepWrite transport 尚未初始化。");
  }
  return activeTransport;
}

export function browserId(prefix: string): string {
  return createId(prefix);
}

export async function invokeCommand<TPayload>(
  command: CommandEnvelope
): Promise<TPayload> {
  const expectedRequestId = command.id;
  const result = CommandResultSchema.parse(
    await requireTransport().invokeChannel(IPC_COMMAND_CHANNEL, command)
  );
  if (result.requestId !== expectedRequestId) {
    // Prefer the real rejection reason when main returned requestId "unknown"
    // (or another mismatched id) for an invalid/untrusted command.
    if (result.status === "rejected") {
      throw new Error(`${result.error.code}: ${result.error.message}`);
    }
    throw new Error(
      `IPC result requestId does not match command id. expected=${expectedRequestId} actual=${result.requestId}`
    );
  }
  if (result.status === "rejected") {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.payload as TPayload;
}

export async function invokeChannel(
  channel: string,
  payload?: unknown
): Promise<unknown> {
  return payload === undefined
    ? requireTransport().invokeChannel(channel)
    : requireTransport().invokeChannel(channel, payload);
}

export function onChannelEvent(
  channel: string,
  listener: (payload: unknown) => void
): () => void {
  return requireTransport().onChannelEvent(channel, listener);
}
