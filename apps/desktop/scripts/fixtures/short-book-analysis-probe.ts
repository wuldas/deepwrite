import { createApp, h, nextTick, ref } from "vue";
import ShortBookAnalysisPage from "../../src/renderer/src/extras/short-book-analysis/ShortBookAnalysisPage.vue";
import { useShortBookAnalysis } from "../../src/renderer/src/extras/short-book-analysis/useShortBookAnalysis";
import {
  applyAppearanceThemeToDocument,
  defaultAppearanceTheme
} from "../../src/renderer/src/composables/appearanceThemeRuntime";
import {
  ShortBookAnalysisPresetSchema,
  type DeepWriteApi,
  type ModelConfig,
  type SessionPromptCommandPayload,
  type SystemEventEnvelope
} from "@deepwrite/contracts/renderer";
import "../../src/renderer/src/styles.css";
// Exercise the feature at the width available inside the workspace shell.
document.body.style.minWidth = "0";
document.body.style.margin = "0";
const presets = [
  ShortBookAnalysisPresetSchema.parse({
    id: "plot",
    name: "剧情结构",
    description: "联合拆解冲突、反转与结尾，比较多篇的异同。",
    systemPrompt: "分析短篇结构",
    selectionMode: "multiple",
    output: { domain: "material", kind: "plot", stageId: "pacing" }
  }),
  ShortBookAnalysisPresetSchema.parse({
    id: "single",
    name: "人物",
    description: "提炼人物目标与选择。",
    systemPrompt: "分析人物",
    selectionMode: "single",
    output: { domain: "material", kind: "character", stageId: "character" }
  })
];
const models = [
  {
    id: "model",
    label: "验证模型",
    provider: "test",
    modelId: "test",
    api: "openai-completions",
    baseUrl: "https://example.test",
    reasoning: false,
    defaultThinkingLevel: "off",
    thinkingLevelOptions: ["off"],
    contextWindow: 100000,
    maxTokens: 16000
  }
] as ModelConfig[];
const sources = Array.from({ length: 11 }, (_, i) => ({
  id: `book-${i}`,
  title: `${i + 1} · 雨夜来信与归途`,
  text: "第一章 来信\n雨夜里，她收到一封迟到的来信。\n第二章 归来\n她决定回到故乡，面对那个未曾兑现的承诺。",
  kind: "paste" as const,
  importedAt: "2026-01-01T00:00:00.000Z"
}));
let request: SessionPromptCommandPayload | undefined;
const api = {
  shortBookAnalysis: {
    presets: {
      list: async () => ({ presets }),
      save: async (input: unknown) => input,
      reset: async () => ({ presets })
    },
    sources: {
      list: async () => ({
        sources: sources.map(({ text, ...s }) => ({
          ...s,
          characterCount: text.length
        }))
      }),
      load: async (id: string) => sources.find((s) => s.id === id)
    },
    addText: async (input: { title: string; text: string }) => ({
      ...sources[0],
      ...input,
      id: "pasted"
    }),
    chooseSources: async () => [sources[0]]
  },
  session: {
    prompt: async (input: SessionPromptCommandPayload) => {
      request = input;
      return { sessionId: input.sessionId, runId: "probe-run" };
    },
    abort: async () => ({})
  }
} as unknown as DeepWriteApi;
const c = useShortBookAnalysis({ api: () => api });
c.setConfiguredModels(models);
c.drafts.value = sources;
c.activeId.value = "book-0";
const visible = ref(true);
createApp({
  render: () =>
    visible.value
      ? h(ShortBookAnalysisPage, {
          controller: c,
          models,
          catalogSnapshot: null
        })
      : h("p", "其他页面")
}).mount("#app");
const frame = async () => {
  await nextTick();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
};
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
function button(text: string) {
  const el = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button")
  ).find((b) => b.textContent?.trim() === text);
  if (!el) throw new Error(`Missing button ${text}`);
  return el;
}
function emit(type: string, payload: Record<string, unknown> = {}) {
  check(request, "Expected a model request");
  c.handleEvent({
    type,
    payload: { sessionId: request!.sessionId, runId: "probe-run", ...payload }
  } as SystemEventEnvelope);
}
async function run() {
  await frame();
  c.drafts.value = [];
  await frame();
  check(
    document.querySelector(".analysis-empty-source"),
    "Empty state matches analysis layout"
  );
  button("导入文本").click();
  await frame();
  check(c.drafts.value.length === 1, "Header imports complete text");
  button("粘贴文本").click();
  await frame();
  const pasteDialog = document.querySelector<HTMLElement>(
    ".short-paste-dialog"
  )!;
  const titleInput = pasteDialog.querySelector<HTMLInputElement>("input")!;
  const textInput = pasteDialog.querySelector<HTMLTextAreaElement>("textarea")!;
  titleInput.value = "虚构短篇";
  textInput.value = "第一章\n一封虚构来信。\n第二章\n一个新的选择。";
  titleInput.dispatchEvent(new Event("input", { bubbles: true }));
  textInput.dispatchEvent(new Event("input", { bubbles: true }));
  button("添加短篇").click();
  await frame();
  check(
    c.drafts.value.some(
      (book) => book.id === "pasted" && book.text === textInput.value
    ),
    "Header paste retains full text"
  );
  document
    .querySelector<HTMLButtonElement>('[aria-label="已保存短篇"]')!
    .click();
  await frame();
  const option = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="option"]')
  ).find((el) => el.textContent?.includes(sources[2]!.title))!;
  option.click();
  await frame();
  check(
    c.drafts.value.some((book) => book.id === "book-2") &&
      c.activeId.value === "book-2",
    "Saved source loads directly from header"
  );
  c.drafts.value = [...sources];
  c.activeId.value = "book-0";
  for (let i = 0; i < 10; i++) c.toggleBook(`book-${i}`);
  await frame();
  check(
    document.querySelector<HTMLInputElement>(
      '[aria-label="选择 11 · 雨夜来信与归途"]'
    )?.disabled,
    "Eleventh book is disabled"
  );
  c.selectedPresetId.value = "single";
  await frame();
  check(
    button("执行“人物”预设").disabled && c.selectedIds.value.length === 10,
    "Single mode retains selection and blocks run"
  );
  c.selectedPresetId.value = "plot";
  await frame();
  button("执行“剧情结构”预设").click();
  await frame();
  check(
    request?.workspaceContext?.shortBookAnalysis?.books.length === 10,
    "Ten complete texts submitted"
  );
  visible.value = false;
  await frame();
  emit("short_book_analysis.result_updated", {
    jobId: request!.workspaceContext!.shortBookAnalysis!.jobId,
    result: {
      title: "综合分析",
      body: "# 核心发现\n\n两篇都通过迟到的消息引出人物选择，结尾呈现不同代价。"
    }
  });
  emit("agent.message_completed");
  visible.value = true;
  await frame();
  check(
    document.querySelector('[aria-label="Markdown 结果正文"]'),
    "Background result survives page change"
  );
  document
    .querySelector<HTMLButtonElement>('[aria-label="管理拆书预设"]')!
    .click();
  await frame();
  check(
    document.querySelector('[aria-label="可选择书本数量"]'),
    "Selection mode is configurable"
  );
  document
    .querySelector<HTMLButtonElement>(
      '[role="combobox"][aria-label="可选择书本数量"]'
    )!
    .click();
  await frame();
  const menu = document.querySelector<HTMLElement>(
    '[role="listbox"][aria-label="可选择书本数量"]'
  )!;
  check(
    menu && Number(getComputedStyle(menu).zIndex) >= 3200,
    "Preset menu renders above modal"
  );
  document
    .querySelector<HTMLButtonElement>(
      '[role="combobox"][aria-label="可选择书本数量"]'
    )!
    .click();
  await frame();
  button("取消").click();
  await frame();
  return { passed: true, checks: 10 };
}
async function show(
  scheme: "light" | "dark",
  size: number,
  modal: boolean,
  state = "page"
) {
  if (state === "empty") {
    c.clear();
    c.drafts.value = [];
    c.selectedIds.value = [];
  }
  applyAppearanceThemeToDocument({
    scheme,
    theme: {
      ...defaultAppearanceTheme(scheme),
      uiFontSize: size,
      accent: "#8a4bc2"
    },
    uiFontFamily: "system",
    editorFontFamily: "song"
  });
  await frame();
  if (modal)
    document
      .querySelector<HTMLButtonElement>('[aria-label="管理拆书预设"]')!
      .click();
  else
    document.querySelector<HTMLButtonElement>('[aria-label="关闭"]')?.click();
  await frame();
  const el = document.querySelector<HTMLElement>(
    modal ? ".analysis-preset-modal" : ".short-book-analysis-page"
  )!;
  const page = document.querySelector<HTMLElement>(
    ".short-book-analysis-page"
  )!;
  page.scrollTop = 0;
  if (state === "setup")
    document.querySelector(".setup-card")!.scrollIntoView({ block: "start" });
  await frame();
  check(el.scrollWidth <= el.clientWidth + 1, "No horizontal page overflow");
  check(
    el.getBoundingClientRect().right <= innerWidth,
    "Feature fits available width"
  );
  if (modal) {
    const rect = el.getBoundingClientRect();
    check(rect.left >= 0 && rect.right <= innerWidth, "Modal fits viewport");
  }
  return {
    scheme,
    size,
    modal,
    width: innerWidth,
    height: innerHeight,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth
  };
}
Object.assign(window, {
  runShortAnalysisProbe: run,
  showShortAnalysisProbe: show
});
