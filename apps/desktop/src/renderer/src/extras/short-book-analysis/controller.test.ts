import { it, expect, vi } from "vitest";
import { effectScope } from "vue";
import type {
  DeepWriteApi,
  ModelConfig,
  ShortBookAnalysisPreset,
  ShortBookAnalysisSource
} from "@deepwrite/contracts/renderer";
import { useShortBookAnalysis } from "./useShortBookAnalysis";
const preset: ShortBookAnalysisPreset = {
  id: "preset",
  name: "分析",
  description: "测试",
  systemPrompt: "分析",
  selectionMode: "multiple",
  output: { domain: "material", kind: "plot", stageId: "pacing" }
};
const book = (i: number): ShortBookAnalysisSource => ({
  id: `book-${i}`,
  title: `测试${i}`,
  text: "完整正文",
  kind: "paste",
  importedAt: "2026-01-01T00:00:00.000Z"
});
it("retains selections on preset change, enforces ten and saves edited results through catalog", async () => {
  const scope = effectScope();
  const createLibraryEntry = vi.fn(async () => ({}));
  const api = {
    catalog: { createLibraryEntry },
    shortBookAnalysis: {
      presets: {
        list: async () => ({
          presets: [
            preset,
            { ...preset, id: "single", selectionMode: "single" }
          ]
        })
      }
    },
    session: {
      prompt: vi.fn(async () => ({ runId: "run" })),
      abort: vi.fn(async () => ({}))
    }
  } as unknown as DeepWriteApi;
  const c = scope.run(() => useShortBookAnalysis({ api: () => api }))!;
  try {
    await c.loadPresets();
    c.drafts.value = Array.from({ length: 11 }, (_, i) => book(i));
    for (let i = 0; i < 10; i++) c.toggleBook(`book-${i}`);
    expect(c.selectionValid.value).toBe(true);
    expect(() => c.toggleBook("book-10")).toThrow("10");
    c.selectedPresetId.value = "single";
    expect(() => c.toggleBook("book-10")).toThrow("仅支持一本");
    expect(c.selectedIds.value).toHaveLength(10);
    expect(c.selectionValid.value).toBe(false);
    c.selectedPresetId.value = "preset";
    c.updateBook("book-0", { title: "测试0", text: "" });
    expect(c.selectionValid.value).toBe(false);
    expect(c.drafts.value[0]?.text).toBe("");
    c.updateBook("book-0", { title: "测试0", text: "完整正文" });
    c.setConfiguredModels([
      {
        id: "model",
        defaultThinkingLevel: "off",
        thinkingLevelOptions: ["off"],
        contextWindow: 100000,
        maxTokens: 16000
      } as ModelConfig
    ]);
    c.start();
    expect(() =>
      c.updateBook("book-0", { title: "修改", text: "修改" })
    ).toThrow("正在处理");
    expect(() => c.toggleBook("book-0")).toThrow();
    c.status.value = "completed";
    c.result.value = { title: "已编辑结果", body: "整理后的综合分析" };
    await c.persistResult({ libraryId: "library", baseProjectRevision: 7 });
    expect(createLibraryEntry).toHaveBeenCalledWith({
      domain: "material",
      libraryId: "library",
      title: "已编辑结果",
      content: "整理后的综合分析",
      stageId: "pacing",
      baseProjectRevision: 7
    });
  } finally {
    c.dispose();
    scope.stop();
  }
});
