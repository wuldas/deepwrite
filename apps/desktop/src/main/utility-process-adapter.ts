import type { UtilityWorkerName } from "@deepwrite/contracts";

export interface UtilityProcessAdapter {
  readonly pid: number | undefined;
  postMessage(message: unknown): void;
  onMessage(listener: (message: unknown) => void): void;
  onExit(listener: (code: number | null) => void): void;
  kill(): boolean;
}

export type UtilityProcessFactory = (
  entryPath: string,
  worker: UtilityWorkerName
) => UtilityProcessAdapter;
