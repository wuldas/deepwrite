import { z } from "zod";
import { LongBookAnalysisPresetSchema } from "./long-book-analysis-presets";
export const ShortBookAnalysisPresetSchema =
  LongBookAnalysisPresetSchema.extend({
    selectionMode: z.enum(["single", "multiple"])
  });
export const ShortBookAnalysisProfileSchema =
  ShortBookAnalysisPresetSchema.omit({ builtin: true });
export const ShortBookAnalysisSettingsInputSchema = z
  .object({ presets: z.array(ShortBookAnalysisProfileSchema).max(50) })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    const names = new Set<string>();
    value.presets.forEach((p, i) => {
      const name = p.name.toLocaleLowerCase("zh-CN");
      if (ids.has(p.id) || names.has(name))
        ctx.addIssue({
          code: "custom",
          path: ["presets", i],
          message: "预设名称和标识不能重复。"
        });
      ids.add(p.id);
      names.add(name);
    });
  });
export const ShortBookAnalysisSettingsSchema = z.object({
  presets: z.array(ShortBookAnalysisPresetSchema).max(50)
});

export type ShortBookAnalysisPreset = z.infer<
  typeof ShortBookAnalysisPresetSchema
>;

export type ShortBookAnalysisProfile = z.infer<
  typeof ShortBookAnalysisProfileSchema
>;

export type ShortBookAnalysisSettingsInput = z.infer<
  typeof ShortBookAnalysisSettingsInputSchema
>;

export type ShortBookAnalysisSettings = z.infer<
  typeof ShortBookAnalysisSettingsSchema
>;
