import type {
  AgentProviderRuntimeConfig,
  CommandEnvelope,
  WorkspaceRuntimeContext
} from "@deepwrite/contracts";
import { LongBookAnalysisConfigStore } from "./long-book-analysis/config-store";
import { handleLongBookAnalysisCommands } from "./long-book-analysis/commands";
import { ShortBookAnalysisConfigStore } from "./short-book-analysis/config-store";
import {
  handleShortBookAnalysisCommands,
  type ShortAnalysisCommandContext
} from "./short-book-analysis/commands";
import { resolveShortAnalysisProfile } from "./short-book-analysis/run-profile";
/** Main owns preset resolution; source snapshot writes are delegated to Core. */
export function createBookAnalysisServices(userDataPath: string) {
  const long = new LongBookAnalysisConfigStore(userDataPath);
  const short = new ShortBookAnalysisConfigStore(userDataPath);
  return {
    async handle(
      context: Omit<ShortAnalysisCommandContext, "configStore">,
      command: CommandEnvelope
    ) {
      return (
        (await handleShortBookAnalysisCommands(
          { ...context, configStore: () => short },
          command
        )) ??
        handleLongBookAnalysisCommands(
          { ...context, configStore: () => long },
          command
        )
      );
    },
    async resolve(
      context: WorkspaceRuntimeContext | undefined,
      model: AgentProviderRuntimeConfig | undefined
    ) {
      const shortBookAnalysisProfile = await resolveShortAnalysisProfile(
        context?.shortBookAnalysis,
        short,
        model
      );
      const longBookAnalysisProfile = context?.longBookAnalysis
        ? await long.resolve(context.longBookAnalysis.presetId)
        : undefined;
      return {
        ...(shortBookAnalysisProfile ? { shortBookAnalysisProfile } : {}),
        ...(longBookAnalysisProfile ? { longBookAnalysisProfile } : {})
      };
    }
  };
}
