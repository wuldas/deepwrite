<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { LongBookAnalysisProcessEntry } from "./analysis-process";
import { analysisPhaseLabel } from "./analysis-process";

const props = defineProps<{
  entries: readonly (LongBookAnalysisProcessEntry | string)[];
  currentActivity: string;
  liveOutput: string;
  error: string | null;
  footerText?: string;
}>();

const displayEntries = computed(() =>
  props.entries.map((entry, index) =>
    typeof entry === "string"
      ? {
          id: String(index),
          title: entry,
          tone: "info",
          phase: null,
          createdAt: null,
          detail: null
        }
      : entry
  )
);
const logElement = ref<HTMLElement | null>(null);

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

async function scrollToLatest(): Promise<void> {
  await nextTick();
  const element = logElement.value;
  if (element) element.scrollTop = element.scrollHeight;
}

watch(
  () => [props.entries.length, props.liveOutput] as const,
  () => void scrollToLatest(),
  { flush: "post" }
);
onMounted(() => void scrollToLatest());
</script>

<template>
  <section class="analysis-process-panel" aria-label="拆书执行过程">
    <header>
      <div>
        <strong>执行过程</strong>
        <span aria-live="polite">{{ currentActivity || "等待开始" }}</span>
      </div>
      <small>{{ entries.length }} 条记录</small>
    </header>
    <div ref="logElement" class="analysis-process-log" role="log">
      <ol v-if="entries.length">
        <li
          v-for="entry in displayEntries"
          :key="entry.id"
          :class="`is-${entry.tone}`"
        >
          <i aria-hidden="true"></i>
          <div>
            <div class="analysis-process-entry-heading">
              <strong>{{ entry.title }}</strong>
              <span v-if="entry.phase">{{
                analysisPhaseLabel(entry.phase)
              }}</span>
              <time v-if="entry.createdAt" :datetime="entry.createdAt">{{
                timeLabel(entry.createdAt)
              }}</time>
            </div>
            <p v-if="entry.detail">{{ entry.detail }}</p>
          </div>
        </li>
      </ol>
      <p v-else class="analysis-process-empty">执行后会在这里逐步显示进度。</p>
      <div v-if="liveOutput.trim()" class="analysis-process-output">
        <strong>模型公开输出</strong>
        <pre>{{ liveOutput }}</pre>
      </div>
    </div>
    <p v-if="error" class="analysis-process-error">{{ error }}</p>
    <footer>
      {{
        footerText ?? "显示阶段、读取、搜索和写入动作；内部思考文本不会展示。"
      }}
    </footer>
  </section>
</template>

<style scoped>
.analysis-process-panel {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 11px;
  background: var(--surface-main);
}
.analysis-process-panel > header,
.analysis-process-panel > header > div,
.analysis-process-entry-heading {
  display: flex;
  align-items: baseline;
  gap: 9px;
}
.analysis-process-panel > header {
  justify-content: space-between;
}
.analysis-process-panel > header span,
.analysis-process-panel > header small,
.analysis-process-entry-heading span,
.analysis-process-entry-heading time,
.analysis-process-panel > footer {
  color: var(--text-tertiary);
  font-size: 0.75rem;
}
.analysis-process-log {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--theme-line-soft);
  border-radius: 9px;
  background: var(--surface-muted);
}
.analysis-process-log ol {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 4px 12px;
  list-style: none;
}
.analysis-process-log li {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr);
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--theme-line-soft);
}
.analysis-process-log li:last-child {
  border-bottom: 0;
}
.analysis-process-log li > i {
  width: 7px;
  height: 7px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--text-tertiary);
}
.analysis-process-log li.is-success > i {
  background: var(--success, #2f8f5b);
}
.analysis-process-log li.is-error > i {
  background: var(--danger, #c64b4b);
}
.analysis-process-entry-heading {
  min-width: 0;
}
.analysis-process-entry-heading strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.analysis-process-entry-heading span,
.analysis-process-entry-heading time {
  flex: 0 0 auto;
}
.analysis-process-log li p,
.analysis-process-empty,
.analysis-process-error {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.785714rem;
  line-height: 1.5;
}
.analysis-process-empty {
  padding: 18px;
  text-align: center;
}
.analysis-process-output {
  margin: 0 12px 12px;
  padding: 10px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 8px;
  background: var(--surface-raised);
}
.analysis-process-output > strong {
  font-size: 0.75rem;
}
.analysis-process-output pre {
  margin: 6px 0 0;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font: inherit;
  font-size: 0.785714rem;
  line-height: 1.55;
  white-space: pre-wrap;
}
.analysis-process-error {
  color: var(--danger, #c64b4b);
}
.analysis-process-panel > footer {
  margin: 0;
}
@media (max-width: 700px) {
  .analysis-process-panel > header,
  .analysis-process-panel > header > div,
  .analysis-process-entry-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }
}
</style>
