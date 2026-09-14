import {
  assertShortAnalysisBudget,
  type ShortBookAnalysisRuntimeContext,
  type AgentProviderRuntimeConfig
} from "@deepwrite/contracts";
import type { ShortBookAnalysisConfigStore } from "./config-store";
export async function resolveShortAnalysisProfile(
  context: ShortBookAnalysisRuntimeContext | undefined,
  store: ShortBookAnalysisConfigStore,
  model: AgentProviderRuntimeConfig | undefined
) {
  if (!context) return undefined;
  const profile = await store.resolve(context.presetId);
  if (!model) throw new Error("请选择可用模型。");
  assertShortAnalysisBudget(context, profile, model);
  return profile;
}
