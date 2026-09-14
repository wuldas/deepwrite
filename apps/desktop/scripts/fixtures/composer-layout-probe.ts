import { createApp, h, nextTick, ref } from "vue";
import { createPinia } from "pinia";
import ConversationComposer from "../../src/renderer/src/components/ConversationComposer.vue";
import type { AgentApprovalMode } from "../../src/renderer/src/types/conversation";
import "../../src/renderer/src/styles.css";
import {
  applyAppearanceThemeToDocument,
  defaultAppearanceTheme
} from "../../src/renderer/src/composables/appearanceThemeRuntime";

const responding = ref(false);
const approvalMode = ref<AgentApprovalMode>("request-approval");
let sent = 0;
let stopped = 0;
const app = createApp({
  render: () =>
    h("section", { class: "conversation-pane" }, [
      h("header", "聊天栏布局验证"),
      h("div"),
      h(ConversationComposer, {
        draft: "用于布局验证的虚构消息",
        responding: responding.value,
        canSend: true,
        canSendAttachments: true,
        canStop: true,
        runtimeAvailable: true,
        currentSessionId: "layout-probe",
        messages: [],
        messagesEmpty: true,
        bookTitle: "用于验证长标题省略的虚构测试作品",
        stageLabel: "剧情",
        selectedModelId: "test-model",
        selectedModel: undefined,
        thinkingLevel: "off",
        temperature: 0.7,
        approvalMode: approvalMode.value,
        agentTeamMode: "normal",
        agentId: "short",
        agentWorkspaceType: "short",
        libraryDomain: undefined,
        availableSkills: [],
        availableMaterials: [],
        editorReferences: [],
        modelOptions: [
          { value: "test-model", label: "Very long test model name for layout" }
        ],
        availableThinkingOptions: [{ value: "off", label: "关闭" }],
        webSearchEnabled: true,
        webSearchAvailable: true,
        webSearchDisabledReason: "",
        showsTemperature: false,
        temperatureSelectOptions: [{ value: 0.7, label: "0.7" }],
        approvalOptions: [
          {
            value: "request-approval",
            label: "逐次审批",
            description: "修改前确认"
          },
          {
            value: "auto-approve",
            label: "替我审批",
            description: "自动处理修改"
          }
        ],
        approvalModeIcon: "check",
        onSelectApproval: (mode) => {
          approvalMode.value = mode;
        },
        onSend: () => {
          sent++;
        },
        onStop: () => {
          stopped++;
        }
      })
    ])
});
app.use(createPinia());
app.mount("#app");

const frames = async () => {
  await nextTick();
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
};
const element = (selector: string) => {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
};
const check = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const click = async (selector: string) => {
  element(selector).click();
  await frames();
};
const visible = (selector: string) =>
  element(selector).getClientRects().length > 0;

async function runComposerProbe() {
  const samples = [];
  for (const theme of ["light", "dark"] as const)
    for (const fontSize of [10, 14, 24])
      for (const width of [
        800, 320, 800, 390, 420, 500, 560, 600, 640, 800, 1100
      ]) {
        applyAppearanceThemeToDocument({
          scheme: theme,
          theme: {
            ...defaultAppearanceTheme(theme),
            uiFontSize: fontSize,
            accent: "#b35a22"
          },
          uiFontFamily: "system",
          editorFontFamily: "song"
        });
        element(".conversation-pane").style.width = `${width}px`;
        await frames();
        const pane = element(".conversation-pane").getBoundingClientRect();
        const model = element(
          ".conversation-model-config-trigger"
        ).getBoundingClientRect();
        const send = element(".send-button").getBoundingClientRect();
        const voice = element(
          '[aria-label="语音输入"]'
        ).getBoundingClientRect();
        check(
          visible('[aria-label="语音输入"]') &&
            voice.width === 30 &&
            voice.left >= model.right &&
            voice.right <= send.left,
          `Voice button hidden or overlapping: ${theme}/${fontSize}/${width}`
        );
        check(
          send.right <= pane.right && send.left >= pane.left,
          `Send clipped: ${theme}/${fontSize}/${width}`
        );
        check(
          model.right <= send.left && model.width > 25,
          `Model overlaps send: ${fontSize}/${width}`
        );
        check(
          element(".composer-toolbar").scrollWidth <=
            element(".composer-toolbar").clientWidth + 1,
          `Toolbar overflow: ${fontSize}/${width}`
        );
        const compact = visible(".composer-more-trigger");
        if (width >= 600) {
          check(
            !compact,
            `Wide composer stayed folded: ${theme}/${fontSize}/${width}`
          );
          check(
            visible(".composer-settings-panel"),
            "Wide composer must show settings inline"
          );
          check(
            visible('[aria-label="选择智能体运行模式"]'),
            "Wide composer lost the mode selector"
          );
          check(
            visible('[aria-label="选择正文修改权限"]'),
            "Wide composer lost the approval selector"
          );
          check(
            visible(".conversation-model-config-summary"),
            "Wide composer lost model parameters"
          );
        }
        if (width === 320)
          check(compact, `Narrow composer did not fold: ${fontSize}`);
        if (compact) {
          check(
            !visible(".composer-settings-panel"),
            "Settings should start folded"
          );
          await click(".composer-more-trigger");
          const panel = element(
            ".composer-settings-panel"
          ).getBoundingClientRect();
          check(
            panel.left >= pane.left &&
              panel.right <= pane.right &&
              panel.top >= pane.top,
            "More panel clipped"
          );
          const style = getComputedStyle(element(".composer-settings-panel"));
          check(
            style.backgroundColor !== "rgba(0, 0, 0, 0)",
            "More panel needs opaque theme surface"
          );
          await click(".composer-more-trigger");
        }
        samples.push({ theme, fontSize, width, compact });
      }

  document.documentElement.style.setProperty("--ui-font-size", "24px");
  element(".conversation-pane").style.width = "320px";
  await frames();
  await click(".composer-more-trigger");
  await click('[aria-label="选择正文修改权限"]');
  const option = [
    ...document.querySelectorAll<HTMLButtonElement>(".popup-select-option")
  ].find((button) => button.textContent?.includes("替我审批"));
  check(Boolean(option), "Approval option missing");
  option!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  option!.click();
  await frames();
  check(approvalMode.value === "auto-approve", "Approval update not relayed");
  check(
    visible(".composer-settings-panel"),
    "Nested menu closed the disclosure"
  );
  element('[aria-label="选择正文修改权限"]').dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
  await frames();
  check(
    !visible(".composer-settings-panel"),
    "Escape did not close more settings"
  );
  check(
    document.activeElement === element(".composer-more-trigger"),
    "Escape lost keyboard focus"
  );
  await click(".composer-more-trigger");
  await click('[aria-label="选择正文修改权限"]');
  element(".conversation-pane").style.width = "350px";
  await frames();
  const transitionDeadline = performance.now() + 1000;
  while (
    document.querySelector(".popup-select-menu") &&
    performance.now() < transitionDeadline
  ) {
    await frames();
  }
  check(
    !document.querySelector(".popup-select-menu"),
    "Resize left an orphaned submenu"
  );
  check(
    !visible(".composer-settings-panel"),
    "Resize did not fold the disclosure"
  );
  element(".conversation-pane").style.width = "320px";
  await frames();
  await click(".send-button");
  check(sent === 1, "Send handler not called");
  responding.value = true;
  await frames();
  await click(".stop-button");
  check(stopped === 1, "Stop handler not called");
  await click(".composer-more-trigger");
  element("textarea").dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true })
  );
  await frames();
  check(
    !visible(".composer-settings-panel"),
    "Outside click did not close settings"
  );
  return { samples, sent, stopped, approval: approvalMode.value };
}

(
  window as typeof window & { runComposerProbe: typeof runComposerProbe }
).runComposerProbe = runComposerProbe;
