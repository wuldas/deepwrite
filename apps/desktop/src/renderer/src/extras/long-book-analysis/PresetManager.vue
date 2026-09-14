<script setup lang="ts">
import { ref, watch } from "vue";
import type {
  CatalogSnapshot,
  LongBookAnalysisPreset,
  MaterialKind,
  MaterialStageId,
  SkillKind
} from "@deepwrite/contracts/renderer";
import { createId } from "@deepwrite/shared";
import PopupSelect, {
  type PopupSelectOption
} from "../../components/PopupSelect.vue";
import { uiMessage } from "../../ui-feedback";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_STAGE_KINDS,
  SKILL_KIND_LABELS
} from "../../data/catalogWorkspace";
import { cloneLongBookAnalysisPreset } from "./preset-draft";

const props = defineProps<{
  short?: boolean;
  open: boolean;
  presets: readonly LongBookAnalysisPreset[];
  saving: boolean;
  catalogSnapshot: CatalogSnapshot | null;
}>();
const emit = defineEmits<{
  close: [];
  save: [presets: LongBookAnalysisPreset[]];
  reset: [presetId?: string];
}>();

const materialKinds: PopupSelectOption[] = (
  ["character", "gimmick", "plot", "draft", "other"] as const
).map((value) => ({ value, label: MATERIAL_KIND_LABELS[value] }));
const skillKinds: PopupSelectOption[] = (
  ["general", "plot", "style", "other"] as const
).map((value) => ({ value, label: SKILL_KIND_LABELS[value] }));
const materialStageIds: readonly MaterialStageId[] = [
  "gimmick",
  "character",
  "pacing",
  "intro",
  "plot_refine",
  "draft_excerpt",
  "other"
] as const;
const domainOptions: PopupSelectOption[] = [
  { value: "material", label: "素材库" },
  { value: "skill", label: "技能库" }
];

type PresetDraft = LongBookAnalysisPreset & {
  selectionMode?: "single" | "multiple";
};
const draft = ref<PresetDraft[]>([]);
const selectionOptions = [
  { value: "single", label: "单本（1 本）" },
  { value: "multiple", label: "多本（1—10 本）" }
];
const draggedIndex = ref<number | null>(null);

watch(
  () => [props.open, props.presets] as const,
  ([open]) => {
    if (open) draft.value = props.presets.map(cloneLongBookAnalysisPreset);
  },
  { immediate: true }
);

function addPreset(): void {
  if (draft.value.length >= 50) {
    uiMessage.warning("预设最多 50 项。");
    return;
  }
  draft.value.push({
    ...(props.short ? { selectionMode: "single" as const } : {}),
    id: createId("analysis_preset"),
    name: `新预设 ${draft.value.length + 1}`,
    description: props.short
      ? "说明这个预设要从短篇中提炼什么。"
      : "说明这个预设要从长篇中提炼什么。",
    systemPrompt: props.short
      ? "你是短篇拆书分析师。基于完整短篇提炼可复用方法，多本输入时联合比较并标明书名证据。"
      : "你是长篇拆书分析智能体。请基于章节证据提炼可复用的方法与结构，避免大段复制原文。",
    output: { domain: "material", kind: "other", stageId: "other" }
  });
}

function copyPreset(index: number): void {
  const current = draft.value[index];
  if (!current || draft.value.length >= 50) return;
  draft.value.splice(index + 1, 0, {
    ...cloneLongBookAnalysisPreset(current),
    id: createId("analysis_preset"),
    name: `${current.name} 副本`,
    builtin: false
  });
}

function removePreset(index: number): void {
  const current = draft.value[index];
  if (!current) return;
  if (!window.confirm(`确认删除预设“${current.name}”吗？`)) return;
  draft.value.splice(index, 1);
}

function dropAt(targetIndex: number): void {
  const sourceIndex = draggedIndex.value;
  draggedIndex.value = null;
  if (sourceIndex === null || sourceIndex === targetIndex) return;
  const [preset] = draft.value.splice(sourceIndex, 1);
  if (preset) draft.value.splice(targetIndex, 0, preset);
}

function setDomain(
  preset: LongBookAnalysisPreset,
  value: string | number
): void {
  preset.output =
    value === "skill"
      ? { domain: "skill", kind: "general", stageId: "draft" }
      : { domain: "material", kind: "other", stageId: "other" };
}

function targetLibraryOptions(
  preset: LongBookAnalysisPreset
): PopupSelectOption[] {
  const unset = { value: "", label: "每次任务时选择" };
  if (preset.output.domain === "material") {
    return [
      unset,
      ...(props.catalogSnapshot?.materials ?? [])
        .filter(
          (library) =>
            library.materialKind === preset.output.kind ||
            library.materialKind === "mixed"
        )
        .map((library) => ({
          value: library.id,
          label: library.title,
          description: MATERIAL_KIND_LABELS[library.materialKind]
        }))
    ];
  }
  return [
    unset,
    ...(props.catalogSnapshot?.skills ?? [])
      .filter(
        (library) =>
          library.skillKind === preset.output.kind && !library.isBuiltin
      )
      .map((library) => ({
        value: library.id,
        label: library.title,
        description: SKILL_KIND_LABELS[library.skillKind]
      }))
  ];
}

function setTargetLibrary(
  preset: LongBookAnalysisPreset,
  value: string | number
): void {
  const libraryId = String(value).trim();
  if (preset.output.domain === "material") {
    const output = {
      domain: preset.output.domain,
      kind: preset.output.kind,
      stageId: preset.output.stageId
    } as const;
    preset.output = libraryId ? { ...output, libraryId } : output;
    return;
  }
  const output = {
    domain: preset.output.domain,
    kind: preset.output.kind,
    stageId: preset.output.stageId
  } as const;
  preset.output = libraryId ? { ...output, libraryId } : output;
}

function setKind(preset: LongBookAnalysisPreset, value: string | number): void {
  if (preset.output.domain === "material") {
    const kind = value as MaterialKind;
    const stageId =
      MATERIAL_STAGE_KINDS[preset.output.stageId] === kind
        ? preset.output.stageId
        : materialStageIds.find(
            (stageId) => MATERIAL_STAGE_KINDS[stageId] === kind
          );
    preset.output = {
      domain: "material",
      kind,
      stageId: stageId ?? "other"
    };
    return;
  }
  preset.output = {
    domain: "skill",
    kind: value as SkillKind,
    stageId: preset.output.stageId
  };
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="analysis-modal-backdrop"
      @click.self="emit('close')"
    >
      <section
        class="analysis-preset-modal"
        role="dialog"
        aria-modal="true"
        aria-label="拆书预设管理"
      >
        <header>
          <div>
            <p>动态配置</p>
            <h2>拆书预设管理</h2>
          </div>
          <button type="button" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </header>
        <div class="preset-toolbar">
          <button type="button" @click="addPreset">新增预设</button>
          <button type="button" @click="emit('reset')">恢复全部默认</button>
          <small>默认预设可直接编辑，也可单项恢复</small>
          <span>{{ draft.length }} / 50</span>
        </div>
        <div class="preset-list">
          <article
            v-for="(preset, index) in draft"
            :key="preset.id"
            draggable="true"
            @dragstart="draggedIndex = index"
            @dragover.prevent
            @drop="dropAt(index)"
          >
            <div class="preset-card-heading">
              <span class="drag-handle">⋮⋮</span>
              <input
                v-model="preset.name"
                maxlength="80"
                aria-label="预设名称"
              />
              <button type="button" @click="copyPreset(index)">复制</button>
              <button
                v-if="preset.builtin"
                type="button"
                @click="emit('reset', preset.id)"
              >
                恢复默认
              </button>
              <button
                v-if="!preset.builtin"
                class="delete-button"
                type="button"
                @click="removePreset(index)"
              >
                删除
              </button>
            </div>
            <input
              v-model="preset.description"
              maxlength="500"
              aria-label="预设说明"
            />
            <label v-if="short" class="preset-output-field"
              ><span>可选择书本数量</span
              ><PopupSelect
                :model-value="preset.selectionMode ?? 'single'"
                @update:model-value="
                  preset.selectionMode =
                    $event === 'multiple' ? 'multiple' : 'single'
                "
                :options="selectionOptions"
                accessible-label="可选择书本数量"
                :menu-z-index="3200"
            /></label>
            <div class="preset-output-row">
              <label class="preset-output-field">
                <span>输出领域</span>
                <PopupSelect
                  :model-value="preset.output.domain"
                  :options="domainOptions"
                  accessible-label="结果领域"
                  :menu-z-index="3200"
                  @update:model-value="setDomain(preset, $event)"
                />
              </label>
              <label class="preset-output-field">
                <span>资料库分类</span>
                <PopupSelect
                  :model-value="preset.output.kind"
                  :options="
                    preset.output.domain === 'material'
                      ? materialKinds
                      : skillKinds
                  "
                  accessible-label="资料库分类"
                  :menu-z-index="3200"
                  @update:model-value="setKind(preset, $event)"
                />
              </label>
              <label class="preset-output-field">
                <span>默认目标资料库</span>
                <PopupSelect
                  :model-value="preset.output.libraryId ?? ''"
                  :options="targetLibraryOptions(preset)"
                  accessible-label="默认目标资料库"
                  :menu-min-width="260"
                  :menu-z-index="3200"
                  @update:model-value="setTargetLibrary(preset, $event)"
                />
              </label>
            </div>
            <textarea
              v-model="preset.systemPrompt"
              maxlength="200000"
              aria-label="预设系统提示词"
            />
          </article>
        </div>
        <footer>
          <button type="button" @click="emit('close')">取消</button>
          <button
            class="analysis-primary-button"
            type="button"
            :disabled="saving"
            @click="emit('save', draft)"
          >
            {{ saving ? "保存中…" : "保存预设" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped src="./preset-manager.css"></style>
