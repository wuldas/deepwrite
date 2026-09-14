import { computed, ref, shallowRef } from "vue";
import { createId } from "@deepwrite/shared";
import {
  assertShortAnalysisBudget,
  ShortBookAnalysisRuntimeContextSchema,
  type DeepWriteApi,
  type ModelConfig,
  type ShortBookAnalysisPreset,
  type ShortBookAnalysisResult,
  type ShortBookAnalysisSource,
  type SystemEventEnvelope,
  type ThinkingLevel
} from "@deepwrite/contracts/renderer";
interface Job {
  context: ReturnType<typeof ShortBookAnalysisRuntimeContextSchema.parse>;
  preset: ShortBookAnalysisPreset;
  model: ModelConfig;
  thinkingLevel: ThinkingLevel;
  libraryId: string;
}
export function createShortAnalysisRun(api: () => DeepWriteApi) {
  const status = ref<
    "idle" | "running" | "stopping" | "stopped" | "error" | "completed"
  >("idle");
  const result = ref<ShortBookAnalysisResult | null>(null);
  const preset = shallowRef<ShortBookAnalysisPreset | null>(null);
  const targetLibraryId = ref("");
  const error = ref<string | null>(null);
  const liveOutput = ref("");
  const activity = ref("等待开始");
  const entries = ref<string[]>([]);
  const isBusy = computed(
    () => status.value === "running" || status.value === "stopping"
  );
  let job: Job | null = null;
  let pending: {
    sessionId: string;
    runId?: string;
    result?: ShortBookAnalysisResult;
  } | null = null;
  let disposed = false;
  const stopping = () => status.value === "stopping";
  const canRetry = computed(
    () => status.value === "stopped" || status.value === "error"
  );
  function log(message: string) {
    activity.value = message;
    entries.value.push(message);
  }
  function clear() {
    if (isBusy.value) throw new Error("分析运行中，不能修改输入。");
    job = null;
    result.value = null;
    preset.value = null;
    status.value = "idle";
    error.value = null;
    entries.value = [];
    liveOutput.value = "";
    activity.value = "等待开始";
  }
  function fail(cause: unknown) {
    status.value = "error";
    error.value = cause instanceof Error ? cause.message : "短篇拆书失败。";
    log(error.value);
    pending = null;
  }
  async function execute() {
    if (!job || disposed) return;
    const current = job;
    assertShortAnalysisBudget(current.context, current.preset, current.model);
    status.value = "running";
    error.value = null;
    result.value = null;
    liveOutput.value = "";
    entries.value = [];
    log(`正在联合分析 ${current.context.books.length} 本短篇`);
    const unit: {
      sessionId: string;
      runId?: string;
      result?: ShortBookAnalysisResult;
    } = { sessionId: createId("short_analysis_session") };
    pending = unit;
    try {
      const accepted = await api().session.prompt({
        sessionId: unit.sessionId,
        message: "基于全部所选短篇全文，按预设生成一份完整综合分析。",
        modelId: current.model.id,
        thinkingLevel: current.thinkingLevel,
        writeApprovalMode: "request-approval",
        workspaceContext: { shortBookAnalysis: current.context }
      });
      if (pending !== unit) {
        if (disposed)
          await api().session.abort({
            sessionId: unit.sessionId,
            runId: accepted.runId
          });
        return;
      }
      unit.runId = accepted.runId;
      if (stopping()) await abortPending();
    } catch (cause) {
      if (pending === unit && !disposed) {
        if (stopping()) {
          pending = null;
          status.value = "stopped";
          log("已停止，可重新分析");
        } else fail(cause);
      }
    }
  }
  async function abortPending() {
    const unit = pending;
    if (!unit?.runId) return;
    try {
      await api().session.abort({
        sessionId: unit.sessionId,
        runId: unit.runId
      });
      if (pending === unit) {
        pending = null;
        status.value = "stopped";
        log("已停止，可重新分析");
      }
    } catch (cause) {
      if (pending === unit) {
        status.value = "running";
        error.value =
          cause instanceof Error ? cause.message : "停止失败，请重试。";
        log(error.value);
      }
    }
  }
  function start(
    books: ShortBookAnalysisSource[],
    selectedPreset: ShortBookAnalysisPreset,
    model: ModelConfig,
    thinkingLevel: ThinkingLevel,
    libraryId: string
  ) {
    if (isBusy.value) throw new Error("分析正在运行。");
    if (
      thinkingLevel !== "off" &&
      !model.thinkingLevelOptions.includes(thinkingLevel)
    )
      throw new Error("请选择当前模型支持的思考等级。");
    const context = ShortBookAnalysisRuntimeContextSchema.parse({
      jobId: createId("short_analysis_job"),
      presetId: selectedPreset.id,
      books
    });
    assertShortAnalysisBudget(context, selectedPreset, model);
    const snapshot = JSON.parse(
      JSON.stringify({
        context,
        preset: selectedPreset,
        model,
        thinkingLevel,
        libraryId
      })
    ) as Job;
    job = snapshot;
    preset.value = snapshot.preset;
    targetLibraryId.value = libraryId;
    void execute();
  }
  function handleEvent(event: SystemEventEnvelope) {
    const unit = pending;
    if (!unit || disposed) return;
    if (
      (event.type === "system.worker_restarting" ||
        event.type === "system.worker_restarted") &&
      event.payload.worker === "agent"
    ) {
      fail(new Error("分析进程已重启，请重新分析。"));
      return;
    }
    if (
      !("sessionId" in event.payload) ||
      event.payload.sessionId !== unit.sessionId
    )
      return;
    if ("runId" in event.payload) {
      if (unit.runId && event.payload.runId !== unit.runId) return;
      unit.runId = event.payload.runId;
    }
    if (stopping()) {
      if (
        event.type === "agent.message_completed" ||
        event.type === "agent.error"
      ) {
        pending = null;
        status.value = "stopped";
        log("已停止，可重新分析");
      }
      return;
    }
    if (event.type === "agent.message_delta")
      liveOutput.value = (liveOutput.value + event.payload.delta).slice(
        -200000
      );
    else if (event.type === "agent.thinking_delta")
      activity.value = "模型正在思考";
    else if (event.type === "tool.call_requested") log("正在生成结构化结果");
    else if (
      event.type === "short_book_analysis.result_updated" &&
      event.payload.jobId === job?.context.jobId
    )
      unit.result = event.payload.result;
    else if (event.type === "agent.error")
      fail(new Error(event.payload.message));
    else if (event.type === "agent.message_completed") {
      if (!unit.result) {
        fail(new Error("模型未提交结构化结果，请重新分析。"));
        return;
      }
      result.value = unit.result;
      pending = null;
      status.value = "completed";
      log("分析完成，结果可编辑并保存");
    }
  }
  return {
    status,
    result,
    preset,
    targetLibraryId,
    error,
    liveOutput,
    activity,
    entries,
    isBusy,
    canRetry,
    clear,
    start,
    handleEvent,
    retry() {
      if (canRetry.value && !isBusy.value) void execute();
    },
    async stop() {
      if (!isBusy.value) return;
      status.value = "stopping";
      log("正在停止");
      await abortPending();
    },
    dispose() {
      disposed = true;
      const unit = pending;
      pending = null;
      if (unit?.runId)
        void api()
          .session.abort({ sessionId: unit.sessionId, runId: unit.runId })
          .catch(() => undefined);
    }
  };
}
