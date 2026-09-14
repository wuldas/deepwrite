import { utilityProcess, type UtilityProcess } from "electron";
import type { UtilityWorkerName } from "@deepwrite/contracts";
import type {
  UtilityProcessAdapter,
  UtilityProcessFactory
} from "./utility-process-adapter";

class ElectronUtilityProcessAdapter implements UtilityProcessAdapter {
  constructor(private readonly child: UtilityProcess) {}

  get pid(): number | undefined {
    return this.child.pid;
  }

  postMessage(message: unknown): void {
    this.child.postMessage(message);
  }

  onMessage(listener: (message: unknown) => void): void {
    this.child.on("message", listener);
  }

  onExit(listener: (code: number | null) => void): void {
    this.child.once("exit", (code) => listener(code));
  }

  kill(): boolean {
    return this.child.kill();
  }
}

export const spawnElectronUtilityProcess: UtilityProcessFactory = (
  entryPath: string,
  worker: UtilityWorkerName
): UtilityProcessAdapter =>
  new ElectronUtilityProcessAdapter(
    utilityProcess.fork(entryPath, [], {
      serviceName: `deepwrite-${worker}`,
      env: { ...process.env }
    })
  );
