<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  ModelConfigInput,
  ModelSettings,
  ModelSettingsInput
} from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";
import { useModelSettingsDraft } from "../composables/useModelSettingsDraft";
import {
  applyProviderConnection,
  createProviderModelDraft,
  groupProviderModels,
  mergeRemoteProviderModels,
  removeProviderModels,
  type ProviderConnectionInput,
  type ProviderGroup
} from "../composables/useProviderGroups";
import { thinkingLabel } from "./modelSettingsDraft";
import {
  DOMESTIC_PROVIDER_PRESETS,
  type ProviderConnectionPreset
} from "./modelProviderPresets";
import AppIcon from "./AppIcon.vue";
import ModelAdvancedConfigDialog from "./ModelAdvancedConfigDialog.vue";
import ModelEditorPanel from "./ModelEditorPanel.vue";
import ProviderEditorDialog from "./ProviderEditorDialog.vue";

const props = withDefaults(
  defineProps<{
    active?: boolean;
    modelScope?: "all" | "custom";
    modelSettings: ModelSettings | null;
    modelLoading: boolean;
    modelSaving: boolean;
    modelError: string | null;
    modelTestMessage: string | null;
    testingModelId: string | null;
  }>(),
  {
    active: false,
    modelScope: "custom"
  }
);

const emit = defineEmits<{
  saveModels: [settings: ModelSettingsInput];
  testModel: [model: ModelConfigInput];
}>();

const {
  draftModels,
  draftDefaultModelId,
  modelEditor,
  advancedConfigModel,
  saveModelEditor,
  editModel,
  removeModel,
  setDefaultModel,
  submitModelSettings,
  openAdvancedConfig,
  closeAdvancedConfig,
  saveAdvancedConfig,
  testDraftModel
} = useModelSettingsDraft(props, {
  saveModels: (settings) => emit("saveModels", settings),
  testModel: (model) => emit("testModel", model),
  editorOpened: () => undefined
});

const selectedProviderName = ref("");
const modelQuery = ref("");
const providerEditorOpen = ref(false);
const providerEditorGroup = ref<ProviderGroup | null>(null);
const confirmDeleteGroup = ref<ProviderGroup | null>(null);
const fetchingProvider = ref("");
const testingProvider = ref("");
const creatingProvider = ref("");
const providerTestResult = ref<{
  key: string;
  state: "success" | "error";
  message: string;
} | null>(null);

const groups = computed(() =>
  groupProviderModels(draftModels.value, draftDefaultModelId.value)
);
const selectedGroup = computed(
  () =>
    groups.value.find(
      (group) => group.provider === selectedProviderName.value
    ) ?? null
);
const filteredModels = computed(() => {
  const query = modelQuery.value.trim().toLowerCase();
  const models = selectedGroup.value?.models ?? [];
  if (!query) return models;
  return models.filter((model) =>
    `${model.label} ${model.modelId}`.toLowerCase().includes(query)
  );
});

watch(
  groups,
  (next) => {
    if (next.some((group) => group.provider === selectedProviderName.value)) {
      return;
    }
    selectedProviderName.value = next[0]?.provider ?? "";
  },
  { immediate: true }
);

/** Provider being created: first-model editor is open but not persisted yet. */
const pendingProvider = computed(() => {
  const editor = modelEditor.value;
  if (!editor || editor.originalId) return null;
  const provider = editor.provider;
  return groups.value.some((group) => group.provider === provider)
    ? null
    : provider;
});

function selectProvider(group: ProviderGroup): void {
  if (modelEditor.value) return;
  selectedProviderName.value = group.provider;
  modelQuery.value = "";
}

const providerPreset = ref<ProviderConnectionPreset | null>(null);
const presetMenuOpen = ref(false);
const presetCaretRef = ref<HTMLButtonElement | null>(null);
const presetMenuStyle = ref<Record<string, string>>({});

function positionPresetMenu(): void {
  const el = presetCaretRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  presetMenuStyle.value = {
    left: `${Math.round(rect.left)}px`,
    top: `${Math.round(rect.bottom + 4)}px`
  };
}

function togglePresetMenu(): void {
  presetMenuOpen.value = !presetMenuOpen.value;
  if (presetMenuOpen.value) positionPresetMenu();
}

function closePresetMenuOnOutside(event: Event): void {
  const target = event.target as Node | null;
  if (
    presetCaretRef.value?.contains(target) === true ||
    (target instanceof Element && target.closest(".provider-preset-menu"))
  ) {
    return;
  }
  presetMenuOpen.value = false;
}

function pickPreset(value: string): void {
  presetMenuOpen.value = false;
  if (!value) return;
  openAddProvider(
    value === "custom"
      ? null
      : (DOMESTIC_PROVIDER_PRESETS.find((item) => item.value === value) ?? null)
  );
}

function openAddProvider(preset: ProviderConnectionPreset | null = null): void {
  providerEditorGroup.value = null;
  providerPreset.value = preset;
  presetMenuOpen.value = false;
  providerEditorOpen.value = true;
}

function openEditProvider(group: ProviderGroup): void {
  providerEditorGroup.value = group;
  providerEditorOpen.value = true;
}

function isDuplicateProvider(connection: ProviderConnectionInput): boolean {
  const next = connection.provider.trim().toLowerCase();
  return groups.value.some(
    (group) =>
      group.provider !== providerEditorGroup.value?.provider &&
      group.provider.toLowerCase() === next
  );
}

function saveProviderConnection(connection: ProviderConnectionInput): void {
  if (isDuplicateProvider(connection)) {
    uiMessage.warning("供应商名称已存在，请换一个名称。");
    return;
  }
  if (providerEditorGroup.value) {
    const previous = providerEditorGroup.value.provider;
    draftModels.value = applyProviderConnection(
      draftModels.value,
      previous,
      connection
    );
    selectedProviderName.value = connection.provider;
    providerEditorOpen.value = false;
    submitModelSettings();
    return;
  }
  providerEditorOpen.value = false;
  selectedProviderName.value = connection.provider.trim().toLowerCase();
  void createProviderWithModels(connection);
}

/** Create the provider by importing its remote catalog; fall back to manual entry. */
async function createProviderWithModels(
  connection: ProviderConnectionInput
): Promise<void> {
  const provider = connection.provider.trim().toLowerCase();
  if (!window.deepwrite) {
    modelEditor.value = createProviderModelDraft(connection);
    return;
  }
  creatingProvider.value = provider;
  try {
    const result = await window.deepwrite.models.listRemote({
      provider,
      api: connection.api,
      baseUrl: connection.baseUrl,
      ...(connection.apiKey ? { apiKey: connection.apiKey } : {})
    });
    if (result.models.length === 0) {
      uiMessage.warning("接口没有返回模型，请手动添加。");
      modelEditor.value = createProviderModelDraft(connection);
      return;
    }
    const merged = mergeRemoteProviderModels(
      draftModels.value,
      provider,
      result.models,
      connection
    );
    draftModels.value = merged.models;
    if (!draftDefaultModelId.value) {
      draftDefaultModelId.value =
        merged.models[merged.models.length - 1]?.id ?? "";
    }
    submitModelSettings();
    uiMessage.success(
      `供应商 ${provider} 已创建，导入 ${merged.added} 个模型。`
    );
  } catch (error) {
    uiMessage.error(
      error instanceof Error && error.message.trim()
        ? error.message
        : "自动获取模型失败，请手动添加模型。"
    );
    modelEditor.value = createProviderModelDraft(connection);
  } finally {
    creatingProvider.value = "";
  }
}

function addModelToSelected(): void {
  const group = selectedGroup.value;
  if (!group) return;
  modelEditor.value = createProviderModelDraft({
    provider: group.provider,
    api: group.api,
    baseUrl: group.baseUrl
  });
}

function cancelModelEditor(): void {
  const pending = pendingProvider.value;
  modelEditor.value = null;
  if (pending) {
    uiMessage.warning(`供应商 ${pending} 未创建：需保存至少一个模型。`);
  }
}

function saveModelAndSync(
  payload: Parameters<typeof saveModelEditor>[0]
): void {
  saveModelEditor(payload);
  if (!modelEditor.value) submitModelSettings();
}

function removeModelAndSync(modelId: string): void {
  removeModel(modelId);
  submitModelSettings();
}

function deleteSelectedProvider(): void {
  const group = confirmDeleteGroup.value;
  if (!group) return;
  const containedDefault = group.containsDefault;
  draftModels.value = removeProviderModels(draftModels.value, group.provider);
  if (containedDefault) draftDefaultModelId.value = "";
  confirmDeleteGroup.value = null;
  if (modelEditor.value?.provider === group.provider) {
    modelEditor.value = null;
  }
  submitModelSettings();
  uiMessage.success(`供应商 ${group.provider} 已删除。`);
}

function providerConnection(group: ProviderGroup): ProviderConnectionInput {
  return {
    provider: group.provider,
    api: group.api,
    baseUrl: group.baseUrl
  };
}

async function runProviderConnectionTest(
  connection: ProviderConnectionInput,
  keyHolderId?: string
): Promise<{ ok: boolean; message: string }> {
  if (!window.deepwrite) {
    return { ok: false, message: "当前环境无法执行连接测试。" };
  }
  const started = performance.now();
  try {
    const result = await window.deepwrite.models.listRemote({
      ...(keyHolderId ? { id: keyHolderId } : {}),
      provider: connection.provider,
      api: connection.api,
      baseUrl: connection.baseUrl,
      ...(connection.apiKey ? { apiKey: connection.apiKey } : {})
    });
    const latency = Math.round(performance.now() - started);
    return {
      ok: true,
      message: `连接成功 · ${result.models.length} 个可用模型 · ${latency}ms`
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message.trim()
          ? error.message
          : "连接失败，请检查 Base URL 与 API Key。"
    };
  }
}

async function testSelectedProvider(group: ProviderGroup): Promise<void> {
  if (testingProvider.value) return;
  const keyHolder =
    group.models.find((model) => model.hasApiKey) ?? group.models[0];
  testingProvider.value = group.provider;
  providerTestResult.value = null;
  const result = await runProviderConnectionTest(
    providerConnection(group),
    keyHolder?.id
  );
  providerTestResult.value = {
    key: group.provider,
    state: result.ok ? "success" : "error",
    message: result.message
  };
  testingProvider.value = "";
}

async function testEditorConnection(
  connection: ProviderConnectionInput
): Promise<{ ok: boolean; message: string }> {
  const group = providerEditorGroup.value;
  const keyHolder =
    group && !connection.apiKey
      ? (group.models.find((model) => model.hasApiKey) ?? group.models[0])
      : undefined;
  return runProviderConnectionTest(connection, keyHolder?.id);
}

async function fetchProviderModels(group: ProviderGroup): Promise<void> {
  if (fetchingProvider.value) return;
  if (!window.deepwrite) {
    uiMessage.error("当前环境无法拉取模型列表。");
    return;
  }
  const keyHolder =
    group.models.find((model) => model.hasApiKey) ?? group.models[0];
  fetchingProvider.value = group.provider;
  try {
    const result = await window.deepwrite.models.listRemote({
      ...(keyHolder ? { id: keyHolder.id } : {}),
      provider: group.provider,
      api: group.api,
      baseUrl: group.baseUrl
    });
    if (result.models.length === 0) {
      uiMessage.warning("当前接口没有返回可用模型。");
      return;
    }
    const merged = mergeRemoteProviderModels(
      draftModels.value,
      group.provider,
      result.models,
      providerConnection(group)
    );
    draftModels.value = merged.models;
    submitModelSettings();
    uiMessage.success(
      `已获取 ${result.models.length} 个模型：新增 ${merged.added} 个、更新 ${merged.updated} 个。`
    );
  } catch (error) {
    uiMessage.error(
      error instanceof Error && error.message.trim()
        ? error.message
        : "拉取模型列表失败。"
    );
  } finally {
    if (fetchingProvider.value === group.provider) {
      fetchingProvider.value = "";
    }
  }
}

function modelSummary(model: (typeof draftModels.value)[number]): string {
  return model.reasoning
    ? `思考：${model.thinkingLevelOptions.map(thinkingLabel).join(" / ")}`
    : `温度：${model.temperatureOptions.join(" / ")}`;
}

onMounted(() => {
  document.addEventListener("mousedown", closePresetMenuOnOutside, true);
  document.addEventListener("keydown", closePresetMenuOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", closePresetMenuOnOutside, true);
  document.removeEventListener("keydown", closePresetMenuOnEscape);
});

function closePresetMenuOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") presetMenuOpen.value = false;
}
</script>

<template>
  <section class="provider-management-panel" :aria-busy="modelLoading">
    <div v-if="modelLoading" class="dialog-note">正在读取模型配置…</div>
    <div v-else class="provider-management-layout">
      <aside class="provider-sidebar">
        <div class="provider-add-split">
          <button
            class="provider-add-main"
            type="button"
            :disabled="modelSaving"
            @click="openAddProvider(null)"
          >
            <AppIcon name="plus" :size="13" />
            新增供应商
          </button>
          <button
            ref="presetCaretRef"
            class="provider-add-caret"
            type="button"
            :disabled="modelSaving"
            aria-label="从国内预设新增供应商"
            :aria-expanded="presetMenuOpen"
            aria-haspopup="menu"
            title="从国内预设新增"
            @click="togglePresetMenu"
          >
            <AppIcon name="chevron" :size="11" />
          </button>
        </div>
        <button
          v-for="group in groups"
          :key="group.provider"
          class="provider-item"
          :class="{ 'is-active': group.provider === selectedProviderName }"
          type="button"
          @click="selectProvider(group)"
        >
          <span>
            <strong>{{ group.provider }}</strong>
            <small>{{ group.models.length }} 模型</small>
          </span>
          <i :class="{ 'is-enabled': group.containsDefault }" />
        </button>
        <button
          v-if="pendingProvider"
          class="provider-item is-pending"
          type="button"
          disabled
        >
          <span>
            <strong>{{ pendingProvider }}</strong>
            <small>待保存</small>
          </span>
          <i />
        </button>
        <p
          v-if="groups.length === 0 && !pendingProvider"
          class="provider-sidebar-empty"
        >
          尚未配置自定义供应商
        </p>
      </aside>

      <main class="provider-main">
        <div v-if="creatingProvider" class="dialog-note">
          正在创建供应商 {{ creatingProvider }} 并获取模型列表…
        </div>

        <template v-if="modelEditor">
          <div v-if="pendingProvider" class="dialog-note">
            供应商 {{ pendingProvider }} 将在保存第一个模型后创建。
          </div>
          <section class="provider-models">
            <ModelEditorPanel
              :model="modelEditor"
              :editing="Boolean(modelEditor.originalId)"
              :testing-model-id="testingModelId"
              :saving="modelSaving"
              lock-provider
              @cancel="cancelModelEditor"
              @save="saveModelAndSync"
              @test="emit('testModel', $event)"
            />
          </section>
        </template>

        <template v-else-if="selectedGroup">
          <section class="provider-summary">
            <header>
              <div class="provider-summary-title">
                <h3>{{ selectedGroup.provider }}</h3>
                <span class="provider-summary-meta">
                  {{ selectedGroup.baseUrl || "—" }} · {{ selectedGroup.api }} ·
                  {{ selectedGroup.hasApiKey ? "apiKey" : "无密钥" }} ·
                  {{ selectedGroup.models.length }} 个模型
                </span>
              </div>
              <div class="provider-summary-actions">
                <button
                  class="provider-ghost-button"
                  type="button"
                  :disabled="
                    modelSaving || testingProvider === selectedGroup.provider
                  "
                  @click="testSelectedProvider(selectedGroup)"
                >
                  {{
                    testingProvider === selectedGroup.provider
                      ? "测试中…"
                      : "测试连接"
                  }}
                </button>
                <button
                  class="provider-ghost-button"
                  type="button"
                  :disabled="modelSaving"
                  @click="openEditProvider(selectedGroup)"
                >
                  编辑供应商
                </button>
                <button
                  class="provider-danger-button"
                  type="button"
                  :disabled="modelSaving"
                  @click="confirmDeleteGroup = selectedGroup"
                >
                  删除
                </button>
              </div>
            </header>
            <p
              v-if="
                providerTestResult &&
                providerTestResult.key === selectedGroup.provider
              "
              class="provider-test-result"
              :class="`is-${providerTestResult.state}`"
              role="status"
            >
              {{ providerTestResult.message }}
            </p>
          </section>

          <section class="provider-models">
            <header class="provider-models-header">
              <div>
                <h3>模型</h3>
                <p>模型操作会立即保存到当前供应商。</p>
              </div>
              <div class="provider-model-actions">
                <button
                  class="provider-ghost-button"
                  type="button"
                  :disabled="modelSaving"
                  @click="addModelToSelected"
                >
                  ＋ 添加模型
                </button>
                <button
                  class="provider-ghost-button"
                  type="button"
                  :disabled="
                    modelSaving || fetchingProvider === selectedGroup.provider
                  "
                  @click="fetchProviderModels(selectedGroup)"
                >
                  {{
                    fetchingProvider === selectedGroup.provider
                      ? "拉取中…"
                      : "获取模型"
                  }}
                </button>
              </div>
            </header>

            <div class="provider-model-toolbar">
              <input
                v-model="modelQuery"
                type="search"
                placeholder="搜索模型 ID 或名称"
                aria-label="搜索模型"
              />
              <span>
                {{ filteredModels.length }} /
                {{ selectedGroup.models.length }}
                个模型
              </span>
            </div>

            <div class="provider-model-list">
              <article
                v-for="model in filteredModels"
                :key="model.id"
                class="provider-model-row"
                :class="{ 'is-default': draftDefaultModelId === model.id }"
              >
                <div class="provider-model-copy">
                  <strong>{{ model.label || model.modelId }}</strong>
                  <small v-if="model.label && model.modelId !== model.label">
                    {{ model.modelId }}
                  </small>
                  <small>
                    {{ modelSummary(model) }} ·
                    {{
                      model.hasApiKey || model.apiKey
                        ? "密钥已配置"
                        : "未配置密钥"
                    }}
                  </small>
                </div>
                <div class="provider-model-row-actions">
                  <button
                    type="button"
                    :class="{ 'is-active': draftDefaultModelId === model.id }"
                    :disabled="modelSaving"
                    @click="setDefaultModel(model.id)"
                  >
                    {{ draftDefaultModelId === model.id ? "默认" : "设为默认" }}
                  </button>
                  <button
                    type="button"
                    :disabled="modelSaving"
                    @click="editModel(model)"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    :disabled="modelSaving || testingModelId !== null"
                    @click="testDraftModel(model)"
                  >
                    {{ testingModelId === model.id ? "测试中…" : "测试连接" }}
                  </button>
                  <button
                    type="button"
                    :disabled="modelSaving"
                    title="配置上下文长度和最高输出长度"
                    @click="openAdvancedConfig(model)"
                  >
                    高级
                  </button>
                  <button
                    type="button"
                    class="is-danger"
                    :disabled="modelSaving"
                    @click="removeModelAndSync(model.id)"
                  >
                    删除
                  </button>
                </div>
              </article>
              <p
                v-if="filteredModels.length === 0"
                class="provider-model-empty"
              >
                没有匹配的模型。
              </p>
            </div>
          </section>
        </template>

        <div v-else-if="!creatingProvider" class="provider-empty-state">
          <strong>尚未配置自定义供应商</strong>
          <span>先新增一个供应商，再为它添加模型。</span>
          <button
            class="provider-add-button"
            type="button"
            :disabled="modelSaving"
            @click="openAddProvider()"
          >
            ＋ 新增供应商
          </button>
        </div>
      </main>
    </div>

    <ProviderEditorDialog
      v-if="providerEditorOpen"
      :group="providerEditorGroup"
      :preset="providerPreset"
      :busy="modelSaving"
      :test-connection="testEditorConnection"
      @close="providerEditorOpen = false"
      @save="saveProviderConnection"
    />

    <ModelAdvancedConfigDialog
      :model="advancedConfigModel"
      :busy="modelSaving"
      @close="closeAdvancedConfig"
      @save="saveAdvancedConfig"
    />

    <Teleport to="body">
      <div
        v-if="presetMenuOpen"
        class="provider-preset-menu"
        :style="presetMenuStyle"
        role="menu"
        aria-label="国内供应商预设"
      >
        <button type="button" role="menuitem" @click="pickPreset('custom')">
          手动新增供应商
        </button>
        <button
          v-for="preset in DOMESTIC_PROVIDER_PRESETS"
          :key="preset.value"
          type="button"
          role="menuitem"
          @click="pickPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="confirmDeleteGroup"
        class="dialog-backdrop model-fetch-hint-overlay"
        @mousedown.self="confirmDeleteGroup = null"
      >
        <section
          class="model-fetch-hint-dialog provider-delete-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="provider-delete-title"
        >
          <header>
            <div>
              <span class="dialog-eyebrow">删除供应商</span>
              <h2 id="provider-delete-title">
                删除 {{ confirmDeleteGroup.provider }}？
              </h2>
            </div>
          </header>
          <p>
            将同时删除该供应商下的
            {{ confirmDeleteGroup.models.length }} 个模型配置，且不可恢复。
          </p>
          <footer class="dialog-actions">
            <button
              class="dialog-secondary-button"
              type="button"
              @click="confirmDeleteGroup = null"
            >
              取消
            </button>
            <button
              class="dialog-primary-button is-danger"
              type="button"
              @click="deleteSelectedProvider"
            >
              确认删除
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<style scoped src="./provider-management-panel.css"></style>
