import type { ModelApi } from "@deepwrite/contracts";

interface ModelProviderPresetTarget {
  provider: string;
  api: ModelApi;
  baseUrl: string;
}

interface ModelProviderOption {
  value: string;
  label: string;
  description?: string;
  api?: ModelApi;
  baseUrl?: string;
  /** Providers offered in the domestic (China) quick-pick menu. */
  domestic?: boolean;
}

export interface ProviderConnectionPreset {
  value: string;
  label: string;
  api: ModelApi;
  baseUrl: string;
}

export const MODEL_PROVIDER_OPTIONS = [
  {
    value: "deepseek",
    label: "DeepSeek",
    api: "openai-completions",
    baseUrl: "https://api.deepseek.com/v1",
    domestic: true
  },
  {
    value: "kimi-coding",
    label: "Kimi Coding",
    api: "anthropic-messages",
    baseUrl: "https://api.kimi.com/coding",
    domestic: true
  },
  {
    value: "minimax-codeplan",
    label: "MiniMax Plan",
    api: "openai-completions",
    baseUrl: "https://api.minimaxi.com/v1",
    domestic: true
  },
  {
    value: "xiaomi-token-plan-cn",
    label: "小米 MiMo TokenPlan（国内）",
    api: "openai-responses",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    domestic: true
  },
  {
    value: "dashscope",
    label: "阿里云百炼",
    api: "openai-completions",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    domestic: true
  },
  {
    value: "zai",
    label: "Z.AI 开放平台（国际站）",
    api: "openai-completions",
    baseUrl: "https://api.z.ai/api/paas/v4",
    domestic: true
  },
  {
    value: "volcengine",
    label: "火山引擎（豆包）",
    description: "按量直连，填写方舟控制台提供的模型 ID 或接入点 ID",
    api: "openai-completions",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
  },
  {
    value: "volcengine-plan",
    label: "火山引擎 Coding Plan",
    description: "套餐接口，模型 ID 可填 ark-code-latest 或套餐模型名",
    api: "openai-completions",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3"
  },
  {
    value: "zai-coding-cn",
    label: "智谱 Z.AI Coding Plan",
    api: "openai-completions",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    domestic: true
  },
  {
    value: "zhipu",
    label: "智谱 GLM 开放平台",
    api: "openai-completions",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    domestic: true
  },
  {
    value: "moonshot",
    label: "Kimi 开放平台",
    api: "openai-completions",
    baseUrl: "https://api.moonshot.cn/v1",
    domestic: true
  },
  {
    value: "siliconflow",
    label: "硅基流动 SiliconFlow",
    api: "openai-completions",
    baseUrl: "https://api.siliconflow.cn/v1",
    domestic: true
  },
  {
    value: "volc-ark",
    label: "火山方舟（豆包）",
    api: "openai-completions",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    domestic: true
  },
  {
    value: "openai",
    label: "OpenAI",
    api: "openai-responses",
    baseUrl: "https://api.openai.com/v1"
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "使用 OpenRouter API Key，模型 ID 需包含提供商前缀",
    api: "openai-completions",
    baseUrl: "https://openrouter.ai/api/v1"
  },
  {
    value: "opencode-go",
    label: "OpenCode Go",
    description: "Go 套餐，使用 OpenCode API Key；请按模型选择 API 协议",
    api: "openai-completions",
    baseUrl: "https://opencode.ai/zen/go/v1"
  },
  {
    value: "anthropic",
    label: "Anthropic",
    api: "anthropic-messages",
    baseUrl: "https://api.anthropic.com"
  },
  {
    value: "google",
    label: "Google",
    api: "google-generative-ai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta"
  },
  {
    value: "ollama",
    label: "Ollama",
    api: "openai-completions",
    baseUrl: "http://127.0.0.1:11434/v1"
  },
  { value: "custom", label: "其他兼容服务" }
] as const satisfies ReadonlyArray<ModelProviderOption>;

/** Curated domestic providers shown in the quick-add menu. */
export const DOMESTIC_PROVIDER_PRESETS: ReadonlyArray<ProviderConnectionPreset> =
  MODEL_PROVIDER_OPTIONS.flatMap((option) => {
    if (!("domestic" in option) || option.domestic !== true) return [];
    if (!("api" in option) || !("baseUrl" in option)) return [];
    return [
      {
        value: option.value,
        label: option.label,
        api: option.api,
        baseUrl: option.baseUrl
      }
    ];
  });

export function applyProviderPresetDefaults(
  target: ModelProviderPresetTarget,
  provider: string
): void {
  target.provider = provider;
  const preset = MODEL_PROVIDER_OPTIONS.find(
    (option) => option.value === provider
  );
  if (preset && "api" in preset && "baseUrl" in preset) {
    target.api = preset.api;
    target.baseUrl = preset.baseUrl;
  }
}
