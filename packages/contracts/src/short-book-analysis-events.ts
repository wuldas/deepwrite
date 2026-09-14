import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";
import { ShortBookAnalysisResultSchema } from "./short-book-analysis";
import { AgentRuntimeRefSchema } from "./session/runtime";
const Id = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9_-]+$/iu);
export const ShortBookAnalysisResultEventSchema = EnvelopeBaseSchema.extend({
  type: z.literal("short_book_analysis.result_updated"),
  payload: z.object({
    sessionId: z.string().min(1),
    runId: z.string().min(1),
    jobId: Id,
    runtime: AgentRuntimeRefSchema,
    toolCallId: z.string().min(1),
    result: ShortBookAnalysisResultSchema
  })
});
export type ShortBookAnalysisResultEvent = z.infer<
  typeof ShortBookAnalysisResultEventSchema
>;
