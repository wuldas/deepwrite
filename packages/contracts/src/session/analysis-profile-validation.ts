import type { z } from "zod";
interface AnalysisProfileInput {
  workspaceContext?:
    | {
        shortBookAnalysis?: { presetId: string } | undefined;
        longBookAnalysis?: { presetId: string } | undefined;
      }
    | undefined;
  shortBookAnalysisProfile?: { id: string } | undefined;
  longBookAnalysisProfile?: { id: string } | undefined;
}
export function validateBookAnalysisProfiles(
  value: AnalysisProfileInput,
  context: z.core.$RefinementCtx<unknown>
): void {
  if (
    Boolean(value.workspaceContext?.shortBookAnalysis) !==
      Boolean(value.shortBookAnalysisProfile) ||
    (value.shortBookAnalysisProfile &&
      value.workspaceContext?.shortBookAnalysis?.presetId !==
        value.shortBookAnalysisProfile.id)
  ) {
    context.addIssue({
      code: "custom",
      path: ["shortBookAnalysisProfile"],
      message: "短篇拆书上下文与预设必须匹配。"
    });
  }
  if (
    Boolean(value.workspaceContext?.longBookAnalysis) !==
    Boolean(value.longBookAnalysisProfile)
  ) {
    context.addIssue({
      code: "custom",
      path: ["longBookAnalysisProfile"],
      message:
        "Long-book analysis context and agent profile must be provided together."
    });
  }
  if (
    value.longBookAnalysisProfile &&
    value.workspaceContext?.longBookAnalysis?.presetId !==
      value.longBookAnalysisProfile.id
  ) {
    context.addIssue({
      code: "custom",
      path: ["longBookAnalysisProfile", "id"],
      message: "Long-book analysis profile must match the active preset."
    });
  }
}
