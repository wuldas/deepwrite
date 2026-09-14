<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppIcon from "../../components/AppIcon.vue";
import { uiMessage } from "../../ui-feedback";
import type { ShortBookAnalysisController } from "./useShortBookAnalysis";
const props = defineProps<{ controller: ShortBookAnalysisController }>();
const c = props.controller;
const editing = computed(() =>
  c.drafts.value.find((b) => b.id === c.activeId.value)
);
const title = ref("");
const text = ref("");
const disabled = computed(() => c.isBusy.value || c.loading.value);
watch(
  editing,
  (book) => {
    title.value = book?.title ?? "";
    text.value = book?.text ?? "";
  },
  { immediate: true }
);
async function act(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    uiMessage.warning(
      error instanceof Error ? error.message : "来源操作失败。"
    );
  }
}
function save() {
  return act(() => {
    if (editing.value)
      c.updateBook(editing.value.id, { title: title.value, text: text.value });
  });
}
</script>
<template>
  <section v-if="c.drafts.value.length" class="analysis-card short-source-card">
    <header class="analysis-card-heading">
      <div>
        <p class="analysis-eyebrow">导入与校正</p>
        <h2>短篇正文</h2>
      </div>
      <span>{{ c.drafts.value.length.toLocaleString() }} 本</span>
    </header>
    <div class="short-source-workspace">
      <div class="short-list-pane">
        <div class="short-list-heading">
          <strong>短篇列表</strong
          ><span
            >已选 {{ c.selectedIds.value.length }} /
            {{ c.selectionLimit.value }} 本</span
          >
        </div>
        <ul class="short-book-list">
          <li
            v-for="book in c.drafts.value"
            :key="book.id"
            :class="{ selected: c.activeId.value === book.id }"
          >
            <input
              type="checkbox"
              :aria-label="`选择 ${book.title}`"
              :checked="c.selectedIds.value.includes(book.id)"
              :disabled="
                disabled ||
                (!c.selectedIds.value.includes(book.id) &&
                  c.selectedIds.value.length >= c.selectionLimit.value)
              "
              @change="act(() => c.toggleBook(book.id))"
            /><button :disabled="disabled" @click="c.activeId.value = book.id">
              <strong>{{ book.title }}</strong
              ><small>{{ book.text.length.toLocaleString() }} 字</small>
            </button>
          </li>
        </ul>
      </div>
      <div v-if="editing" class="short-text-editor">
        <label
          >书名<input
            v-model="title"
            :disabled="disabled"
            maxlength="256"
            @change="save" /></label
        ><label
          >完整正文<textarea
            v-model="text"
            :disabled="disabled"
            maxlength="2000000"
            @change="save"
          /></label
        ><small>编辑仅用于当前任务，不覆盖原文件或保存的来源快照。</small>
      </div>
    </div>
  </section>
  <section v-else class="analysis-card analysis-empty-source">
    <div class="analysis-empty-icon"><AppIcon name="book" :size="26" /></div>
    <div class="analysis-empty-copy">
      <strong>先导入一篇短篇</strong>
      <p>
        支持 TXT / Markdown
        文件或粘贴文本，每篇保留完整正文；添加后会备份到工作目录，下次可从顶部直接选择。
      </p>
    </div>
    <div class="analysis-empty-meta" aria-label="支持的导入格式">
      <span>TXT</span><span>Markdown</span><span>最多选择 10 本</span>
    </div>
  </section>
</template>
