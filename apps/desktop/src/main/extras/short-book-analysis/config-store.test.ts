import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ShortBookAnalysisConfigStore } from "./config-store";
import { LongBookAnalysisConfigStore } from "../long-book-analysis/config-store";
describe("short analysis presets", () => {
  it("stores selection modes independently and restores default modes", async () => {
    const path = await mkdtemp(join(tmpdir(), "short-presets-"));
    try {
      const store = new ShortBookAnalysisConfigStore(path);
      const initial = await store.list();
      expect(initial.presets).toHaveLength(3);
      expect(initial.presets.every((p) => p.selectionMode === "single")).toBe(
        true
      );
      initial.presets[0]!.selectionMode = "multiple";
      await store.save(initial);
      expect(
        (
          await new ShortBookAnalysisConfigStore(path).resolve(
            initial.presets[0]!.id
          )
        ).selectionMode
      ).toBe("multiple");
      expect(
        (await new LongBookAnalysisConfigStore(path).list()).presets[0]
      ).not.toHaveProperty("selectionMode");
      await store.reset(initial.presets[0]!.id);
      expect(
        (await store.list()).presets.every((p) => p.selectionMode === "single")
      ).toBe(true);
    } finally {
      await rm(path, { recursive: true, force: true });
    }
  });
});
