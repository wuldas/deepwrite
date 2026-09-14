import {
  type LongBookAnalysisSavedSourceCatalog,
  LongBookAnalysisSavedSourceCatalogSchema,
  LongBookAnalysisSavedSourceIdSchema,
  type LongBookAnalysisSettings,
  type LongBookAnalysisSettingsInput,
  LongBookAnalysisSettingsInputSchema,
  LongBookAnalysisSettingsSchema,
  type LongBookAnalysisSource,
  type LongBookAnalysisSourceKind,
  LongBookAnalysisSourceKindSchema,
  LongBookAnalysisSourceSchema,
  createEnvelope
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
export async function chooseLongBookAnalysisSource(
  rawKind: LongBookAnalysisSourceKind
): Promise<LongBookAnalysisSource | null> {
  const kind = LongBookAnalysisSourceKindSchema.parse(rawKind);
  const id = browserId("cmd_long_book_analysis_choose_source");
  return LongBookAnalysisSourceSchema.nullable().parse(
    await invokeCommand<LongBookAnalysisSource | null>(
      createEnvelope(
        "longBookAnalysis.chooseSource",
        { kind },
        { id, correlationId: id }
      )
    )
  );
}

export async function listLongBookAnalysisSources(): Promise<LongBookAnalysisSavedSourceCatalog> {
  const id = browserId("cmd_long_book_analysis_sources_list");
  return LongBookAnalysisSavedSourceCatalogSchema.parse(
    await invokeCommand<LongBookAnalysisSavedSourceCatalog>(
      createEnvelope(
        "longBookAnalysis.listSources",
        {},
        { id, correlationId: id }
      )
    )
  );
}

export async function loadLongBookAnalysisSource(
  rawSourceId: string
): Promise<LongBookAnalysisSource> {
  const sourceId = LongBookAnalysisSavedSourceIdSchema.parse(rawSourceId);
  const id = browserId("cmd_long_book_analysis_source_load");
  return LongBookAnalysisSourceSchema.parse(
    await invokeCommand<LongBookAnalysisSource>(
      createEnvelope(
        "longBookAnalysis.loadSource",
        { sourceId },
        { id, correlationId: id }
      )
    )
  );
}

export async function listLongBookAnalysisPresets(): Promise<LongBookAnalysisSettings> {
  const id = browserId("cmd_long_book_analysis_presets_list");
  return LongBookAnalysisSettingsSchema.parse(
    await invokeCommand<LongBookAnalysisSettings>(
      createEnvelope(
        "longBookAnalysisSettings.list",
        {},
        { id, correlationId: id }
      )
    )
  );
}

export async function saveLongBookAnalysisPresets(
  rawSettings: LongBookAnalysisSettingsInput
): Promise<LongBookAnalysisSettings> {
  const settings = LongBookAnalysisSettingsInputSchema.parse(rawSettings);
  const id = browserId("cmd_long_book_analysis_presets_save");
  return LongBookAnalysisSettingsSchema.parse(
    await invokeCommand<LongBookAnalysisSettings>(
      createEnvelope("longBookAnalysisSettings.save", settings, {
        id,
        correlationId: id
      })
    )
  );
}

export async function resetLongBookAnalysisPresets(
  presetId?: string
): Promise<LongBookAnalysisSettings> {
  const id = browserId("cmd_long_book_analysis_presets_reset");
  return LongBookAnalysisSettingsSchema.parse(
    await invokeCommand<LongBookAnalysisSettings>(
      createEnvelope(
        "longBookAnalysisSettings.reset",
        { ...(presetId ? { presetId } : {}) },
        { id, correlationId: id }
      )
    )
  );
}
