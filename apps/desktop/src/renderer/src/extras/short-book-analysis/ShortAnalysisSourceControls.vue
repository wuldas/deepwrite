<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import AppIcon from "../../components/AppIcon.vue";
import PopupSelect from "../../components/PopupSelect.vue";
import { uiMessage } from "../../ui-feedback";
import type { ShortBookAnalysisController } from "./useShortBookAnalysis";
const props = defineProps<{ controller: ShortBookAnalysisController }>();
const emit = defineEmits<{ managePresets: [] }>();
const c = props.controller;
const pasteOpen = ref(false);
const pasteTitle = ref("");
const pasteText = ref("");
const historyId = ref("");
const disabled = computed(() => c.isBusy.value || c.loading.value);
async function act(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    uiMessage.warning(
      error instanceof Error ? error.message : "来源操作失败。"
    );
  }
}
async function paste() {
  await act(async () => {
    await c.addText({ title: pasteTitle.value, text: pasteText.value });
    pasteOpen.value = false;
    pasteTitle.value = "";
    pasteText.value = "";
  });
}
onMounted(() => void act(() => c.loadSources()));
</script>
<template>
  <div class="analysis-page-controls">
    <div class="analysis-source-picker">
      <PopupSelect
        v-model="historyId"
        :options="
          c.savedSources.value.map((b) => ({
            value: b.id,
            label: b.title,
            description: `${b.characterCount.toLocaleString()} 字`
          }))
        "
        :placeholder="
          c.loading.value
            ? '正在加载已导入短篇…'
            : c.savedSources.value.length
              ? '选择已导入短篇'
              : '暂无已导入短篇'
        "
        accessible-label="已保存短篇"
        :disabled="disabled || !c.savedSources.value.length"
        :menu-min-width="320"
        @change="(id) => act(() => c.loadSource(String(id)))"
        ><template #prefix><AppIcon name="book" :size="15" /></template
      ></PopupSelect>
    </div>
    <div class="analysis-page-actions">
      <button
        type="button"
        :disabled="disabled"
        title="导入 TXT / Markdown"
        @click="act(() => c.chooseSources())"
      >
        <AppIcon name="file" :size="16" />导入文本
      </button>
      <button type="button" :disabled="disabled" @click="pasteOpen = true">
        <AppIcon name="edit" :size="16" />粘贴文本
      </button>
      <button
        class="analysis-icon-button"
        type="button"
        title="管理拆书预设"
        aria-label="管理拆书预设"
        :disabled="disabled"
        @click="emit('managePresets')"
      >
        <AppIcon name="settings" :size="17" />
      </button>
    </div>
  </div>
  <Teleport to="body"
    ><div
      v-if="pasteOpen"
      class="short-paste-backdrop"
      @click.self="!disabled && (pasteOpen = false)"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="粘贴短篇"
        class="short-paste-dialog"
      >
        <h2>粘贴短篇</h2>
        <label
          >书名<input
            v-model="pasteTitle"
            maxlength="256"
            :disabled="disabled" /></label
        ><label
          >完整正文<textarea
            v-model="pasteText"
            maxlength="2000000"
            :disabled="disabled"
          />
        </label>
        <footer>
          <button :disabled="disabled" @click="pasteOpen = false">取消</button
          ><button
            class="analysis-primary-button"
            :disabled="disabled"
            @click="paste"
          >
            添加短篇
          </button>
        </footer>
      </section>
    </div></Teleport
  >
</template>
