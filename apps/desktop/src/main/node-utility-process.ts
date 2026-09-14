import { fork, type ChildProcess } from "node:child_process";
import type { UtilityWorkerName } from "@deepwrite/contracts";
import type {
  UtilityProcessAdapter,
  UtilityProcessFactory
} from "./utility-process-adapter";

type NodeIpcSerializable = string | object | number | boolean | bigint;

class NodeUtilityProcessAdapter implements UtilityProcessAdapter {
  constructor(private readonly child: ChildProcess) {}

  get pid(): number | undefined {
    return this.child.pid;
  }

  postMessage(message: unknown): void {
    if (!this.child.connected) {
      throw new Error("Node utility process IPC channel is disconnected.");
    }
    this.child.send(message as NodeIpcSerializable);
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

export const spawnNodeUtilityProcess: UtilityProcessFactory = (
  entryPath: string,
  _worker: UtilityWorkerName
): UtilityProcessAdapter =>
  new NodeUtilityProcessAdapter(
    fork(entryPath, [], {
      env: { ...process.env },
      stdio: ["ignore", "inherit", "inherit", "ipc"]
    })
  );
