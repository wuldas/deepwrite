import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";

export const GeneralPermissionModeSchema = z.enum([
  "request-approval",
  "auto-approve"
]);
export type GeneralPermissionMode = z.infer<typeof GeneralPermissionModeSchema>;

export const AppLanguageSchema = z.enum(["auto", "zh-CN"]);
export type AppLanguage = z.infer<typeof AppLanguageSchema>;

export const WorkspacePaneLayoutSchema = z.enum([
  "agent-editor",
  "editor-agent"
]);
export type WorkspacePaneLayout = z.infer<typeof WorkspacePaneLayoutSchema>;

export const TextViewModeSchema = z.enum(["edit", "preview"]);
export type TextViewMode = z.infer<typeof TextViewModeSchema>;
export const WEB_SERVICE_DEFAULT_PORT = 8742;

export const WebServiceSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().int().min(1024).max(65535).default(WEB_SERVICE_DEFAULT_PORT)
});
export type WebServiceSettings = z.infer<typeof WebServiceSettingsSchema>;

export const WebServiceStatusSchema = z.object({
  running: z.boolean(),
  url: z.string().nullable(),
  error: z.string().nullable()
});
export type WebServiceStatus = z.infer<typeof WebServiceStatusSchema>;

export const GeneralSettingsSchema = z.object({
  permissionMode: GeneralPermissionModeSchema,
  autoApproveCrossStageOperations: z.boolean().default(true),
  autoSave: z.boolean(),
  language: AppLanguageSchema,
  showInMenuBar: z.boolean(),
  showContextUsage: z.boolean().default(true),
  useNetworkProxy: z.boolean().default(false),
  workspacePaneLayout: WorkspacePaneLayoutSchema.default("agent-editor"),
  defaultTextViewMode: TextViewModeSchema.default("edit"),
  webService: WebServiceSettingsSchema.default({
    enabled: false,
    port: WEB_SERVICE_DEFAULT_PORT
  })
});
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;

export const GeneralSettingsSnapshotSchema = z.object({
  persisted: z.boolean(),
  settings: GeneralSettingsSchema,
  webServiceStatus: WebServiceStatusSchema.default({
    running: false,
    url: null,
    error: null
  })
});
export type GeneralSettingsSnapshot = z.infer<
  typeof GeneralSettingsSnapshotSchema
>;

export function createDefaultGeneralSettings(): GeneralSettings {
  return {
    permissionMode: "auto-approve",
    autoApproveCrossStageOperations: true,
    autoSave: true,
    language: "auto",
    showInMenuBar: true,
    showContextUsage: true,
    useNetworkProxy: false,
    workspacePaneLayout: "agent-editor",
    defaultTextViewMode: "edit",
    webService: { enabled: false, port: WEB_SERVICE_DEFAULT_PORT }
  };
}

export const GeneralSettingsListCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("generalSettings.list"),
    payload: z.object({})
  });

export const GeneralSettingsSaveCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("generalSettings.save"),
    payload: GeneralSettingsSchema
  });
