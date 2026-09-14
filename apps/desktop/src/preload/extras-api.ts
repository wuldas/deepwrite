import {
  APP_ALERT_ACKNOWLEDGE_DESKTOP_CHANNEL,
  APP_ALERT_GET_CHANNEL,
  AppAlertDesktopRevisionSchema,
  AppAlertSnapshotSchema,
  CLOUD_BACKUP_IPC_CHANNEL,
  CloudBackupApplyResultSchema,
  CloudBackupIpcRequestSchema,
  CloudBackupPreviewSchema,
  CloudBackupStatusSchema,
  MARKETPLACE_IPC_CHANNEL,
  MarketplaceContentDetailSchema,
  MarketplaceContentPageSchema,
  MarketplaceContentRefSchema,
  MarketplaceContentSummarySchema,
  MarketplaceInstallInputSchema,
  MarketplaceInstallPreviewSchema,
  MarketplaceInstallResultSchema,
  MarketplaceIpcRequestSchema,
  MarketplaceLikeInputSchema,
  MarketplaceLikeResultSchema,
  MarketplaceListFilterSchema,
  MarketplaceLoginInputSchema,
  MarketplacePublishInputSchema,
  MarketplaceRegisterInputSchema,
  MarketplaceSessionSchema,
  MarketplaceSetEnabledInputSchema,
  MarketplaceUpdateInputSchema,
  RendererStateKeySchema,
  RendererStateLoadResultSchema,
  RendererStateMutationResultSchema,
  UPDATE_CHECK_CHANNEL,
  UPDATE_DOWNLOAD_CHANNEL,
  UPDATE_GET_STATE_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_STATE_EVENT_CHANNEL,
  UpdateStateSchema,
  createEnvelope,
  type AppAlertSnapshot,
  type DeepWriteApi,
  type MarketplaceContentRef,
  type MarketplaceInstallInput,
  type MarketplaceLikeInput,
  type MarketplaceListFilter,
  type MarketplaceLoginInput,
  type MarketplacePublishInput,
  type MarketplaceRegisterInput,
  type MarketplaceSetEnabledInput,
  type MarketplaceUpdateInput,
  type UpdateState
} from "@deepwrite/contracts";

import {
  browserId,
  invokeChannel,
  invokeCommand,
  onChannelEvent
} from "./invoke";

export async function loadConversationPersistence(
  rawKey: string
): Promise<unknown | undefined> {
  const key = RendererStateKeySchema.parse(rawKey);
  const id = browserId("cmd_renderer_state_load");
  const result = RendererStateLoadResultSchema.parse(
    await invokeCommand(
      createEnvelope("rendererState.load", { key }, { id, correlationId: id })
    )
  );
  return result.found ? result.value : undefined;
}

export async function saveConversationPersistence(
  rawKey: string,
  value: unknown
): Promise<void> {
  const key = RendererStateKeySchema.parse(rawKey);
  const id = browserId("cmd_renderer_state_save");
  RendererStateMutationResultSchema.parse(
    await invokeCommand(
      createEnvelope(
        "rendererState.save",
        { key, value },
        { id, correlationId: id }
      )
    )
  );
}

export async function removeConversationPersistence(
  rawKey: string
): Promise<void> {
  const key = RendererStateKeySchema.parse(rawKey);
  const id = browserId("cmd_renderer_state_remove");
  RendererStateMutationResultSchema.parse(
    await invokeCommand(
      createEnvelope("rendererState.remove", { key }, { id, correlationId: id })
    )
  );
}

export async function getUpdateState(): Promise<UpdateState> {
  return UpdateStateSchema.parse(await invokeChannel(UPDATE_GET_STATE_CHANNEL));
}

export async function checkForUpdates(): Promise<UpdateState> {
  return UpdateStateSchema.parse(await invokeChannel(UPDATE_CHECK_CHANNEL));
}

export async function downloadUpdate(): Promise<UpdateState> {
  return UpdateStateSchema.parse(await invokeChannel(UPDATE_DOWNLOAD_CHANNEL));
}

export async function installUpdate(): Promise<void> {
  await invokeChannel(UPDATE_INSTALL_CHANNEL);
}

export async function getAppAlerts(): Promise<AppAlertSnapshot> {
  return AppAlertSnapshotSchema.parse(
    await invokeChannel(APP_ALERT_GET_CHANNEL)
  );
}

export async function acknowledgeDesktopAlert(
  rawRevision: string
): Promise<void> {
  const revision = AppAlertDesktopRevisionSchema.parse(rawRevision);
  await invokeChannel(APP_ALERT_ACKNOWLEDGE_DESKTOP_CHANNEL, revision);
}

export async function invokeMarketplace(rawRequest: unknown): Promise<unknown> {
  const request = MarketplaceIpcRequestSchema.parse(rawRequest);
  return invokeChannel(MARKETPLACE_IPC_CHANNEL, request);
}

export async function invokeCloudBackup(rawRequest: unknown): Promise<unknown> {
  const request = CloudBackupIpcRequestSchema.parse(rawRequest);
  return invokeChannel(CLOUD_BACKUP_IPC_CHANNEL, request);
}

export const updates: DeepWriteApi["updates"] = {
  getState: getUpdateState,
  check: checkForUpdates,
  download: downloadUpdate,
  install: installUpdate,
  subscribe(listener: (state: UpdateState) => void): () => void {
    return onChannelEvent(UPDATE_STATE_EVENT_CHANNEL, (rawState) => {
      const parsed = UpdateStateSchema.safeParse(rawState);
      if (!parsed.success) {
        console.warn("DeepWrite discarded an invalid update state event.");
        return;
      }
      listener(parsed.data);
    });
  }
};

export const appAlerts: DeepWriteApi["appAlerts"] = {
  get: getAppAlerts,
  acknowledgeDesktop: acknowledgeDesktopAlert
};

export const marketplace: DeepWriteApi["marketplace"] = {
  async session() {
    return MarketplaceSessionSchema.parse(
      await invokeMarketplace({ operation: "session" })
    );
  },
  async register(input: MarketplaceRegisterInput) {
    return MarketplaceSessionSchema.parse(
      await invokeMarketplace({
        operation: "register",
        input: MarketplaceRegisterInputSchema.parse(input)
      })
    );
  },
  async login(input: MarketplaceLoginInput) {
    return MarketplaceSessionSchema.parse(
      await invokeMarketplace({
        operation: "login",
        input: MarketplaceLoginInputSchema.parse(input)
      })
    );
  },
  async logout() {
    return MarketplaceSessionSchema.parse(
      await invokeMarketplace({ operation: "logout" })
    );
  },
  async list(filter: MarketplaceListFilter = {}) {
    return MarketplaceContentPageSchema.parse(
      await invokeMarketplace({
        operation: "list",
        filter: MarketplaceListFilterSchema.parse(filter)
      })
    );
  },
  async detail(ref: MarketplaceContentRef) {
    return MarketplaceContentDetailSchema.parse(
      await invokeMarketplace({
        operation: "detail",
        ref: MarketplaceContentRefSchema.parse(ref)
      })
    );
  },
  async listMine(filter: MarketplaceListFilter = {}) {
    return MarketplaceContentPageSchema.parse(
      await invokeMarketplace({
        operation: "listMine",
        filter: MarketplaceListFilterSchema.parse(filter)
      })
    );
  },
  async myDetail(ref: MarketplaceContentRef) {
    return MarketplaceContentDetailSchema.parse(
      await invokeMarketplace({
        operation: "myDetail",
        ref: MarketplaceContentRefSchema.parse(ref)
      })
    );
  },
  async publish(input: MarketplacePublishInput) {
    return MarketplaceContentDetailSchema.parse(
      await invokeMarketplace({
        operation: "publish",
        input: MarketplacePublishInputSchema.parse(input)
      })
    );
  },
  async update(input: MarketplaceUpdateInput) {
    return MarketplaceContentDetailSchema.parse(
      await invokeMarketplace({
        operation: "update",
        input: MarketplaceUpdateInputSchema.parse(input)
      })
    );
  },
  async setEnabled(input: MarketplaceSetEnabledInput) {
    return MarketplaceContentSummarySchema.parse(
      await invokeMarketplace({
        operation: "setEnabled",
        input: MarketplaceSetEnabledInputSchema.parse(input)
      })
    );
  },
  async delete(ref: MarketplaceContentRef) {
    await invokeMarketplace({
      operation: "delete",
      ref: MarketplaceContentRefSchema.parse(ref)
    });
  },
  async like(input: MarketplaceLikeInput) {
    return MarketplaceLikeResultSchema.parse(
      await invokeMarketplace({
        operation: "like",
        input: MarketplaceLikeInputSchema.parse(input)
      })
    );
  },
  async previewInstall(ref: MarketplaceContentRef) {
    return MarketplaceInstallPreviewSchema.parse(
      await invokeMarketplace({
        operation: "previewInstall",
        ref: MarketplaceContentRefSchema.parse(ref)
      })
    );
  },
  async install(input: MarketplaceInstallInput) {
    return MarketplaceInstallResultSchema.parse(
      await invokeMarketplace({
        operation: "install",
        input: MarketplaceInstallInputSchema.parse(input)
      })
    );
  }
};

export const cloudBackup: DeepWriteApi["cloudBackup"] = {
  async status() {
    return CloudBackupStatusSchema.parse(
      await invokeCloudBackup({ operation: "status" })
    );
  },
  async previewBackup() {
    return CloudBackupPreviewSchema.parse(
      await invokeCloudBackup({ operation: "previewBackup" })
    );
  },
  async applyBackup(previewId: string) {
    return CloudBackupApplyResultSchema.parse(
      await invokeCloudBackup({
        operation: "applyBackup",
        previewId
      })
    );
  },
  async previewRestore(machineKey: string) {
    return CloudBackupPreviewSchema.parse(
      await invokeCloudBackup({
        operation: "previewRestore",
        machineKey
      })
    );
  },
  async applyRestore(previewId: string) {
    return CloudBackupApplyResultSchema.parse(
      await invokeCloudBackup({
        operation: "applyRestore",
        previewId
      })
    );
  }
};
