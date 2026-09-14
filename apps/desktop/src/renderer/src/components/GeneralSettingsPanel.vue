<script setup lang="ts">
import type {
  AppLanguage,
  GeneralPermissionMode,
  TextViewMode,
  WebServiceSettings,
  WebServiceStatus,
  WorkspacePaneLayout
} from "@deepwrite/contracts";
import PopupSelect from "./PopupSelect.vue";

defineProps<{
  permissionMode: GeneralPermissionMode;
  autoApproveCrossStageOperations: boolean;
  autoSaveEnabled: boolean;
  language: AppLanguage;
  showContextUsage: boolean;
  showInMenuBar: boolean;
  useNetworkProxy: boolean;
  workspacePaneLayout: WorkspacePaneLayout;
  defaultTextViewMode: TextViewMode;
  webService: WebServiceSettings;
  webServiceStatus: WebServiceStatus;
}>();

const emit = defineEmits<{
  updatePermissionMode: [mode: GeneralPermissionMode];
  updateAutoApproveCrossStageOperations: [enabled: boolean];
  updateAutoSave: [enabled: boolean];
  updateLanguage: [language: AppLanguage];
  updateShowContextUsage: [enabled: boolean];
  updateShowInMenuBar: [enabled: boolean];
  updateUseNetworkProxy: [enabled: boolean];
  updateWorkspacePaneLayout: [layout: WorkspacePaneLayout];
  updateDefaultTextViewMode: [mode: TextViewMode];
  updateWebService: [patch: { enabled?: boolean; port?: number }];
}>();

const languageOptions: Array<{ value: AppLanguage; label: string }> = [
  { value: "auto", label: "自动检测（简体中文）" },
  { value: "zh-CN", label: "简体中文" }
];
const workspacePaneLayoutOptions: Array<{
  value: WorkspacePaneLayout;
  label: string;
}> = [
  { value: "agent-editor", label: "目录｜智能体｜文本内容" },
  { value: "editor-agent", label: "目录｜文本内容｜智能体" }
];
const textViewModeOptions: Array<{ value: TextViewMode; label: string }> = [
  { value: "edit", label: "编辑" },
  { value: "preview", label: "预览" }
];
</script>

<template>
  <section class="settings-group">
    <h2 class="settings-group-title">权限</h2>
    <div
      class="settings-card"
      role="radiogroup"
      aria-label="智能体默认审批方式"
    >
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>请求批准</strong
          ><small>智能体修改或写入正文前，需要由你确认。</small></span
        >
        <span class="settings-toggle"
          ><input
            type="radio"
            name="general-permission-mode"
            :checked="permissionMode === 'request-approval'"
            aria-label="请求批准"
            @change="emit('updatePermissionMode', 'request-approval')"
        /></span>
      </label>
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>替我审批</strong
          ><small
            >智能体产生写入后立即自动批准，并在后台串行保存。自动审批可能会出错。</small
          ></span
        >
        <span class="settings-toggle"
          ><input
            type="radio"
            name="general-permission-mode"
            :checked="permissionMode === 'auto-approve'"
            aria-label="替我审批"
            @change="emit('updatePermissionMode', 'auto-approve')"
        /></span>
      </label>
    </div>

    <div class="settings-card">
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>跨阶段操作自动审批</strong
          ><small
            >开启后，主智能体和子智能体的跨阶段操作将自动允许，不再逐笔询问；变更提案仍按上方审批方式处理。</small
          ></span
        >
        <span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="autoApproveCrossStageOperations"
            aria-label="跨阶段操作自动审批"
            @change="
              emit(
                'updateAutoApproveCrossStageOperations',
                ($event.target as HTMLInputElement).checked
              )
            "
        /></span>
      </label>
    </div>

    <h2 class="settings-group-title">常规</h2>
    <div class="settings-card">
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>自动保存</strong
          ><small>文稿发生变化并停止输入片刻后，自动保存到本机</small></span
        >
        <span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="autoSaveEnabled"
            @change="
              emit(
                'updateAutoSave',
                ($event.target as HTMLInputElement).checked
              )
            "
        /></span>
      </label>
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>上下文使用显示</strong
          ><small>在创作输入框中显示当前模型的上下文占用进度</small></span
        >
        <span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="showContextUsage"
            aria-label="上下文使用显示"
            @change="
              emit(
                'updateShowContextUsage',
                ($event.target as HTMLInputElement).checked
              )
            "
        /></span>
      </label>
      <div class="settings-item settings-select-item">
        <span class="settings-item-text"
          ><strong>页面布局</strong
          ><small>调整创作空间中智能体与文本内容的位置</small></span
        >
        <PopupSelect
          class="general-select-control"
          :model-value="workspacePaneLayout"
          :options="workspacePaneLayoutOptions"
          accessible-label="选择创作空间页面布局"
          align="end"
          :menu-min-width="238"
          @update:model-value="
            emit(
              'updateWorkspacePaneLayout',
              String($event) as WorkspacePaneLayout
            )
          "
        />
      </div>
      <div class="settings-item settings-select-item">
        <span class="settings-item-text"
          ><strong>默认文本模式</strong
          ><small
            >打开软件或切换文本时的默认显示方式，文本页内仍可随时手动切换</small
          ></span
        >
        <PopupSelect
          class="general-select-control"
          :model-value="defaultTextViewMode"
          :options="textViewModeOptions"
          accessible-label="选择默认文本模式"
          align="end"
          :menu-min-width="210"
          @update:model-value="
            emit('updateDefaultTextViewMode', String($event) as TextViewMode)
          "
        />
      </div>
      <div class="settings-item settings-select-item">
        <span class="settings-item-text"
          ><strong>语言</strong
          ><small>应用 UI 语言；当前版本提供简体中文</small></span
        >
        <PopupSelect
          class="general-select-control"
          :model-value="language"
          :options="languageOptions"
          accessible-label="选择应用语言"
          align="end"
          :menu-min-width="210"
          @update:model-value="
            emit('updateLanguage', String($event) as AppLanguage)
          "
        />
      </div>
      <label class="settings-item"
        ><span class="settings-item-text"
          ><strong>在菜单栏中显示</strong
          ><small>关闭主窗口后，仍在菜单栏中保留应用图标</small></span
        ><span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="showInMenuBar"
            @change="
              emit(
                'updateShowInMenuBar',
                ($event.target as HTMLInputElement).checked
              )
            " /></span
      ></label>
    </div>

    <h2 class="settings-group-title">网络设置</h2>
    <div class="settings-card">
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>网络代理</strong
          ><small
            >默认直连模型服务。开启后使用系统或环境变量中的 HTTP 代理，适合需要
            VPN 的接口。</small
          ></span
        >
        <span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="useNetworkProxy"
            aria-label="网络代理"
            @change="
              emit(
                'updateUseNetworkProxy',
                ($event.target as HTMLInputElement).checked
              )
            "
        /></span>
      </label>
    </div>

    <h2 class="settings-group-title">Web 服务</h2>
    <div class="settings-card">
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>浏览器访问</strong
          ><small
            >在本机 127.0.0.1 启动 Web
            服务，用浏览器打开同一写作空间；仅本机可访问。</small
          ></span
        >
        <span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="webService.enabled"
            aria-label="启用 Web 服务"
            @change="
              emit('updateWebService', {
                enabled: ($event.target as HTMLInputElement).checked
              })
            "
        /></span>
      </label>
      <div class="settings-item settings-select-item">
        <span class="settings-item-text"
          ><strong>端口</strong
          ><small
            >服务监听端口（1024–65535）；运行中修改请先关闭服务</small
          ></span
        >
        <input
          class="web-service-port-input"
          type="number"
          min="1024"
          max="65535"
          :value="webService.port"
          :disabled="webService.enabled"
          aria-label="Web 服务端口"
          @change="
            emit('updateWebService', {
              port: Number(($event.target as HTMLInputElement).value)
            })
          "
        />
      </div>
      <p class="web-service-status" data-testid="web-service-status">
        <template v-if="webServiceStatus.running && webServiceStatus.url">
          运行中：<a
            class="web-service-status-link"
            :href="webServiceStatus.url"
            target="_blank"
            rel="noreferrer"
            >{{ webServiceStatus.url }}</a
          >
        </template>
        <template v-else-if="webServiceStatus.error"
          >启动失败：{{ webServiceStatus.error }}</template
        >
        <template v-else>已停止</template>
      </p>
    </div>
  </section>
</template>

<style scoped src="./settings-page.css"></style>
<style scoped>
.settings-select-item {
  flex-wrap: wrap;
}

.settings-select-item .settings-item-text {
  min-width: min(240px, 100%);
}

.general-select-control {
  width: 210px;
  min-width: 160px;
  max-width: 210px;
  flex: 0 1 210px;
}

.web-service-port-input {
  width: 120px;
  padding: 6px 10px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font: inherit;
}

.web-service-port-input:disabled {
  opacity: 0.6;
}

.web-service-status {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.85em;
}

.web-service-status-link {
  color: var(--accent);
}
</style>
