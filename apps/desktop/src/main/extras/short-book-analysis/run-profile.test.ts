import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import type {
  AgentProviderRuntimeConfig,
  ShortBookAnalysisRuntimeContext
} from "@deepwrite/contracts";
import { ShortBookAnalysisConfigStore } from "./config-store";
import { resolveShortAnalysisProfile } from "./run-profile";
it("resolves the trusted preset and rechecks selection and real model capacity", async () => {
  const path = await mkdtemp(join(tmpdir(), "short-profile-"));
  try {
    const store = new ShortBookAnalysisConfigStore(path);
    const presets = await store.list();
    const id = presets.presets[0]!.id;
    const source = {
      id: "book",
      title: "来信",
      text: "完整正文",
      kind: "paste" as const,
      importedAt: "2026-01-01T00:00:00.000Z"
    };
    const context: ShortBookAnalysisRuntimeContext = {
      jobId: "job",
      presetId: id,
      books: [source, { ...source, id: "second" }]
    };
    const model = {
      contextWindow: 100000,
      maxTokens: 16000
    } as AgentProviderRuntimeConfig;
    await expect(
      resolveShortAnalysisProfile(context, store, model)
    ).rejects.toThrow("一本");
    presets.presets[0]!.selectionMode = "multiple";
    await store.save(presets);
    expect(
      (await resolveShortAnalysisProfile(context, store, model))?.selectionMode
    ).toBe("multiple");
    await expect(
      resolveShortAnalysisProfile(
        { ...context, books: [{ ...source, text: "长".repeat(100000) }] },
        store,
        model
      )
    ).rejects.toThrow("上下文");
    await expect(
      resolveShortAnalysisProfile(
        { ...context, presetId: "missing" },
        store,
        model
      )
    ).rejects.toThrow("不存在");
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});
