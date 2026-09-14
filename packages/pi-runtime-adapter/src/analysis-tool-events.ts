import { isShortAnalysisToolDetails } from "./short-book-analysis";
import { isLongBookAnalysisToolDetails } from "./long-book-analysis/tools";
import type { AgentRunInput, AgentRuntimeEvent } from "./runtime-types";
import type { AgentRuntimeRef } from "@deepwrite/contracts";
export function analysisToolEvents(
  details: unknown,
  toolCallId: string,
  input: AgentRunInput,
  runtime: AgentRuntimeRef
): AgentRuntimeEvent[] | null {
  const events: AgentRuntimeEvent[] = [];
  if (isShortAnalysisToolDetails(details)) {
    events.push({
      type: "short_book_analysis.result_updated",
      sessionId: input.sessionId,
      runId: input.runId,
      payload: {
        toolCallId: toolCallId,
        jobId: details.jobId,
        result: details.result,
        runtime
      }
    });
  } else if (isLongBookAnalysisToolDetails(details)) {
    events.push(
      details.kind === "long-book-analysis-note"
        ? {
            type: "long_book_analysis.note_updated",
            runId: input.runId,
            sessionId: input.sessionId,
            payload: {
              toolCallId: toolCallId,
              jobId: details.jobId,
              unitId: details.unitId,
              note: details.note,
              runtime
            }
          }
        : {
            type: "long_book_analysis.result_updated",
            runId: input.runId,
            sessionId: input.sessionId,
            payload: {
              toolCallId: toolCallId,
              jobId: details.jobId,
              unitId: details.unitId,
              result: details.result,
              runtime
            }
          }
    );
  } else return null;
  return events;
}
