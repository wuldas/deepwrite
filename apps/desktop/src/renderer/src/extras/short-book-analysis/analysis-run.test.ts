import { describe, it, expect, vi } from "vitest";
import type {
  DeepWriteApi,
  ModelConfig,
  ShortBookAnalysisPreset,
  ShortBookAnalysisSource,
  SessionPromptCommandPayload,
  SystemEventEnvelope
} from "@deepwrite/contracts/renderer";
import { createShortAnalysisRun } from "./analysis-run";
const model = {
  id: "model",
  contextWindow: 100000,
  maxTokens: 16000,
  defaultThinkingLevel: "off",
  thinkingLevelOptions: ["off"]
} as ModelConfig;
const preset: ShortBookAnalysisPreset = {
  id: "preset",
  name: "综合",
  description: "测试",
  systemPrompt: "分析全文",
  selectionMode: "multiple",
  output: { domain: "material", kind: "plot", stageId: "pacing" }
};
const book: ShortBookAnalysisSource = {
  id: "book",
  title: "来信",
  text: "第一章 开始\n第二章 结局",
  kind: "paste",
  importedAt: "2026-01-01T00:00:00.000Z"
};
function fixture() {
  const prompt = vi.fn(async (input: SessionPromptCommandPayload) => ({
    sessionId: input.sessionId,
    runId: `${input.sessionId}-run`,
    acceptedAt: new Date().toISOString()
  }));
  const abort = vi.fn(async () => ({}));
  const api = { session: { prompt, abort } } as unknown as DeepWriteApi;
  return { prompt, abort, run: createShortAnalysisRun(() => api) };
}
function event(
  type: string,
  prompt: SessionPromptCommandPayload,
  body: Record<string, unknown> = {}
): SystemEventEnvelope {
  return {
    type,
    payload: {
      sessionId: prompt.sessionId,
      runId: `${prompt.sessionId}-run`,
      ...body
    }
  } as SystemEventEnvelope;
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
describe("short analysis run", () => {
  it("sends one immutable complete request and publishes only a completed structured result", async () => {
    const f = fixture();
    const books = [{ ...book }, { ...book, id: "book2", title: "第二本" }];
    const mutable = { ...preset };
    f.run.start(books, mutable, model, "off", "");
    const input = f.prompt.mock.calls[0]![0];
    books[0]!.text = "修改";
    mutable.name = "修改";
    expect(input.workspaceContext?.shortBookAnalysis?.books[0]?.text).toBe(
      book.text
    );
    expect(f.run.preset.value?.name).toBe("综合");
    await flush();
    f.run.handleEvent(
      event("long_book_analysis.result_updated", input, {
        result: { title: "错误", body: "来自长篇" }
      })
    );
    expect(f.run.result.value).toBeNull();
    f.run.handleEvent(
      event("short_book_analysis.result_updated", input, {
        jobId: input.workspaceContext!.shortBookAnalysis!.jobId,
        result: { title: "联合结果", body: "分析两本的异同" }
      })
    );
    expect(f.run.result.value).toBeNull();
    f.run.handleEvent(event("agent.message_completed", input));
    expect(f.run.status.value).toBe("completed");
    expect(f.run.result.value?.title).toBe("联合结果");
    expect(f.prompt).toHaveBeenCalledTimes(1);
  });
  it("does not issue requests for oversized or invalid selections", () => {
    const f = fixture();
    expect(() =>
      f.run.start(
        [book, { ...book, id: "b" }],
        { ...preset, selectionMode: "single" },
        model,
        "off",
        ""
      )
    ).toThrow("一本");
    expect(() =>
      f.run.start(
        [{ ...book, text: "文".repeat(200000) }],
        preset,
        model,
        "off",
        ""
      )
    ).toThrow("上下文");
    expect(f.prompt).not.toHaveBeenCalled();
  });
  it("rejects plain model messages and retries the complete task with a fresh session", async () => {
    const f = fixture();
    f.run.start([book], preset, model, "off", "");
    await flush();
    const input = f.prompt.mock.calls[0]![0];
    f.run.handleEvent(
      event("agent.message_completed", input, { content: "普通回复" })
    );
    expect(f.run.status.value).toBe("error");
    expect(f.run.result.value).toBeNull();
    f.run.retry();
    await flush();
    const next = f.prompt.mock.calls[1]![0];
    expect(next.sessionId).not.toBe(input.sessionId);
    expect(next.workspaceContext).toEqual(input.workspaceContext);
    f.run.handleEvent(
      event("short_book_analysis.result_updated", input, {
        jobId: input.workspaceContext!.shortBookAnalysis!.jobId,
        result: { title: "旧结果", body: "旧输出" }
      })
    );
    expect(f.run.result.value).toBeNull();
  });
  it("stops before prompt acceptance and ignores late output", async () => {
    const f = fixture();
    let accept!: (input: Awaited<ReturnType<typeof f.prompt>>) => void;
    f.prompt.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          accept = resolve;
        })
    );
    f.run.start([book], preset, model, "off", "");
    const input = f.prompt.mock.calls[0]![0];
    await f.run.stop();
    expect(f.run.status.value).toBe("stopping");
    accept({
      sessionId: input.sessionId,
      runId: `${input.sessionId}-run`,
      acceptedAt: new Date().toISOString()
    });
    await flush();
    await flush();
    expect(f.abort).toHaveBeenCalledTimes(1);
    expect(f.run.status.value).toBe("stopped");
    f.run.handleEvent(event("agent.message_completed", input));
    expect(f.run.status.value).toBe("stopped");
  });
  it("settles a terminal event arriving while stop is pending", async () => {
    const f = fixture();
    let reject!: (error: Error) => void;
    f.abort.mockImplementationOnce(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise;
        })
    );
    f.run.start([book], preset, model, "off", "");
    await flush();
    const input = f.prompt.mock.calls[0]![0];
    const stop = f.run.stop();
    f.run.handleEvent(event("agent.message_completed", input));
    reject(new Error("Run already ended"));
    await stop;
    expect(f.run.status.value).toBe("stopped");
    expect(f.run.canRetry.value).toBe(true);
  });
  it("reports agent worker restarts instead of remaining busy", async () => {
    const f = fixture();
    f.run.start([book], preset, model, "off", "");
    await flush();
    f.run.handleEvent({
      type: "system.worker_restarting",
      payload: {
        worker: "agent",
        reason: "test restart",
        detectedAt: new Date().toISOString()
      }
    } as SystemEventEnvelope);
    expect(f.run.status.value).toBe("error");
    expect(f.run.error.value).toContain("重启");
    expect(f.run.canRetry.value).toBe(true);
  });
});
