<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties
} from "vue";
import type { ThinkingLevel } from "@deepwrite/contracts/renderer";
import { createId } from "@deepwrite/shared";
import AppIcon from "./AppIcon.vue";

type ConfigPage = "main" | "model" | "thinking" | "temperature";
type ConfigValue = string | number;

interface ConfigOption {
  value: ConfigValue;
  label: string;
}

const props = defineProps<{
  selectedModelId: string;
  modelOptions: Array<{ value: string; label: string }>;
  thinkingLevel: ThinkingLevel;
  thinkingOptions: Array<{ value: ThinkingLevel; label: string }>;
  temperature: number;
  temperatureOptions: Array<{ value: number; label: string }>;
  showsTemperature: boolean;
  webSearchEnabled: boolean;
  webSearchAvailable: boolean;
  webSearchDisabledReason: string;
  responding: boolean;
}>();

const emit = defineEmits<{
  selectModel: [modelId: string];
  selectThinking: [level: ThinkingLevel];
  selectTemperature: [temperature: number];
  toggleWebSearch: [enabled: boolean];
}>();

const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const open = ref(false);
const page = ref<ConfigPage>("main");
const menuStyle = ref<CSSProperties>({});
const menuId = createId("conversation-model-config");

const selectedModelLabel = computed(
  () =>
    props.modelOptions.find((option) => option.value === props.selectedModelId)
      ?.label ?? "选择模型"
);
const thinkingLabel = computed(
  () =>
    props.thinkingOptions.find((option) => option.value === props.thinkingLevel)
      ?.label ?? "关闭"
);
const temperatureLabel = computed(
  () =>
    props.temperatureOptions.find(
      (option) => option.value === props.temperature
    )?.label ?? String(props.temperature)
);
const activeParameterLabel = computed(() =>
  props.showsTemperature
    ? `温度 ${temperatureLabel.value}`
    : thinkingLabel.value
);
const submenuTitle = computed(() => {
  if (page.value === "model") return "模型";
  if (page.value === "thinking") return "思考等级";
  return "温度";
});
const submenuOptions = computed<ConfigOption[]>(() => {
  if (page.value === "model") return props.modelOptions;
  if (page.value === "thinking") return props.thinkingOptions;
  if (page.value === "temperature") return props.temperatureOptions;
  return [];
});
const selectedSubmenuValue = computed<ConfigValue>(() => {
  if (page.value === "model") return props.selectedModelId;
  if (page.value === "thinking") return props.thinkingLevel;
  return props.temperature;
});
const webSearchTitle = computed(() => {
  if (props.responding) return "当前回复完成或停止后，才能切换联网";
  if (!props.webSearchAvailable) return props.webSearchDisabledReason;
  return props.webSearchEnabled ? "关闭联网" : "开启联网";
});

function estimatedMenuHeight(): number {
  if (page.value !== "main") {
    return Math.min(318, 52 + submenuOptions.value.length * 42 + 12);
  }
  return 20 + (props.showsTemperature ? 4 : 3) * 46 + 9;
}

function positionMenu(): void {
  if (!open.value || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const viewportMargin = 8;
  const gap = 7;
  const width = Math.min(288, window.innerWidth - viewportMargin * 2);
  const height = estimatedMenuHeight();
  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportMargin;
  const spaceAbove = rect.top - gap - viewportMargin;
  const opensUpward =
    spaceBelow < Math.min(height, 190) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    120,
    Math.min(318, opensUpward ? spaceAbove : spaceBelow)
  );
  const renderedHeight = Math.min(height, maxHeight);
  const left = Math.min(
    Math.max(viewportMargin, rect.left),
    window.innerWidth - width - viewportMargin
  );
  const top = opensUpward ? rect.top - gap - renderedHeight : rect.bottom + gap;
  menuStyle.value = {
    top: `${Math.max(viewportMargin, top)}px`,
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
    transformOrigin: opensUpward ? "bottom" : "top"
  };
}

async function openMenu(): Promise<void> {
  if (open.value || props.modelOptions.length === 0) return;
  page.value = "main";
  open.value = true;
  await nextTick();
  positionMenu();
}

function closeMenu(returnFocus = false): void {
  if (!open.value) return;
  open.value = false;
  page.value = "main";
  if (returnFocus) nextTick(() => trigger.value?.focus());
}

function toggleMenu(): void {
  if (open.value) closeMenu();
  else void openMenu();
}

function showPage(nextPage: Exclude<ConfigPage, "main">): void {
  page.value = nextPage;
  nextTick(positionMenu);
}

function showMainPage(): void {
  page.value = "main";
  nextTick(positionMenu);
}

function selectOption(value: ConfigValue): void {
  if (page.value === "model") emit("selectModel", String(value));
  if (page.value === "thinking") {
    emit("selectThinking", String(value) as ThinkingLevel);
  }
  if (page.value === "temperature") {
    emit("selectTemperature", Number(value));
  }
  showMainPage();
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    closeMenu();
    return;
  }
  if (["Enter", " ", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    if (!open.value) void openMenu();
  }
}

function handleMenuKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  if (page.value === "main") closeMenu(true);
  else showMainPage();
}

function handleDocumentPointerdown(event: PointerEvent): void {
  const target = event.target;
  if (
    target instanceof Node &&
    !trigger.value?.contains(target) &&
    !menu.value?.contains(target)
  ) {
    closeMenu();
  }
}

function handleViewportChange(): void {
  if (open.value) positionMenu();
}

watch(
  () => [props.modelOptions.length, props.showsTemperature] as const,
  ([modelCount]) => {
    if (modelCount === 0) closeMenu();
    else if (open.value) nextTick(positionMenu);
  }
);

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerdown);
  window.addEventListener("resize", handleViewportChange);
  document.addEventListener("scroll", handleViewportChange, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerdown);
  window.removeEventListener("resize", handleViewportChange);
  document.removeEventListener("scroll", handleViewportChange, true);
});
</script>

<template>
  <span class="conversation-model-config" :class="{ 'is-open': open }">
    <button
      ref="trigger"
      class="conversation-model-config-trigger"
      type="button"
      aria-haspopup="dialog"
      aria-label="模型配置"
      :title="`${selectedModelLabel} · ${activeParameterLabel}`"
      :aria-controls="open ? menuId : undefined"
      :aria-expanded="open"
      :disabled="modelOptions.length === 0"
      @click="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <span class="conversation-model-config-icons">
        <AppIcon name="model" :size="14" />
        <AppIcon
          v-if="webSearchEnabled"
          class="conversation-model-config-network-indicator"
          name="globe"
          :size="11"
        />
      </span>
      <span class="conversation-model-config-label">{{
        selectedModelLabel
      }}</span>
      <span class="conversation-model-config-summary">
        · {{ activeParameterLabel }}
      </span>
      <AppIcon
        class="conversation-model-config-chevron"
        name="chevron"
        :size="11"
      />
    </button>

    <Teleport to="body">
      <Transition name="conversation-model-config-menu">
        <section
          v-if="open"
          :id="menuId"
          ref="menu"
          class="conversation-model-config-menu"
          :style="menuStyle"
          role="dialog"
          aria-label="模型配置"
          @keydown="handleMenuKeydown"
        >
          <div v-if="page === 'main'" class="conversation-model-config-main">
            <button type="button" @click="showPage('model')">
              <span>模型</span>
              <span class="conversation-model-config-value">{{
                selectedModelLabel
              }}</span>
              <AppIcon name="chevron" :size="16" />
            </button>
            <button type="button" @click="showPage('thinking')">
              <span>思考等级</span>
              <span class="conversation-model-config-value">{{
                thinkingLabel
              }}</span>
              <AppIcon name="chevron" :size="16" />
            </button>
            <button
              v-if="showsTemperature"
              type="button"
              @click="showPage('temperature')"
            >
              <span>温度</span>
              <span class="conversation-model-config-value">{{
                temperatureLabel
              }}</span>
              <AppIcon name="chevron" :size="16" />
            </button>
            <div class="conversation-model-config-divider" />
            <button
              class="conversation-model-config-network"
              type="button"
              :disabled="responding || !webSearchAvailable"
              :title="webSearchTitle"
              aria-label="联网"
              :aria-pressed="webSearchEnabled"
              @click="emit('toggleWebSearch', !webSearchEnabled)"
            >
              <span>联网</span>
              <span class="conversation-model-config-value">
                {{ webSearchEnabled ? "开启" : "关闭" }}
              </span>
              <span
                class="conversation-model-config-switch"
                :class="{ 'is-active': webSearchEnabled }"
              >
                <span />
              </span>
            </button>
          </div>

          <div v-else class="conversation-model-config-submenu">
            <header>
              <button
                type="button"
                :aria-label="`返回模型配置`"
                @click="showMainPage"
              >
                <AppIcon name="chevron" :size="16" />
              </button>
              <strong>{{ submenuTitle }}</strong>
            </header>
            <div
              class="conversation-model-config-options"
              role="listbox"
              :aria-label="submenuTitle"
            >
              <button
                v-for="option in submenuOptions"
                :key="`${typeof option.value}:${option.value}`"
                type="button"
                role="option"
                :aria-selected="Object.is(option.value, selectedSubmenuValue)"
                :class="{
                  'is-selected': Object.is(option.value, selectedSubmenuValue)
                }"
                @click="selectOption(option.value)"
              >
                <span>{{ option.label }}</span>
                <AppIcon
                  v-if="Object.is(option.value, selectedSubmenuValue)"
                  name="check"
                  :size="15"
                />
              </button>
            </div>
          </div>
        </section>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped src="../styles/conversation-model-config-select.css"></style>
