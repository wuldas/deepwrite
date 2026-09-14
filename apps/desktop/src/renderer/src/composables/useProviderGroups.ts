import {
  BUILT_IN_REASONING_LEVELS,
  type RemoteModelListItem
} from "@deepwrite/contracts";
import { createId } from "@deepwrite/shared";
import {
  cloneDraftModel,
  type DraftModel
} from "../components/modelSettingsDraft";

/** Connection-level fields shared by every model under one provider. */
export interface ProviderConnectionInput {
  provider: string;
  api: DraftModel["api"];
  baseUrl: string;
  /** Plain-text key typed by the user; empty means keep existing keys. */
  apiKey?: string;
}

export interface ProviderGroup {
  provider: string;
  models: DraftModel[];
  baseUrl: string;
  api: DraftModel["api"];
  hasApiKey: boolean;
  containsDefault: boolean;
}

export interface RemoteMergeResult {
  models: DraftModel[];
  added: number;
  updated: number;
}

function normalizedProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

export function groupProviderModels(
  models: readonly DraftModel[],
  defaultModelId: string
): ProviderGroup[] {
  const buckets = new Map<string, DraftModel[]>();
  for (const model of models) {
    const key = model.provider;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(model);
    else buckets.set(key, [model]);
  }
  return [...buckets.entries()].map(([provider, groupModels]) => ({
    provider,
    models: groupModels,
    baseUrl: groupModels[0]?.baseUrl ?? "",
    api: groupModels[0]?.api ?? "openai-completions",
    hasApiKey: groupModels.some((model) => model.hasApiKey),
    containsDefault: groupModels.some((model) => model.id === defaultModelId)
  }));
}

export function createProviderModelDraft(
  connection: ProviderConnectionInput
): DraftModel {
  return cloneDraftModel({
    id: createId("model"),
    label: "",
    provider: normalizedProvider(connection.provider),
    modelId: "",
    api: connection.api,
    baseUrl: connection.baseUrl.trim(),
    reasoning: true,
    defaultThinkingLevel: "medium",
    thinkingLevelOptions: [...BUILT_IN_REASONING_LEVELS],
    temperatureOptions: [0.1, 0.7, 1],
    hasApiKey: Boolean(connection.apiKey?.trim()),
    apiKey: connection.apiKey?.trim() ?? "",
    customThinkingLevel: ""
  });
}

export function applyProviderConnection(
  models: readonly DraftModel[],
  provider: string,
  connection: ProviderConnectionInput
): DraftModel[] {
  const nextProvider = normalizedProvider(connection.provider);
  const apiKey = connection.apiKey?.trim() ?? "";
  return models.map((model) => {
    if (normalizedProvider(model.provider) !== normalizedProvider(provider)) {
      return model;
    }
    return {
      ...model,
      provider: nextProvider,
      api: connection.api,
      baseUrl: connection.baseUrl.trim(),
      ...(apiKey ? { apiKey, hasApiKey: true } : {})
    };
  });
}

export function removeProviderModels(
  models: readonly DraftModel[],
  provider: string
): DraftModel[] {
  const target = normalizedProvider(provider);
  return models.filter(
    (model) => normalizedProvider(model.provider) !== target
  );
}

function sanitizeThinkingOptions(
  remote: readonly string[] | undefined,
  fallback: readonly string[],
  reasoning: boolean
): string[] {
  if (!reasoning) return [...fallback];
  const candidates = [...(remote ?? fallback)].filter(
    (level) => level !== "off"
  );
  const unique = [...new Set(candidates)];
  return unique.length > 0 ? unique : [...BUILT_IN_REASONING_LEVELS];
}

function resolveDefaultThinkingLevel(
  reasoning: boolean,
  options: readonly string[],
  remoteDefault: string | undefined,
  localDefault: string
): DraftModel["defaultThinkingLevel"] {
  if (!reasoning) return "off";
  const candidates = [remoteDefault, localDefault, "medium"];
  for (const candidate of candidates) {
    if (candidate && candidate !== "off" && options.includes(candidate)) {
      return candidate as DraftModel["defaultThinkingLevel"];
    }
  }
  return (options[0] ?? "medium") as DraftModel["defaultThinkingLevel"];
}

function remoteItemToDraft(
  item: RemoteModelListItem,
  connection: ProviderConnectionInput
): DraftModel {
  const reasoning = item.reasoning ?? true;
  const options = sanitizeThinkingOptions(
    item.thinkingLevelOptions,
    BUILT_IN_REASONING_LEVELS,
    reasoning
  );
  return cloneDraftModel({
    id: createId("model"),
    label: item.label?.trim() || item.id,
    provider: normalizedProvider(connection.provider),
    modelId: item.id,
    requestModelId: item.requestModelId,
    supportsDeveloperRole: item.supportsDeveloperRole,
    toolSchemaProfile: item.toolSchemaProfile,
    api: connection.api,
    baseUrl: connection.baseUrl.trim(),
    reasoning,
    defaultThinkingLevel: resolveDefaultThinkingLevel(
      reasoning,
      options,
      item.defaultThinkingLevel,
      "medium"
    ),
    thinkingLevelOptions: options as DraftModel["thinkingLevelOptions"],
    temperatureOptions: item.temperatureOptions ?? [0.1, 0.7, 1],
    contextWindow: item.contextWindow,
    maxTokens: item.maxTokens,
    hasApiKey: Boolean(connection.apiKey?.trim()),
    apiKey: connection.apiKey?.trim() ?? "",
    customThinkingLevel: ""
  });
}

function applyRemoteItem(
  model: DraftModel,
  item: RemoteModelListItem,
  connection: ProviderConnectionInput
): DraftModel {
  const reasoning = item.reasoning ?? model.reasoning;
  const options = sanitizeThinkingOptions(
    item.thinkingLevelOptions,
    model.thinkingLevelOptions,
    reasoning
  );
  return cloneDraftModel({
    ...model,
    label: item.label?.trim() || model.label,
    requestModelId: item.requestModelId ?? model.requestModelId,
    supportsDeveloperRole:
      item.supportsDeveloperRole ?? model.supportsDeveloperRole,
    toolSchemaProfile: item.toolSchemaProfile ?? model.toolSchemaProfile,
    reasoning,
    defaultThinkingLevel: resolveDefaultThinkingLevel(
      reasoning,
      options,
      item.defaultThinkingLevel,
      model.defaultThinkingLevel
    ),
    thinkingLevelOptions: options as DraftModel["thinkingLevelOptions"],
    temperatureOptions: item.temperatureOptions ?? model.temperatureOptions,
    contextWindow: model.contextWindow ?? item.contextWindow,
    maxTokens: model.maxTokens ?? item.maxTokens,
    api: connection.api,
    baseUrl: connection.baseUrl.trim()
  });
}

export function mergeRemoteProviderModels(
  models: readonly DraftModel[],
  provider: string,
  remote: readonly RemoteModelListItem[],
  connection: ProviderConnectionInput
): RemoteMergeResult {
  const target = normalizedProvider(provider);
  const groupModels = models.filter(
    (model) => normalizedProvider(model.provider) === target
  );
  const remoteById = new Map(remote.map((item) => [item.id, item] as const));
  let updated = 0;
  const kept = models.map((model) => {
    if (normalizedProvider(model.provider) !== target) return model;
    const item = remoteById.get(model.modelId);
    if (!item) return model;
    updated += 1;
    return applyRemoteItem(model, item, connection);
  });
  const existingModelIds = new Set(groupModels.map((model) => model.modelId));
  const additions = remote
    .filter((item) => !existingModelIds.has(item.id))
    .map((item) => remoteItemToDraft(item, connection));
  return {
    models: [...kept, ...additions],
    added: additions.length,
    updated
  };
}
