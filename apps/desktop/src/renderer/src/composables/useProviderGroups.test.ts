import { describe, expect, it } from "vitest";
import type { ModelApi } from "@deepwrite/contracts";
import {
  applyProviderConnection,
  createProviderModelDraft,
  groupProviderModels,
  mergeRemoteProviderModels,
  removeProviderModels,
  type ProviderConnectionInput
} from "./useProviderGroups";
import type { DraftModel } from "../components/modelSettingsDraft";

function draftModel(overrides: Partial<DraftModel> = {}): DraftModel {
  return {
    id: overrides.id ?? "model-1",
    label: overrides.label ?? "模型一",
    provider: overrides.provider ?? "fx",
    modelId: overrides.modelId ?? "grok-4.5",
    api: (overrides.api ?? "openai-responses") as ModelApi,
    baseUrl: overrides.baseUrl ?? "https://api.example.com/v1",
    reasoning: overrides.reasoning ?? true,
    defaultThinkingLevel: overrides.defaultThinkingLevel ?? "medium",
    thinkingLevelOptions: overrides.thinkingLevelOptions ?? [
      "low",
      "medium",
      "high"
    ],
    temperatureOptions: overrides.temperatureOptions ?? [0.1, 0.7, 1],
    hasApiKey: overrides.hasApiKey ?? false,
    ...overrides
  };
}

describe("groupProviderModels", () => {
  it("groups models by provider and reports connection state", () => {
    const models = [
      draftModel({ id: "a", provider: "fx" }),
      draftModel({ id: "b", provider: "fx", hasApiKey: true }),
      draftModel({ id: "c", provider: "ollama" })
    ];
    const groups = groupProviderModels(models, "b");
    expect(groups).toHaveLength(2);
    expect(groups[0]?.provider).toBe("fx");
    expect(groups[0]?.models.map((model) => model.id)).toEqual(["a", "b"]);
    expect(groups[0]?.hasApiKey).toBe(true);
    expect(groups[0]?.containsDefault).toBe(true);
    expect(groups[1]?.provider).toBe("ollama");
    expect(groups[1]?.containsDefault).toBe(false);
  });

  it("keeps insertion order of first appearance", () => {
    const models = [
      draftModel({ id: "a", provider: "beta" }),
      draftModel({ id: "b", provider: "alpha" }),
      draftModel({ id: "c", provider: "beta" })
    ];
    expect(
      groupProviderModels(models, "").map((group) => group.provider)
    ).toEqual(["beta", "alpha"]);
  });
});

describe("createProviderModelDraft", () => {
  it("prefills connection fields and marks typed keys", () => {
    const draft = createProviderModelDraft({
      provider: "fx",
      api: "openai-responses",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test"
    });
    expect(draft.provider).toBe("fx");
    expect(draft.api).toBe("openai-responses");
    expect(draft.baseUrl).toBe("https://api.example.com/v1");
    expect(draft.hasApiKey).toBe(true);
    expect(draft.apiKey).toBe("sk-test");
    expect(draft.modelId).toBe("");
  });
});

describe("applyProviderConnection", () => {
  it("updates every model under the provider including rename and key", () => {
    const models = [
      draftModel({ id: "a", provider: "fx" }),
      draftModel({ id: "b", provider: "fx" }),
      draftModel({ id: "c", provider: "ollama" })
    ];
    const connection: ProviderConnectionInput = {
      provider: "fx2",
      api: "openai-completions",
      baseUrl: "https://new.example.com/v1",
      apiKey: "sk-new"
    };
    const next = applyProviderConnection(models, "fx", connection);
    expect(next.find((model) => model.id === "a")?.provider).toBe("fx2");
    expect(next.find((model) => model.id === "a")?.baseUrl).toBe(
      "https://new.example.com/v1"
    );
    expect(next.find((model) => model.id === "a")?.apiKey).toBe("sk-new");
    expect(next.find((model) => model.id === "b")?.provider).toBe("fx2");
    expect(next.find((model) => model.id === "c")?.provider).toBe("ollama");
  });

  it("keeps existing keys when no key is typed", () => {
    const models = [draftModel({ id: "a", provider: "fx", hasApiKey: true })];
    const next = applyProviderConnection(models, "fx", {
      provider: "fx",
      api: "openai-responses",
      baseUrl: "https://api.example.com/v1"
    });
    expect(next[0]).not.toHaveProperty("apiKey");
    expect(next[0]?.hasApiKey).toBe(true);
  });
});

describe("removeProviderModels", () => {
  it("removes only the target provider group", () => {
    const models = [
      draftModel({ id: "a", provider: "fx" }),
      draftModel({ id: "b", provider: "ollama" })
    ];
    const next = removeProviderModels(models, "fx");
    expect(next.map((model) => model.id)).toEqual(["b"]);
  });
});

describe("mergeRemoteProviderModels", () => {
  it("adds new remote models and keeps local ids untouched", () => {
    const models = [draftModel({ id: "local-1", modelId: "grok-4.5" })];
    const remote = [
      { id: "grok-4.5", label: "Grok 4.5" },
      { id: "grok-4.6", label: "Grok 4.6" }
    ];
    const result = mergeRemoteProviderModels(models, "fx", remote, {
      provider: "fx",
      api: "openai-responses",
      baseUrl: "https://api.example.com/v1"
    });
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    const kept = result.models.find((model) => model.id === "local-1");
    expect(kept?.label).toBe("Grok 4.5");
    const added = result.models.find((model) => model.modelId === "grok-4.6");
    expect(added).toBeDefined();
    expect(added?.id).not.toBe("local-1");
    expect(added?.reasoning).toBe(true);
  });

  it("preserves custom capacity when refreshing an existing model", () => {
    const models = [
      draftModel({
        id: "local-1",
        modelId: "grok-4.5",
        contextWindow: 131_072,
        maxTokens: 32_768
      })
    ];
    const remote = [
      { id: "grok-4.5", contextWindow: 272_000, maxTokens: 128_000 }
    ];
    const result = mergeRemoteProviderModels(models, "fx", remote, {
      provider: "fx",
      api: "openai-responses",
      baseUrl: "https://api.example.com/v1"
    });
    expect(result.models[0]?.contextWindow).toBe(131_072);
    expect(result.models[0]?.maxTokens).toBe(32_768);
  });

  it("applies the connection api key to newly imported models", () => {
    const remote = [{ id: "glm-5.2", label: "glm-5.2" }];
    const result = mergeRemoteProviderModels([], "zai", remote, {
      provider: "zai",
      api: "openai-completions",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      apiKey: "  test-key  "
    });
    expect(result.added).toBe(1);
    expect(result.models[0]?.apiKey).toBe("test-key");
    expect(result.models[0]?.hasApiKey).toBe(true);
  });
});
