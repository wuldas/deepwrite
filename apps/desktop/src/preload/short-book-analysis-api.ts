import {
  CommandEnvelopeSchema,
  createEnvelope,
  ShortBookAnalysisCatalogSchema,
  ShortBookAnalysisSourceSchema,
  ShortBookAnalysisSourcesSchema,
  ShortBookAnalysisSettingsSchema,
  ShortBookAnalysisSettingsInputSchema,
  ShortBookAnalysisTextInputSchema,
  type ShortBookAnalysisApi,
  type CommandEnvelope
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
async function request(
  type: CommandEnvelope["type"],
  payload: unknown
): Promise<unknown> {
  const id = browserId("short_analysis");
  return invokeCommand(
    CommandEnvelopeSchema.parse(
      createEnvelope(type, payload, { id, correlationId: id })
    )
  );
}
export const shortBookAnalysisApi: ShortBookAnalysisApi = {
  chooseSources: async () =>
    ShortBookAnalysisSourcesSchema.nullable().parse(
      await request("shortBookAnalysis.chooseSources", {})
    ),
  addText: async (input) =>
    ShortBookAnalysisSourceSchema.parse(
      await request(
        "shortBookAnalysis.addText",
        ShortBookAnalysisTextInputSchema.parse(input)
      )
    ),
  sources: {
    list: async () =>
      ShortBookAnalysisCatalogSchema.parse(
        await request("shortBookAnalysis.listSources", {})
      ),
    load: async (sourceId) =>
      ShortBookAnalysisSourceSchema.parse(
        await request("shortBookAnalysis.loadSource", { sourceId })
      )
  },
  presets: {
    list: async () =>
      ShortBookAnalysisSettingsSchema.parse(
        await request("shortBookAnalysisSettings.list", {})
      ),
    save: async (input) =>
      ShortBookAnalysisSettingsSchema.parse(
        await request(
          "shortBookAnalysisSettings.save",
          ShortBookAnalysisSettingsInputSchema.parse(input)
        )
      ),
    reset: async (presetId) =>
      ShortBookAnalysisSettingsSchema.parse(
        await request("shortBookAnalysisSettings.reset", { presetId })
      )
  }
};
