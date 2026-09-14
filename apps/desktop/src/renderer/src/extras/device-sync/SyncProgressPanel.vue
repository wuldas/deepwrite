<script setup lang="ts">
import type { syncProgressPresentation } from "./progressPresentation";
defineProps<{
  progress: ReturnType<typeof syncProgressPresentation>;
  pending: boolean;
}>();
defineEmits<{ cancel: [] }>();
</script>

<template>
  <div class="sync-progress-panel">
    <div class="sync-progress-heading" aria-live="polite">
      <span class="sync-progress-stage">{{ progress.stage }}</span>
      <span class="sync-progress-count">{{ progress.count }}</span>
    </div>
    <div
      class="sync-progress-track"
      :class="{ indeterminate: pending && !progress.determinate }"
      role="progressbar"
      :aria-label="progress.stage"
      :aria-valuemin="0"
      :aria-valuemax="progress.determinate ? progress.total : undefined"
      :aria-valuenow="progress.determinate ? progress.completed : undefined"
      :aria-valuetext="progress.count"
    >
      <div
        class="sync-progress-fill"
        :style="{ width: `${progress.percent}%` }"
      />
    </div>
    <div class="sync-progress-detail">
      <div class="sync-progress-copy">
        <div class="sync-progress-current" :title="progress.detail">
          {{ progress.detail }}
        </div>
        <div class="sync-progress-secondary" :title="progress.secondary">
          {{ progress.secondary }}
        </div>
      </div>
      <button
        class="sync-button quiet sync-progress-cancel"
        :class="{ 'is-hidden': !pending }"
        :disabled="!pending"
        :aria-hidden="!pending"
        @click="$emit('cancel')"
      >
        取消
      </button>
    </div>
  </div>
</template>
