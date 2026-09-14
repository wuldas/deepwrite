import { describe, expect, it } from "vitest";
import {
  GeneralSettingsSchema,
  GeneralSettingsSnapshotSchema,
  TextViewModeSchema,
  WebServiceSettingsSchema,
  createDefaultGeneralSettings
} from "./general-settings";

describe("general settings contracts", () => {
  it("keeps edit as the default text view mode", () => {
    expect(createDefaultGeneralSettings().defaultTextViewMode).toBe("edit");
    expect(createDefaultGeneralSettings().useNetworkProxy).toBe(false);
    expect(
      GeneralSettingsSchema.parse({
        permissionMode: "request-approval",
        autoSave: false,
        language: "zh-CN",
        showInMenuBar: false
      })
    ).toMatchObject({
      autoApproveCrossStageOperations: true,
      showContextUsage: true,
      useNetworkProxy: false,
      workspacePaneLayout: "agent-editor",
      defaultTextViewMode: "edit",
      webService: { enabled: false, port: 8742 }
    });
  });

  it("enables both automatic approval preferences by default", () => {
    expect(createDefaultGeneralSettings()).toMatchObject({
      permissionMode: "auto-approve",
      autoApproveCrossStageOperations: true
    });
  });

  it("defaults the web service to disabled on the loopback default port", () => {
    expect(createDefaultGeneralSettings().webService).toEqual({
      enabled: false,
      port: 8742
    });
  });

  it("fills web service status defaults for legacy snapshots", () => {
    expect(
      GeneralSettingsSnapshotSchema.parse({
        persisted: true,
        settings: createDefaultGeneralSettings()
      }).webServiceStatus
    ).toEqual({ running: false, url: null, error: null });
  });

  it("rejects out-of-range web service ports", () => {
    expect(
      WebServiceSettingsSchema.safeParse({ enabled: true, port: 80 }).success
    ).toBe(false);
    expect(
      WebServiceSettingsSchema.safeParse({ enabled: true, port: 70000 }).success
    ).toBe(false);
  });
  it("accepts only edit and preview text view modes", () => {
    expect(TextViewModeSchema.parse("preview")).toBe("preview");
    expect(TextViewModeSchema.safeParse("reader").success).toBe(false);
  });
});
