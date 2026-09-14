import { describe, expect, it } from "vitest";
import {
  buildShortBookAnalysisTools,
  shortAnalysisUserPrompt
} from "./short-book-analysis";
import { PiAgentRuntimeAdapter } from "./adapter";
import {
  ShortBookAnalysisPresetSchema,
  type ShortBookAnalysisRuntimeContext
} from "@deepwrite/contracts";
const profile = ShortBookAnalysisPresetSchema.parse({
  id: "preset",
  name: "短篇剧情",
  description: "测试",
  systemPrompt: "分析全文",
  selectionMode: "multiple",
  output: { domain: "material", kind: "plot", stageId: "pacing" }
});
const context: ShortBookAnalysisRuntimeContext = {
  jobId: "short-job",
  presetId: profile.id,
  books: [
    {
      id: "a",
      title: "来信",
      text: "第一章 来信\n整篇正文".repeat(2000),
      kind: "paste",
      importedAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "b",
      title: "归来",
      text: "第二篇完整正文",
      kind: "paste",
      importedAt: "2026-01-01T00:00:00.000Z"
    }
  ]
};
describe("short analysis runtime", () => {
  it("injects every complete body and provides only the result tool", () => {
    const text = shortAnalysisUserPrompt(context);
    const books = JSON.parse(text.slice(text.indexOf("["))) as Array<{
      text: string;
    }>;
    expect(books.map((b) => b.text)).toEqual(context.books.map((b) => b.text));
    expect(buildShortBookAnalysisTools(context).map((t) => t.name)).toEqual([
      "write_analysis_result"
    ]);
  });
  it("requires a valid result and disallows a second result", async () => {
    const tool = buildShortBookAnalysisTools(context)[0]!;
    await expect(
      tool.execute("call", { title: "", body: "" })
    ).rejects.toThrow();
    const result = await tool.execute("call", {
      title: "综合分析",
      body: "完整结果"
    });
    expect(result.details).toMatchObject({
      kind: "short-book-analysis-result",
      jobId: context.jobId
    });
    await expect(
      tool.execute("again", { title: "重复", body: "结果" })
    ).rejects.toThrow("一份");
  });
  it("completes the faux lifecycle with a single isolated short result", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    const events = [];
    for await (const event of runtime.start({
      runId: "run",
      sessionId: "short-session",
      prompt: "分析",
      workspaceContext: {
        shortBookAnalysis: {
          ...context,
          books: context.books.map((b) => ({
            ...b,
            text: b.text.slice(0, 100)
          }))
        }
      },
      shortBookAnalysisProfile: profile
    })) {
      events.push(event);
    }
    expect(
      events.filter((e) => e.type === "short_book_analysis.result_updated")
    ).toHaveLength(1);
    expect(events.some((e) => e.type === "agent.completed")).toBe(true);
    expect(events.some((e) => e.type.startsWith("long_book_analysis."))).toBe(
      false
    );
  });
});
