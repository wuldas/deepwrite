import type {
  ShortBookAnalysisProfile,
  ShortBookAnalysisRuntimeContext
} from "./short-book-analysis";
export function shortAnalysisTokens(text: string): number {
  let count = 0;
  for (const char of text) count += char.codePointAt(0)! > 127 ? 1.5 : 0.25;
  return Math.ceil(count);
}
/** Conservative estimate includes framework prompt, tool schema, output and safety margin. */
export function assertShortAnalysisBudget(
  context: ShortBookAnalysisRuntimeContext,
  profile: ShortBookAnalysisProfile,
  model: { contextWindow?: number | undefined; maxTokens?: number | undefined }
): void {
  if (profile.selectionMode === "single" && context.books.length !== 1)
    throw new Error("当前预设仅支持选择一本短篇。");
  const input =
    shortAnalysisTokens(profile.systemPrompt) +
    shortAnalysisTokens(JSON.stringify(context.books));
  const available = Math.floor(
    ((model.contextWindow ?? 272_000) - (model.maxTokens ?? 16_000) - 8_000) *
      0.6
  );
  if (input > available)
    throw new Error(
      "所选全文超过当前模型上下文，请减少篇数、缩短文本或选择更大上下文的模型。正文不会被拆分或截断。"
    );
}
