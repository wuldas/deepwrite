<script setup lang="ts">
import { ref, watch } from "vue";
import type { ModelApi } from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";
import PopupSelect from "./PopupSelect.vue";
import type {
  ProviderConnectionInput,
  ProviderGroup
} from "../composables/useProviderGroups";
import type { ProviderConnectionPreset } from "./modelProviderPresets";

const props = defineProps<{
  group: ProviderGroup | null;
  busy: boolean;
  preset?: ProviderConnectionPreset | null;
  testConnection?: (
    connection: ProviderConnectionInput
  ) => Promise<{ ok: boolean; message: string }>;
}>();

const emit = defineEmits<{
  close: [];
  save: [connection: ProviderConnectionInput];
}>();

const testing = ref(false);
const testState = ref<"idle" | "success" | "error">("idle");
const testMessage = ref("");

const apiOptions: ReadonlyArray<{ value: ModelApi; label: string }> = [
  { value: "openai-completions", label: "OpenAI Completions" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
  { value: "google-generative-ai", label: "Google Generative AI" }
];

const providerName = ref("");
const api = ref<ModelApi>("openai-completions");
const baseUrl = ref("");
const apiKey = ref("");

watch(
  () => [props.group, props.preset] as const,
  ([group, preset]) => {
    if (preset) {
      providerName.value = preset.value;
      api.value = preset.api;
      baseUrl.value = preset.baseUrl;
      apiKey.value = "";
      return;
    }
    providerName.value = group?.provider ?? "";
    api.value = group?.api ?? "openai-completions";
    baseUrl.value = group?.baseUrl ?? "";
    apiKey.value = "";
  },
  { immediate: true }
);

function currentConnection(): ProviderConnectionInput | null {
  const url = baseUrl.value.trim();
  if (!/^https?:\/\//iu.test(url)) {
    uiMessage.warning("请先填写以 http(s) 开头的 Base URL。");
    return null;
  }
  return {
    provider: providerName.value.trim() || "provider",
    api: api.value,
    baseUrl: url,
    ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {})
  };
}

async function test(): Promise<void> {
  if (testing.value || !props.testConnection) return;
  const connection = currentConnection();
  if (!connection) return;
  testing.value = true;
  testState.value = "idle";
  testMessage.value = "";
  const result = await props.testConnection(connection);
  testState.value = result.ok ? "success" : "error";
  testMessage.value = result.message;
  testing.value = false;
}

function save(): void {
  if (props.busy) return;
  const provider = providerName.value.trim();
  if (!provider) {
    uiMessage.warning("请先填写供应商名称。");
    return;
  }
  const url = baseUrl.value.trim();
  if (!/^https?:\/\//iu.test(url)) {
    uiMessage.warning("请填写以 http(s) 开头的 Base URL。");
    return;
  }
  emit("save", {
    provider,
    api: api.value,
    baseUrl: url,
    ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {})
  });
}
</script>

<template>
  <Teleport to="body">
    <div
      class="dialog-backdrop model-fetch-hint-overlay"
      @mousedown.self="emit('close')"
      @keydown.esc.stop="emit('close')"
    >
      <section
        class="model-fetch-hint-dialog provider-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-editor-title"
        tabindex="-1"
        @keydown.esc.stop="emit('close')"
      >
        <header>
          <div>
            <span class="dialog-eyebrow">供应商</span>
            <h2 id="provider-editor-title">
              {{ group ? "编辑供应商" : "新增供应商" }}
            </h2>
          </div>
        </header>
        <p>
          {{
            group
              ? "连接信息会同步到该供应商下的全部模型；API Key 留空表示保持不变。"
              : "保存连接信息后，再为该供应商添加具体模型。"
          }}
        </p>
        <div class="provider-editor-fields">
          <label>
            <span>供应商名称</span>
            <input
              v-model="providerName"
              type="text"
              placeholder="例如：fx"
              aria-label="供应商名称"
            />
          </label>
          <label>
            <span>API 协议</span>
            <PopupSelect
              :model-value="api"
              :options="apiOptions"
              accessible-label="选择 API 协议"
              @update:model-value="api = String($event) as ModelApi"
            />
          </label>
          <label class="is-wide">
            <span>Base URL</span>
            <input
              v-model="baseUrl"
              type="url"
              placeholder="https://api.example.com/v1"
              aria-label="Base URL"
            />
          </label>
          <label class="is-wide">
            <span>API Key</span>
            <input
              v-model="apiKey"
              type="password"
              autocomplete="new-password"
              :placeholder="
                group?.hasApiKey
                  ? '已安全保存；留空表示保持不变'
                  : '请输入 API Key（本地服务可留空）'
              "
              aria-label="API Key"
            />
          </label>
        </div>
        <p
          v-if="testMessage"
          class="provider-test-result"
          :class="`is-${testState}`"
          role="status"
        >
          {{ testMessage }}
        </p>
        <footer class="dialog-actions">
          <button
            v-if="testConnection"
            class="dialog-secondary-button"
            type="button"
            :disabled="busy || testing"
            @click="test"
          >
            {{ testing ? "测试中…" : "测试连接" }}
          </button>
          <button
            class="dialog-secondary-button"
            type="button"
            :disabled="busy"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            class="dialog-primary-button"
            type="button"
            :disabled="
              busy ||
              !providerName.trim() ||
              !/^https?:\/\//iu.test(baseUrl.trim())
            "
            @click="save"
          >
            {{ busy ? "保存中…" : "保存" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.provider-test-result {
  margin: 10px 18px 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.678571rem;
  border: 1px solid var(--theme-line);
  background: var(--surface-muted);
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.provider-test-result.is-success {
  border-color: color-mix(in srgb, #2e9e5b 40%, var(--theme-line));
  color: color-mix(in srgb, #2e9e5b 78%, var(--text-primary));
}

.provider-test-result.is-error {
  border-color: color-mix(in srgb, #c0392b 40%, var(--theme-line));
  color: color-mix(in srgb, #c0392b 78%, var(--text-primary));
}

.provider-editor-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px 18px 0;
}

.provider-editor-fields label {
  display: grid;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 0.678571rem;
}

.provider-editor-fields label.is-wide {
  grid-column: 1 / -1;
}

.provider-editor-fields input {
  width: 100%;
  height: 34px;
  padding: 0 9px;
  border: 1px solid var(--theme-line);
  border-radius: 7px;
  outline: 0;
  background: var(--surface-main);
  color: var(--text-primary);
  font-size: 0.785714rem;
}

.provider-editor-fields input:focus {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--theme-line));
}

@media (max-width: 720px) {
  .provider-editor-fields {
    grid-template-columns: 1fr;
  }
}
</style>
