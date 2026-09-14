import { z } from "zod";
import { LongBookAnalysisIdSchema } from "./long-book-analysis-limits";
import {
  LongBookAnalysisSavedSourceIdSchema,
  LongBookAnalysisSourceKindSchema
} from "./long-book-analysis-sources";
import { LongBookAnalysisSettingsInputSchema } from "./long-book-analysis-presets";
import { EnvelopeBaseSchema } from "./envelope";
export const LongBookAnalysisChooseSourceCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("longBookAnalysis.chooseSource"),
    payload: z.object({ kind: LongBookAnalysisSourceKindSchema })
  });

export const LongBookAnalysisListSourcesCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("longBookAnalysis.listSources"),
    payload: z.object({})
  });

export const LongBookAnalysisLoadSourceCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("longBookAnalysis.loadSource"),
    payload: z.object({ sourceId: LongBookAnalysisSavedSourceIdSchema })
  });

export const LongBookAnalysisSettingsListCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("longBookAnalysisSettings.list"),
    payload: z.object({})
  });

export const LongBookAnalysisSettingsSaveCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("longBookAnalysisSettings.save"),
    payload: LongBookAnalysisSettingsInputSchema
  });

export const LongBookAnalysisSettingsResetCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("longBookAnalysisSettings.reset"),
    payload: z.object({ presetId: LongBookAnalysisIdSchema.optional() })
  });
