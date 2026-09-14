import { z } from "zod";
import {
  LONG_BOOK_ANALYSIS_MAX_PERSISTED_PRESETS,
  LONG_BOOK_ANALYSIS_MAX_PROMPT_CHARACTERS,
  LongBookAnalysisIdSchema,
  LongBookAnalysisLibraryIdSchema
} from "./long-book-analysis-limits";
import {
  MaterialKindSchema,
  MaterialStageIdSchema,
  SkillKindSchema,
  SkillStageIdSchema
} from "./catalog";
export const LongBookAnalysisOutputSchema = z.discriminatedUnion("domain", [
  z.object({
    domain: z.literal("material"),
    kind: MaterialKindSchema,
    stageId: MaterialStageIdSchema,
    libraryId: LongBookAnalysisLibraryIdSchema.optional()
  }),
  z.object({
    domain: z.literal("skill"),
    kind: SkillKindSchema,
    stageId: SkillStageIdSchema,
    libraryId: LongBookAnalysisLibraryIdSchema.optional()
  })
]);
export type LongBookAnalysisOutput = z.infer<
  typeof LongBookAnalysisOutputSchema
>;

export const LongBookAnalysisPresetSchema = z.object({
  id: LongBookAnalysisIdSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  systemPrompt: z
    .string()
    .trim()
    .min(1)
    .max(LONG_BOOK_ANALYSIS_MAX_PROMPT_CHARACTERS),
  output: LongBookAnalysisOutputSchema,
  builtin: z.boolean().optional()
});
export type LongBookAnalysisPreset = z.infer<
  typeof LongBookAnalysisPresetSchema
>;

function validatePresetList(
  presets: readonly LongBookAnalysisPreset[],
  context: z.core.$RefinementCtx<unknown>
): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  presets.forEach((preset, index) => {
    if (ids.has(preset.id)) {
      context.addIssue({
        code: "custom",
        path: [index, "id"],
        message: "Long-book analysis preset ids must be unique."
      });
    }
    ids.add(preset.id);
    const comparableName = preset.name.trim().toLocaleLowerCase("zh-CN");
    if (names.has(comparableName)) {
      context.addIssue({
        code: "custom",
        path: [index, "name"],
        message: "Long-book analysis preset names must be unique."
      });
    }
    names.add(comparableName);
  });
}

export const LongBookAnalysisSettingsInputSchema = z
  .object({
    presets: z
      .array(LongBookAnalysisPresetSchema.omit({ builtin: true }))
      .max(LONG_BOOK_ANALYSIS_MAX_PERSISTED_PRESETS)
  })
  .superRefine((value, context) => validatePresetList(value.presets, context));
export type LongBookAnalysisSettingsInput = z.infer<
  typeof LongBookAnalysisSettingsInputSchema
>;

export const LongBookAnalysisSettingsSchema = z
  .object({
    presets: z
      .array(LongBookAnalysisPresetSchema)
      .max(LONG_BOOK_ANALYSIS_MAX_PERSISTED_PRESETS),
    updatedAt: z.string().datetime().optional()
  })
  .superRefine((value, context) => validatePresetList(value.presets, context));
export type LongBookAnalysisSettings = z.infer<
  typeof LongBookAnalysisSettingsSchema
>;

export const LongBookAnalysisAgentProfileSchema =
  LongBookAnalysisPresetSchema.pick({
    id: true,
    name: true,
    description: true,
    systemPrompt: true,
    output: true
  });
export type LongBookAnalysisAgentProfile = z.infer<
  typeof LongBookAnalysisAgentProfileSchema
>;
