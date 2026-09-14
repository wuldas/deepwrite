import {
  APP_ALERT_ACKNOWLEDGE_DESKTOP_CHANNEL,
  APP_ALERT_GET_CHANNEL,
  AppAlertDesktopRevisionSchema,
  AppAlertSnapshotSchema,
  CLOUD_BACKUP_IPC_CHANNEL,
  CloudBackupIpcRequestSchema,
  MARKETPLACE_IPC_CHANNEL,
  UpdateStateSchema,
  UPDATE_CHECK_CHANNEL,
  UPDATE_DOWNLOAD_CHANNEL,
  UPDATE_GET_STATE_CHANNEL,
  UPDATE_INSTALL_CHANNEL
} from "@deepwrite/contracts";
import { dispatchCloudBackup } from "../../extras/cloud-backup/dispatch";
import type { CloudBackupService } from "../../extras/cloud-backup/service";
import type { AppAlertStore } from "../app-alert-store";
import type { MarketplaceClient } from "../marketplace-client";
import { dispatchMarketplaceOperation } from "../marketplace-operations";
import type { WebServiceController } from "./web-service-controller";

export interface StandaloneChannelOptions {
  controller: WebServiceController;
  appAlertStore: AppAlertStore;
  marketplaceClient: MarketplaceClient;
  cloudBackupService: CloudBackupService;
  appVersion: string;
}

export function registerStandaloneChannels(
  options: StandaloneChannelOptions
): void {
  const updateState = UpdateStateSchema.parse({
    status: "unsupported",
    currentVersion: options.appVersion,
    releaseNotes: [],
    message: "独立 Web 服务不支持桌面应用更新。",
    canDownload: false,
    canInstall: false
  });
  options.controller.registerInvokeChannel(
    UPDATE_GET_STATE_CHANNEL,
    () => updateState
  );
  options.controller.registerInvokeChannel(
    UPDATE_CHECK_CHANNEL,
    () => updateState
  );
  options.controller.registerInvokeChannel(
    UPDATE_DOWNLOAD_CHANNEL,
    () => updateState
  );
  options.controller.registerInvokeChannel(UPDATE_INSTALL_CHANNEL, () => {
    throw new Error("独立 Web 服务不支持安装桌面应用更新。");
  });
  options.controller.registerInvokeChannel(APP_ALERT_GET_CHANNEL, async () =>
    AppAlertSnapshotSchema.parse(await options.appAlertStore.getSnapshot())
  );
  options.controller.registerInvokeChannel(
    APP_ALERT_ACKNOWLEDGE_DESKTOP_CHANNEL,
    async (payload) => {
      await options.appAlertStore.acknowledgeDesktop(
        AppAlertDesktopRevisionSchema.parse(payload)
      );
    }
  );
  options.controller.registerInvokeChannel(MARKETPLACE_IPC_CHANNEL, (payload) =>
    dispatchMarketplaceOperation(options.marketplaceClient, payload)
  );
  options.controller.registerInvokeChannel(
    CLOUD_BACKUP_IPC_CHANNEL,
    (payload) =>
      dispatchCloudBackup(
        options.cloudBackupService,
        CloudBackupIpcRequestSchema.parse(payload)
      )
  );
}
