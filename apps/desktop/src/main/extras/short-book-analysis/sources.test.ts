import { mkdtemp, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEnvelope as envelope,
  ShortBookAnalysisSourceSchema,
  ShortBookAnalysisCatalogSchema,
  type CommandEnvelope
} from "@deepwrite/contracts";
import { withShortBookAnalysisSources } from "../../../utilities/short-book-analysis-sources";
import {
  handleShortBookAnalysisCommands,
  type ShortAnalysisCommandContext
} from "./commands";
import { ShortBookAnalysisConfigStore } from "./config-store";
function createEnvelope<T, K extends string>(type: K, payload: T) {
  return envelope(type, payload, {
    id: "test-command",
    correlationId: "test-command"
  });
}
const roots: string[] = [];
async function setup() {
  const path = await mkdtemp(join(tmpdir(), "short-analysis-"));
  roots.push(path);
  const core = withShortBookAnalysisSources(async (command) => ({
    status: "rejected",
    requestId: command.id,
    error: { code: "unused", message: "unused" }
  }));
  const dialog = { showOpenDialog: vi.fn() };
  const ctx = {
    dialog,
    getMainWindow: () => undefined,
    configStore: () => new ShortBookAnalysisConfigStore(path),
    getWorkspaceDirectory: async () => path,
    core
  } as unknown as ShortAnalysisCommandContext;
  return { path, core, ctx, dialog };
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  );
});
describe("short analysis source import and Core snapshots", () => {
  it("imports whole TXT and Markdown, retains headings and never changes originals", async () => {
    const { path, ctx, dialog } = await setup();
    const txt = join(path, "story.txt");
    const md = join(path, "other.md");
    const body = "第一章 来信\n正文\n第二章 告别\n完整结局";
    await writeFile(txt, body);
    await writeFile(md, "# 标题\n另一篇正文");
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [txt, md]
    });
    const imported = await handleShortBookAnalysisCommands(
      ctx,
      createEnvelope("shortBookAnalysis.chooseSources", {})
    );
    expect(imported?.status).toBe("accepted");
    const sources =
      imported?.status === "accepted" ? imported.payload : undefined;
    expect(Array.isArray(sources) && sources.length).toBe(2);
    const first = ShortBookAnalysisSourceSchema.parse(
      (sources as unknown[])[0]
    );
    expect(first.text).toBe(body);
    expect(await readFile(txt, "utf8")).toBe(body);
    const loaded = await handleShortBookAnalysisCommands(
      ctx,
      createEnvelope("shortBookAnalysis.loadSource", { sourceId: first.id })
    );
    expect(loaded?.status === "accepted" && loaded.payload).toEqual(first);
  });
  it("persists pasted text and does not cap historical sources at ten", async () => {
    const { ctx } = await setup();
    for (let i = 0; i < 11; i++)
      expect(
        (
          await handleShortBookAnalysisCommands(
            ctx,
            createEnvelope("shortBookAnalysis.addText", {
              title: `故事${i}`,
              text: "完整正文"
            })
          )
        )?.status
      ).toBe("accepted");
    const result = await handleShortBookAnalysisCommands(
      ctx,
      createEnvelope("shortBookAnalysis.listSources", {})
    );
    expect(
      result?.status === "accepted" &&
        ShortBookAnalysisCatalogSchema.parse(result.payload).sources.length
    ).toBe(11);
  });
  it("cancels without saving and rejects blank bodies and direct internal commands", async () => {
    const { ctx, dialog, path } = await setup();
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const canceled = await handleShortBookAnalysisCommands(
      ctx,
      createEnvelope("shortBookAnalysis.chooseSources", {})
    );
    expect(canceled?.status === "accepted" && canceled.payload).toBeNull();
    expect(
      (
        await handleShortBookAnalysisCommands(
          ctx,
          createEnvelope("shortBookAnalysis.addText", {
            title: "空白",
            text: "  "
          })
        )
      )?.status
    ).toBe("rejected");
    expect(
      (
        await handleShortBookAnalysisCommands(
          ctx,
          createEnvelope("shortBookAnalysis.querySources", {
            workspaceDirectory: path
          })
        )
      )?.status
    ).toBe("rejected");
  });
  it("rejects source directory symlinks", async () => {
    const { path, core } = await setup();
    const external = await mkdtemp(join(tmpdir(), "short-external-"));
    roots.push(external);
    await symlink(external, join(path, "short-book-analysis-sources"));
    expect(
      (
        await core(
          createEnvelope("shortBookAnalysis.querySources", {
            workspaceDirectory: path
          }) as CommandEnvelope
        )
      ).status
    ).toBe("rejected");
  });
});
