import type {
  SessionPromptCommandPayload,
  ModelUsageModule
} from "@deepwrite/contracts";
export function usageModuleForPrompt(
  payload: SessionPromptCommandPayload
): ModelUsageModule {
  if (payload.mode === "chat-assistant") return "assistant-chat";
  const context = payload.workspaceContext;
  if (!context) return "unknown";
  if (context.shortWorkspace) return "short-writing";
  if (context.scriptWorkspace) return "script-writing";
  if (context.longWorkspace) return "long-writing";
  if (context.libraryWorkspace) {
    return context.libraryWorkspace.domain === "skill"
      ? "skill-library"
      : "material-library";
  }
  if (context.learningImitation) return "learning-imitation";
  if (context.longBookAnalysis) return "long-book-analysis";
  if (context.shortBookAnalysis) return "short-book-analysis";
  if (context.subagentAuthoring) return "subagent-authoring";
  return "unknown";
}
