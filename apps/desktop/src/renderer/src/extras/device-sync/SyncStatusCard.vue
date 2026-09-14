<script setup lang="ts">
import { computed } from "vue";
import type { SyncRequest, SyncStatus } from "@deepwrite/contracts/renderer";
import { syncPresentation } from "./presentation";
import SyncAdoptionButtons from "./SyncAdoptionButtons.vue";
import SyncProgressPanel from "./SyncProgressPanel.vue";
import { syncProgressPresentation } from "./progressPresentation";
import "./sync-status-card.css";
const props = defineProps<{ status: SyncStatus; pending: boolean }>();
const emit = defineEmits<{ request: [input: SyncRequest] }>();
const view = computed(() => syncPresentation(props.status));
const progress = computed(() =>
  syncProgressPresentation(props.status, props.pending)
);
const first = computed(() =>
  props.status.issues.some((issue) => issue.reason === "first-sync")
);
</script>
<template>
  <section class="sync-card sync-status-card">
    <div class="sync-status-heading">
      <h2>同步状态</h2>
      <span class="sync-status-badge">{{ progress.badge }}</span>
    </div>
    <div class="sync-status-summary">
      <span
        >待上传 <strong>{{ view.uploads.length }}</strong> 项</span
      >
      <span
        >待下载 <strong>{{ view.downloads.length }}</strong> 项</span
      >
      <span v-if="view.both.length"
        >两端修改 <strong>{{ view.both.length }}</strong> 项</span
      >
    </div>
    <div class="sync-actions">
      <button
        v-if="!status.firstSyncConfirmed"
        class="sync-button"
        :disabled="pending"
        @click="emit('request', { operation: 'sync', confirmFirst: first })"
      >
        {{ first ? "确认并开始首次同步" : "预览首次同步" }}
      </button>
      <template v-else>
        <button
          class="sync-button"
          :disabled="pending || !view.uploads.length"
          @click="emit('request', { operation: 'sync', direction: 'upload' })"
        >
          上传本机修改
        </button>
        <button
          class="sync-button secondary"
          :disabled="pending || !view.downloads.length"
          @click="emit('request', { operation: 'sync', direction: 'download' })"
        >
          下载远端更新
        </button>
        <SyncAdoptionButtons
          v-if="view.adoptionKeys.length"
          all
          :pending="pending"
          @resolve="
            (side) =>
              emit('request', {
                operation: 'sync',
                adoption: { side, keys: view.adoptionKeys }
              })
          "
        />
      </template>
      <button
        class="sync-button quiet"
        :disabled="pending"
        @click="emit('request', { operation: 'check' })"
      >
        检查远端更新
      </button>
    </div>
    <p v-if="view.adoptionKeys.length">
      采用所选端的完整版本处理未完成项。替换前的本机版本可在“历史与恢复”中找回。
    </p>
    <SyncProgressPanel
      :progress="progress"
      :pending="pending"
      @cancel="emit('request', { operation: 'cancel' })"
    />
    <details class="sync-status-records">
      <summary>同步记录与设备接收情况</summary>
      <p>
        {{
          status.lastSuccessAt
            ? `上次操作成功：${new Date(status.lastSuccessAt).toLocaleString()}`
            : status.firstSyncConfirmed
              ? "尚无全部成功记录，未完成项可单独处理"
              : "尚未完成首次同步"
        }}
      </p>
      <p v-if="status.firstSyncConfirmed">{{ view.receipt }}</p>
      <p>
        {{
          status.lastCheckedAt
            ? `远端检查：${new Date(status.lastCheckedAt).toLocaleString()}`
            : "尚未检查远端"
        }}。仅核对已上传的数据，另一端未上传的编辑不可见。
      </p>
    </details>
  </section>
</template>
