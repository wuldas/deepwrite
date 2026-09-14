import type { CloudBackupIpcRequest } from "@deepwrite/contracts";
import type { CloudBackupService } from "./service";

export async function dispatchCloudBackup(
  service: CloudBackupService,
  request: CloudBackupIpcRequest
): Promise<unknown> {
  switch (request.operation) {
    case "status":
      return service.status();
    case "previewBackup":
      return service.previewBackup();
    case "applyBackup":
      return service.applyBackup(request.previewId);
    case "previewRestore":
      return service.previewRestore(request.machineKey);
    case "applyRestore":
      return service.applyRestore(request.previewId);
  }
}
