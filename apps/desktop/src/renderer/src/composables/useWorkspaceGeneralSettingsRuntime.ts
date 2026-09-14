import {
  type DeepWriteApi,
  type GeneralPermissionMode,
  type GeneralSettings,
  type WebServiceStatus
} from "@deepwrite/contracts";
import type { Ref } from "vue";
import {
  useGeneralSettingsCoordinator,
  type GeneralSettingsNotifications
} from "./useGeneralSettingsCoordinator";

type GeneralSettingsApi = Pick<
  DeepWriteApi["generalSettings"],
  "list" | "save"
>;

export interface WorkspaceGeneralSettingsRuntimeOptions {
  generalSettings: Ref<GeneralSettings>;
  autoSaveEnabled: Ref<boolean>;
  api(): GeneralSettingsApi | undefined;
  onLoaded(settings: GeneralSettings): void;
  onWebServiceStatus(status: WebServiceStatus): void;
  legacyAutoSave: boolean;
  notifications: GeneralSettingsNotifications;
  applyApprovalMode(permissionMode: GeneralPermissionMode): void;
  scheduleDirtyAutoSave(): void;
  cancelAutoSave(): void;
  resumeAutomaticAgentEdits(): void;
}

/** Wires the workspace shell's general-settings coordinator with its side effects. */
export function useWorkspaceGeneralSettingsRuntime(
  options: WorkspaceGeneralSettingsRuntimeOptions
) {
  return useGeneralSettingsCoordinator({
    settings: options.generalSettings,
    autoSaveEnabled: options.autoSaveEnabled,
    api: options.api,
    publishLoaded: options.onLoaded,
    publishWebServiceStatus: options.onWebServiceStatus,
    legacyAutoSave: options.legacyAutoSave,
    storage: window.localStorage,
    documentRoot: document.documentElement,
    browserLanguage: () => navigator.language,
    applyApprovalMode: options.applyApprovalMode,
    scheduleDirtyAutoSave: options.scheduleDirtyAutoSave,
    cancelAutoSave: options.cancelAutoSave,
    resumeAutomaticAgentEdits: options.resumeAutomaticAgentEdits,
    notifications: options.notifications
  });
}
