import type { BrowserWindow } from "electron";
import type { AppearanceSettings, GeneralSettings } from "@deepwrite/contracts";
import type { AgentTeamConfigStore } from "../agent-team-config-store";
import type { AppearanceService } from "../appearance-service";
import type { ChatAssistantProjectConfigStore } from "../chat-assistant-project-config-store";
import type { ContinuationImportPreviewRegistry } from "../continuation-import-preview-registry";
import type { GeneralSettingsStore } from "../general-settings-store";
import type { LearningImitationConfigStore } from "../learning-imitation-config-store";
import type { LibraryAgentConfigStore } from "../library-agent-config-store";
import type { LongAgentConfigStore } from "../long-agent-config-store";
import type { LongBookAnalysisConfigStore } from "../extras/long-book-analysis/config-store";
import type { ShortBookAnalysisConfigStore } from "../extras/short-book-analysis/config-store";
import type { LegacySyncPreviewRegistry } from "../legacy-sync-preview-registry";
import type { ModelConfigStore } from "../model-config-store";
import type { ModelUsageStore } from "../model-usage-store";
import type { UtilitySupervisor } from "../supervisor";
import type { UsageRunContext } from "../usage-observation";
import type { WorkspaceAgentConfigStore } from "../workspace-agent-config-store";
import type { WorkspaceDirectoryStore } from "../workspace-directory-store";
import { readExternalLibraryEntries } from "../external-library-import";
import { importLegacyLibraryArchives } from "../legacy-library-import-batch";
import { listRemoteModels } from "../list-remote-models";
import type { ActiveRun, IpcCommandContext } from "../ipc/command-types";
import {
  requireSelectedWorkspaceDirectory,
  workspaceGroupParent,
  workspaceResourceParent
} from "../ipc/workspace-paths";
import type { WebServiceController } from "./web-service-controller";
import { recordUsageObservation } from "../usage-observation";
import { authorizeMainInternalCommand } from "../internal-command-authorizer";

export interface StandaloneCommandContextOptions {
  controller: WebServiceController;
  supervisor: UtilitySupervisor;
  modelConfigStore: ModelConfigStore;
  modelUsageStore: ModelUsageStore;
  chatAssistantProjectConfigStore: ChatAssistantProjectConfigStore;
  workspaceAgentConfigStore: WorkspaceAgentConfigStore;
  agentTeamConfigStore: AgentTeamConfigStore;
  libraryAgentConfigStore: LibraryAgentConfigStore;
  longAgentConfigStore: LongAgentConfigStore;
  learningImitationConfigStore: LearningImitationConfigStore;
  longBookAnalysisConfigStore: LongBookAnalysisConfigStore;
  shortBookAnalysisConfigStore: ShortBookAnalysisConfigStore;
  workspaceDirectoryStore: WorkspaceDirectoryStore;
  appearanceService: AppearanceService;
  generalSettingsStore: GeneralSettingsStore;
  continuationImportPreviews: ContinuationImportPreviewRegistry;
  legacySyncPreviews: LegacySyncPreviewRegistry;
  activeRuns: Map<string, ActiveRun>;
  pendingUsageContexts: Map<string, UsageRunContext>;
  terminalRuns: Set<string>;
  appVersion: string;
  documentsPath: string;
  appearanceSettings(): AppearanceSettings;
  onAppearanceSettings(settings: AppearanceSettings): void;
  onGeneralSettings(settings: GeneralSettings): void;
}

export type StandaloneCommandContext = IpcCommandContext;

const standaloneWindow = {} as BrowserWindow;

const standaloneDialog: IpcCommandContext["dialog"] = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async () => ({ canceled: true, filePath: "" })
};

const unsupportedShortExport: IpcCommandContext["exportShortManuscript"] =
  async () => ({ status: "cancelled" });
const unsupportedLongExport: IpcCommandContext["exportLongManuscript"] =
  async () => ({ status: "cancelled" });

/** Builds the Electron-free context consumed by the existing domain handlers. */
export function createStandaloneCommandContext(
  options: StandaloneCommandContextOptions
): StandaloneCommandContext {
  const chooseWorkspaceDirectory = async () => null;
  const requireWorkspaceDirectory = () => options.workspaceDirectoryStore;
  const requireSelectedDirectory = () =>
    requireSelectedWorkspaceDirectory({
      requireWorkspaceDirectoryStore: requireWorkspaceDirectory,
      chooseWorkspaceDirectory
    });

  return {
    getMainWindow: () => standaloneWindow,
    supervisor: options.supervisor,
    broadcastEvent: (event) =>
      options.controller.publishEvent("deepwrite:event", event),
    dialog: standaloneDialog,
    continuationImportPreviews: options.continuationImportPreviews,
    legacySyncPreviews: options.legacySyncPreviews,
    authorizeMainInternalCommand,
    activeRuns: options.activeRuns,
    pendingUsageContexts: options.pendingUsageContexts,
    terminalRuns: options.terminalRuns,
    recordUsageObservation: (event) =>
      recordUsageObservation(
        event,
        options.modelUsageStore,
        options.activeRuns,
        options.pendingUsageContexts
      ),
    requireModelConfigStore: () => options.modelConfigStore,
    requireModelUsageStore: () => options.modelUsageStore,
    requireChatAssistantProjectConfigStore: () =>
      options.chatAssistantProjectConfigStore,
    requireWorkspaceAgentConfigStore: () => options.workspaceAgentConfigStore,
    requireAgentTeamConfigStore: () => options.agentTeamConfigStore,
    requireLibraryAgentConfigStore: () => options.libraryAgentConfigStore,
    requireLongAgentConfigStore: () => options.longAgentConfigStore,
    requireLearningImitationConfigStore: () =>
      options.learningImitationConfigStore,
    requireShortBookAnalysisConfigStore: () =>
      options.shortBookAnalysisConfigStore,
    requireLongBookAnalysisConfigStore: () =>
      options.longBookAnalysisConfigStore,
    requireWorkspaceDirectoryStore: requireWorkspaceDirectory,
    requireAppearanceService: () => options.appearanceService,
    requireGeneralSettingsStore: () => options.generalSettingsStore,
    exportShortManuscript: unsupportedShortExport,
    exportLongManuscript: unsupportedLongExport,
    listRemoteModels,
    resolveDraftApiKey: (input) =>
      options.modelConfigStore.resolveDraftApiKey(input),
    readExternalLibraryEntries,
    importLegacyLibraryArchives,
    cachedAppearanceSettings: options.appearanceSettings,
    syncNativeAppearanceChrome: options.onAppearanceSettings,
    syncGeneralSettings: options.onGeneralSettings,
    requireSelectedWorkspaceDirectory: requireSelectedDirectory,
    workspaceResourceParent,
    workspaceGroupParent,
    chooseWorkspaceDirectory,
    senderWebContentsId: 0,
    getDocumentsPath: () => options.documentsPath,
    getAppVersion: () => options.appVersion
  };
}
