import { createEnvelope, type SystemEventEnvelope } from "@deepwrite/contracts";
import type { AgentRuntimeEvent } from "@deepwrite/pi-runtime-adapter";
import { createId } from "@deepwrite/shared";
type AnalysisEvent = Extract<
  AgentRuntimeEvent,
  {
    type:
      | "short_book_analysis.result_updated"
      | "long_book_analysis.note_updated"
      | "long_book_analysis.result_updated";
  }
>;
export function analysisEventEnvelope(
  event: AnalysisEvent,
  correlationId: string
): SystemEventEnvelope {
  const context = {
    correlationId,
    sessionId: event.sessionId,
    runId: event.runId
  };
  if (event.type === "short_book_analysis.result_updated")
    return createEnvelope(
      event.type,
      { sessionId: event.sessionId, runId: event.runId, ...event.payload },
      { id: createId("evt"), context }
    );
  if (event.type === "long_book_analysis.note_updated") {
    return createEnvelope(
      "long_book_analysis.note_updated",
      {
        sessionId: event.sessionId,
        runId: event.runId,
        toolCallId: event.payload.toolCallId,
        jobId: event.payload.jobId,
        unitId: event.payload.unitId,
        note: event.payload.note,
        runtime: event.payload.runtime
      },
      { id: createId("evt"), context }
    );
  }

  if (event.type === "long_book_analysis.result_updated") {
    return createEnvelope(
      "long_book_analysis.result_updated",
      {
        sessionId: event.sessionId,
        runId: event.runId,
        toolCallId: event.payload.toolCallId,
        jobId: event.payload.jobId,
        unitId: event.payload.unitId,
        result: event.payload.result,
        runtime: event.payload.runtime
      },
      { id: createId("evt"), context }
    );
  }

  throw new Error("未知拆书事件。");
}
