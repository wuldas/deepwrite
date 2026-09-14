import { BrowserWindow, ipcMain } from "electron";
import {
  CLOUD_BACKUP_IPC_CHANNEL,
  CloudBackupIpcRequestSchema
} from "@deepwrite/contracts";
import { dispatchCloudBackup } from "./dispatch";
import type { CloudBackupService } from "./service";

export function registerCloudBackupIpc(
  getService: () => CloudBackupService | undefined,
  getMainWindow: () => BrowserWindow | null | undefined
): void {
  ipcMain.handle(
    CLOUD_BACKUP_IPC_CHANNEL,
    async (event, rawRequest: unknown): Promise<unknown> => {
      const mainWindow = getMainWindow();
      if (
        !mainWindow ||
        mainWindow.isDestroyed() ||
        event.sender !== mainWindow.webContents
      ) {
        throw new Error("云端备份 IPC 请求来源无效。");
      }
      const service = getService();
      if (!service) {
        throw new Error("云端备份服务尚未初始化。");
      }
      const request = CloudBackupIpcRequestSchema.parse(rawRequest);
      return dispatchCloudBackup(service, request);
    }
  );
}
