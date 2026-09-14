import type { DeepWriteApi } from "@deepwrite/contracts";
import { useLazyLongBookAnalysisController } from "./useLazyFeatureControllers";
import { useLazyShortBookAnalysisController } from "./useLazyShortBookAnalysis";
export function useBookAnalysisFeatures(api: () => DeepWriteApi | undefined) {
  const longBookAnalysisFeature = useLazyLongBookAnalysisController({ api });
  const shortBookAnalysisFeature = useLazyShortBookAnalysisController({ api });
  return {
    longBookAnalysisFeature,
    shortBookAnalysisFeature,
    longBookAnalysisRunning: longBookAnalysisFeature.isBusy,
    shortBookAnalysisRunning: shortBookAnalysisFeature.isBusy
  };
}
