import {
  CatalogInstallMarketplaceSkillContentResultSchema,
  CatalogSnapshotSchema,
  CommandEnvelopeSchema,
  CommandResultSchema,
  GeneralSettingsSnapshotSchema,
  SystemEventEnvelopeSchema,
  createDefaultAppearanceSettings,
  createDefaultGeneralSettings,
  createEnvelope,
  type CommandEnvelope,
  type CommandResult,
  type MarketplaceInstallPackage,
  type SystemEventEnvelope,
  type UtilityWorkerName
} from "@deepwrite/contracts";
import { createId, nowIso } from "@deepwrite/shared";
import { AppAlertStore } from "../app-alert-store";
import { AgentTeamConfigStore } from "../agent-team-config-store";
import { AppearanceService } from "../appearance-service";
import { ChatAssistantProjectConfigStore } from "../chat-assistant-project-config-store";
import { ContinuationImportPreviewRegistry } from "../continuation-import-preview-registry";
import { GeneralSettingsStore } from "../general-settings-store";
import { LearningImitationConfigStore } from "../learning-imitation-config-store";
import { LibraryAgentConfigStore } from "../library-agent-config-store";
import { LongAgentConfigStore } from "../long-agent-config-store";
import { LongBookAnalysisConfigStore } from "../extras/long-book-analysis/config-store";
import { CloudBackupService } from "../../extras/cloud-backup/service";
import { LegacySyncPreviewRegistry } from "../legacy-sync-preview-registry";
import { MarketplaceClient } from "../marketplace-client";
import { ModelConfigStore } from "../model-config-store";
import { ModelUsageStore } from "../model-usage-store";
import { NodeSecureStorage } from "../secure-storage";
import {
  AGENT_CORE_LONG_QUERY_COMMANDS,
  authorizeMainInternalCommand
} from "../internal-command-authorizer";
import { dispatchCommand } from "../ipc/dispatch-command";
import { spawnNodeUtilityProcess } from "../node-utility-process";
import { UtilitySupervisor } from "../supervisor";
import { WorkspaceAgentConfigStore } from "../workspace-agent-config-store";
import { WorkspaceDirectoryStore } from "../workspace-directory-store";
import { resolveDeepWriteAppMode } from "../app-run-mode";
import {
  recordUsageObservation,
  type UsageRunContext
} from "../usage-observation";
import type { ActiveRun } from "../ipc/command-types";
import {
  createStandaloneCommandContext,
  type StandaloneCommandContext,
  type StandaloneCommandContextOptions
} from "./standalone-command-context";
import { registerStandaloneChannels } from "./standalone-channels";
import {
  WebServiceController,
  type WebServiceControllerOptions
} from "./web-service-controller";

export interface StandaloneWebServiceOptions {
  userDataPath: string;
  rendererRoot: string;
  utilityEntryDirectory: string;
  host: string;
  publicHost: string;
  port: number;
  appVersion: string;
  documentsPath: string;
  workspaceDirectory?: string;
}

function requestIdFromRaw(raw: unknown): string {
  if (typeof raw !== "object" || raw === null || !("id" in raw)) {
    return "unknown";
  }
  const id = raw.id;
  return typeof id === "string" && id.trim() ? id : "unknown";
}

function rejectedCommand(
  requestId: string,
  code: string,
  message: string
): CommandResult {
  return { status: "rejected", requestId, error: { code, message } };
}

/** Owns the Electron-free DeepWrite runtime behind the standalone web entry. */
export class StandaloneWebServiceRuntime {
  readonly controller: WebServiceController;
  private readonly supervisor: UtilitySupervisor;
  private readonly modelConfigStore: ModelConfigStore;
  private readonly modelUsageStore: ModelUsageStore;
  private readonly generalSettingsStore: GeneralSettingsStore;
  private readonly workspaceDirectoryStore: WorkspaceDirectoryStore;
  private readonly appAlertStore: AppAlertStore;
  private readonly marketplaceClient: MarketplaceClient;
  private readonly cloudBackupService: CloudBackupService;
  private readonly context: StandaloneCommandContext;
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly pendingUsageContexts = new Map<string, UsageRunContext>();
  private readonly terminalRuns = new Set<string>();
  private cachedGeneralSettings = createDefaultGeneralSettings();
  private cachedAppearanceSettings = createDefaultAppearanceSettings();
  private webPort: number;
  private readonly workspaceDirectory: string | undefined;
  private stopping = false;

  constructor(private readonly options: StandaloneWebServiceOptions) {
    process.env.DEEPWRITE_USER_DATA_PATH = options.userDataPath;
    process.env.DEEPWRITE_APP_MODE = resolveDeepWriteAppMode(
      process.env.DEEPWRITE_APP_MODE
    );
    this.webPort = options.port;
    this.workspaceDirectory = options.workspaceDirectory;
    this.cachedGeneralSettings = {
      ...this.cachedGeneralSettings,
      showInMenuBar: false,
      webService: { enabled: true, port: options.port }
    };

    const secureStorage = new NodeSecureStorage(options.userDataPath);
    this.modelConfigStore = new ModelConfigStore(options.userDataPath, {
      appVersion: options.appVersion,
      secureStorage
    });
    this.modelUsageStore = new ModelUsageStore(options.userDataPath);
    this.generalSettingsStore = new GeneralSettingsStore(options.userDataPath);
    this.workspaceDirectoryStore = new WorkspaceDirectoryStore(
      options.userDataPath
    );
    this.appAlertStore = new AppAlertStore(options.userDataPath);
    this.supervisor = new UtilitySupervisor({
      processFactory: spawnNodeUtilityProcess,
      utilityEntryDirectory: options.utilityEntryDirectory,
      onUtilityEvent: (event, worker) => this.handleUtilityEvent(event, worker),
      onUnexpectedExit: (worker, reason) =>
        this.handleWorkerRestarting(worker, reason),
      onWorkerRestarted: (worker, reason) =>
        this.handleWorkerRestarted(worker, reason),
      internalCommandAllowlist: { core: AGENT_CORE_LONG_QUERY_COMMANDS },
      internalCommandAuthorize: (context) =>
        authorizeMainInternalCommand(context, this.activeRuns)
    });
    this.marketplaceClient = new MarketplaceClient(options.userDataPath, {
      secureStorage,
      loadCatalogSnapshot: () => this.loadCatalogSnapshot(),
      installPackage: (input) => this.installMarketplacePackage(input)
    });
    this.cloudBackupService = new CloudBackupService(options.userDataPath, {
      getWorkspaceDirectory: async () =>
        (await this.workspaceDirectoryStore.list()).path,
      registerCatalogProject: (input) => this.registerCatalogProject(input),
      registerLongBook: (projectDirectory) =>
        this.registerLongBook(projectDirectory)
    });
    this.controller = new WebServiceController({
      rendererRoot: options.rendererRoot,
      webEntryDevUrl: "",
      proxyTarget: () => null,
      host: options.host,
      publicHost: options.publicHost
    } satisfies WebServiceControllerOptions);
    this.context = createStandaloneCommandContext(this.commandContextOptions());
    this.controller.setCommandInvoker((rawCommand) =>
      this.handleCommand(rawCommand)
    );
    registerStandaloneChannels({
      controller: this.controller,
      appAlertStore: this.appAlertStore,
      marketplaceClient: this.marketplaceClient,
      cloudBackupService: this.cloudBackupService,
      appVersion: options.appVersion
    });
  }

  async start(): Promise<void> {
    if (this.workspaceDirectory) {
      await this.workspaceDirectoryStore.save(this.workspaceDirectory);
    } else {
      await this.workspaceDirectoryStore
        .initializeDefault(this.options.documentsPath)
        .catch((error: unknown) => {
          console.warn(
            "DeepWrite standalone workspace directory could not initialize:",
            error instanceof Error ? error.message : "unknown error"
          );
        });
    }
    this.supervisor.startAll();
    await this.modelConfigStore.initialize().catch((error: unknown) => {
      console.warn(
        "DeepWrite standalone model configuration could not initialize:",
        error instanceof Error ? error.message : "unknown error"
      );
    });
    await this.controller.reconcile({ enabled: true, port: this.webPort });
  }

  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    await this.controller.stop();
    await this.supervisor.shutdownAll();
    await this.modelUsageStore.flush().catch(() => undefined);
  }

  private commandContextOptions(): StandaloneCommandContextOptions {
    return {
      controller: this.controller,
      supervisor: this.supervisor,
      modelConfigStore: this.modelConfigStore,
      modelUsageStore: this.modelUsageStore,
      chatAssistantProjectConfigStore: new ChatAssistantProjectConfigStore(
        this.options.userDataPath
      ),
      workspaceAgentConfigStore: new WorkspaceAgentConfigStore(
        this.options.userDataPath
      ),
      agentTeamConfigStore: new AgentTeamConfigStore(this.options.userDataPath),
      libraryAgentConfigStore: new LibraryAgentConfigStore(
        this.options.userDataPath
      ),
      longAgentConfigStore: new LongAgentConfigStore(this.options.userDataPath),
      learningImitationConfigStore: new LearningImitationConfigStore(
        this.options.userDataPath
      ),
      longBookAnalysisConfigStore: new LongBookAnalysisConfigStore(
        this.options.userDataPath
      ),
      workspaceDirectoryStore: this.workspaceDirectoryStore,
      appearanceService: new AppearanceService(this.options.userDataPath),
      generalSettingsStore: this.generalSettingsStore,
      continuationImportPreviews: new ContinuationImportPreviewRegistry(),
      legacySyncPreviews: new LegacySyncPreviewRegistry(),
      activeRuns: this.activeRuns,
      pendingUsageContexts: this.pendingUsageContexts,
      terminalRuns: this.terminalRuns,
      appVersion: this.options.appVersion,
      documentsPath: this.options.documentsPath,
      appearanceSettings: () => this.cachedAppearanceSettings,
      onAppearanceSettings: (settings) => {
        this.cachedAppearanceSettings = settings;
      },
      onGeneralSettings: (settings) => {
        this.cachedGeneralSettings = settings;
      }
    };
  }

  private async handleCommand(rawCommand: unknown): Promise<CommandResult> {
    const requestId = requestIdFromRaw(rawCommand);
    const parsed = CommandEnvelopeSchema.safeParse(rawCommand);
    if (!parsed.success) {
      return rejectedCommand(
        requestId,
        "ipc.invalid_command",
        "Command envelope failed schema validation."
      );
    }
    try {
      const result = await dispatchCommand(this.context, parsed.data);
      if (
        result.status === "accepted" &&
        (parsed.data.type === "generalSettings.list" ||
          parsed.data.type === "generalSettings.save")
      ) {
        const snapshot = GeneralSettingsSnapshotSchema.parse(result.payload);
        if (parsed.data.type === "generalSettings.save") {
          this.webPort = snapshot.settings.webService.port;
          await this.controller.reconcile(snapshot.settings.webService);
        }
        const effectiveSettings =
          this.controller.status().running &&
          parsed.data.type === "generalSettings.list"
            ? {
                ...snapshot.settings,
                webService: {
                  ...snapshot.settings.webService,
                  enabled: true,
                  port: this.webPort
                }
              }
            : snapshot.settings;
        return CommandResultSchema.parse({
          ...result,
          payload: {
            ...snapshot,
            settings: effectiveSettings,
            webServiceStatus: this.controller.status()
          }
        });
      }
      return CommandResultSchema.parse(result);
    } catch (error: unknown) {
      return rejectedCommand(
        requestId,
        "ipc.command_failed",
        error instanceof Error ? error.message : "Standalone command failed."
      );
    }
  }

  private handleUtilityEvent(
    event: SystemEventEnvelope,
    _worker: UtilityWorkerName
  ): void {
    const validated = SystemEventEnvelopeSchema.parse(event);
    if (validated.type === "agent.usage_observed") {
      recordUsageObservation(
        validated,
        this.modelUsageStore,
        this.activeRuns,
        this.pendingUsageContexts
      );
    }
    if (
      validated.type === "agent.message_completed" ||
      validated.type === "agent.error"
    ) {
      const runId = validated.context.runId;
      if (runId) {
        this.terminalRuns.add(runId);
        this.activeRuns.delete(runId);
        this.pendingUsageContexts.delete(validated.context.correlationId);
      }
    }
    this.controller.publishEvent("deepwrite:event", validated);
  }

  private handleWorkerRestarting(
    worker: UtilityWorkerName,
    reason: string
  ): void {
    this.controller.publishEvent(
      "deepwrite:event",
      createEnvelope(
        "system.worker_restarting",
        { worker, reason, detectedAt: nowIso() },
        { id: createId("evt_worker_restarting") }
      )
    );
  }

  private handleWorkerRestarted(
    worker: UtilityWorkerName,
    reason: string
  ): void {
    this.controller.publishEvent(
      "deepwrite:event",
      createEnvelope(
        "system.worker_restarted",
        { worker, reason, restartedAt: nowIso() },
        { id: createId("evt_worker_restarted") }
      )
    );
  }

  private async requestCore(command: CommandEnvelope): Promise<unknown> {
    const result = await this.supervisor.requestCommand("core", command, 0);
    if (result.status === "rejected") throw new Error(result.error.message);
    return result.payload;
  }

  private async loadCatalogSnapshot() {
    const id = createId("cmd_standalone_marketplace_snapshot");
    return CatalogSnapshotSchema.parse(
      await this.requestCore(createEnvelope("catalog.snapshot", {}, { id }))
    );
  }

  private async installMarketplacePackage(input: MarketplaceInstallPackage) {
    const id = createId("cmd_standalone_marketplace_install");
    return CatalogInstallMarketplaceSkillContentResultSchema.parse(
      await this.requestCore(
        createEnvelope("catalog.installMarketplaceSkillContent", input, { id })
      )
    );
  }

  private async registerCatalogProject(input: {
    projectDirectory: string;
    domain: "book" | "material" | "skill";
  }): Promise<void> {
    const id = createId("cmd_standalone_cloud_catalog");
    await this.requestCore(
      createEnvelope("catalog.openProjectAtPath", input, { id })
    );
  }

  private async registerLongBook(projectDirectory: string): Promise<void> {
    const id = createId("cmd_standalone_cloud_long");
    await this.requestCore(
      createEnvelope("long.openAtPath", { projectDirectory }, { id })
    );
  }
}
