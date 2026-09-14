import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  ShortBookAnalysisProfileSchema,
  ShortBookAnalysisSettingsInputSchema,
  ShortBookAnalysisSettingsSchema,
  type ShortBookAnalysisProfile,
  type ShortBookAnalysisPreset,
  type ShortBookAnalysisSettings,
  type ShortBookAnalysisSettingsInput
} from "@deepwrite/contracts";
const characterPrompt =
  "你是短篇拆书分析师。基于完整短篇，分析人物目标、冲突、关系、关键选择及人物弧光，提炼可复用的人物设计方法。多本输入时比较共性与差异，并标明书名证据。";
const plotStructurePrompt =
  "你是短篇拆书分析师。分析整篇的开头钩子、核心冲突、情节递进、反转、高潮、结尾和节奏，提炼可复用结构。不要按章节拆分。多本输入时比较共性与差异，并标明书名证据。";
const stylePrompt =
  "你是短篇拆书分析师。分析完整短篇的叙述视角、句式、用词、对白和描写，提炼可执行的写作规则及检查清单。多本输入时比较共性与差异，并标明书名证据。避免大段照抄正文。";

interface DiskSettings {
  version: 1;
  presets: Array<Omit<ShortBookAnalysisPreset, "builtin">>;
  updatedAt?: string;
}

export const DEFAULT_SHORT_BOOK_ANALYSIS_PRESETS = Object.freeze([
  {
    selectionMode: "single",
    id: "plot-structure",
    name: "剧情结构",
    description: "拆解短篇冲突、反转、节奏与完整结构。",
    systemPrompt: plotStructurePrompt,
    output: { domain: "material", kind: "plot", stageId: "pacing" }
  },
  {
    selectionMode: "single",
    id: "character",
    name: "人物",
    description: "拆解人物目标、关系、功能、选择和阶段性弧光。",
    systemPrompt: characterPrompt,
    output: { domain: "material", kind: "character", stageId: "character" }
  },
  {
    selectionMode: "single",
    id: "style",
    name: "文风",
    description: "提炼适用于短篇写作的行文规则与检查清单。",
    systemPrompt: stylePrompt,
    output: {
      domain: "skill",
      kind: "style",
      stageId: "expert_section_writer"
    }
  }
] as const satisfies readonly Omit<ShortBookAnalysisPreset, "builtin">[]);

const defaultIds = new Set<string>(
  DEFAULT_SHORT_BOOK_ANALYSIS_PRESETS.map(({ id }) => id)
);

function cloneDefaults(): Array<Omit<ShortBookAnalysisPreset, "builtin">> {
  return DEFAULT_SHORT_BOOK_ANALYSIS_PRESETS.map((preset) =>
    structuredClone(preset)
  );
}

function includeMissingDefaults(
  presets: readonly Omit<ShortBookAnalysisPreset, "builtin">[]
): Array<Omit<ShortBookAnalysisPreset, "builtin">> {
  const existingIds = new Set(presets.map((preset) => preset.id));
  return [
    ...cloneDefaults().filter((preset) => !existingIds.has(preset.id)),
    ...presets.map((preset) => structuredClone(preset))
  ];
}

function defaultDiskSettings(): DiskSettings {
  return { version: 1, presets: cloneDefaults() };
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function normalizeDiskSettings(raw: unknown): DiskSettings {
  if (!raw || typeof raw !== "object") return defaultDiskSettings();
  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.presets)) {
    return defaultDiskSettings();
  }
  const parsed = ShortBookAnalysisSettingsInputSchema.safeParse({
    presets: candidate.presets
  });
  if (!parsed.success) return defaultDiskSettings();
  const timestampValue =
    typeof candidate.updatedAt === "string"
      ? Date.parse(candidate.updatedAt)
      : Number.NaN;
  const timestamp = Number.isFinite(timestampValue)
    ? new Date(timestampValue).toISOString()
    : undefined;
  return {
    version: 1,
    presets: includeMissingDefaults(parsed.data.presets),
    ...(timestamp ? { updatedAt: timestamp } : {})
  };
}

function publicSettings(disk: DiskSettings): ShortBookAnalysisSettings {
  return ShortBookAnalysisSettingsSchema.parse({
    presets: disk.presets.map((preset) => ({
      ...structuredClone(preset),
      ...(defaultIds.has(preset.id) ? { builtin: true } : {})
    })),
    ...(disk.updatedAt ? { updatedAt: disk.updatedAt } : {})
  });
}

async function atomicWrite(path: string, value: DiskSettings): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporary, path);
}

export class ShortBookAnalysisConfigStore {
  private readonly settingsPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(userDataPath: string) {
    this.settingsPath = join(
      userDataPath,
      "config",
      "short-book-analysis-presets.json"
    );
  }

  async list(): Promise<ShortBookAnalysisSettings> {
    await this.writeChain;
    return publicSettings(await this.readDisk());
  }

  async save(
    rawInput: ShortBookAnalysisSettingsInput
  ): Promise<ShortBookAnalysisSettings> {
    const input = ShortBookAnalysisSettingsInputSchema.parse(rawInput);
    return this.enqueue(async () => ({
      version: 1,
      presets: includeMissingDefaults(input.presets),
      updatedAt: new Date().toISOString()
    }));
  }

  async reset(presetId?: string): Promise<ShortBookAnalysisSettings> {
    return this.enqueue(async () => {
      if (!presetId) {
        return {
          ...defaultDiskSettings(),
          updatedAt: new Date().toISOString()
        };
      }
      const replacement = DEFAULT_SHORT_BOOK_ANALYSIS_PRESETS.find(
        (preset) => preset.id === presetId
      );
      if (!replacement) throw new Error("该自定义预设没有可恢复的默认版本。");
      const current = await this.readDisk();
      const index = current.presets.findIndex(
        (preset) => preset.id === presetId
      );
      const presets = current.presets.map((preset) => structuredClone(preset));
      if (index >= 0) presets.splice(index, 1, structuredClone(replacement));
      else presets.push(structuredClone(replacement));
      return { version: 1, presets, updatedAt: new Date().toISOString() };
    });
  }

  async resolve(presetId: string): Promise<ShortBookAnalysisProfile> {
    const preset = (await this.list()).presets.find(
      (candidate) => candidate.id === presetId
    );
    if (!preset) throw new Error("选择的短篇拆书预设已不存在，请刷新后重试。");
    return ShortBookAnalysisProfileSchema.parse(preset);
  }

  private async enqueue(
    operation: () => Promise<DiskSettings>
  ): Promise<ShortBookAnalysisSettings> {
    let saved: ShortBookAnalysisSettings | undefined;
    const pending = this.writeChain.then(async () => {
      const disk = await operation();
      saved = publicSettings(disk);
      ShortBookAnalysisSettingsInputSchema.parse(saved);
      await atomicWrite(this.settingsPath, disk);
    });
    this.writeChain = pending.then(
      () => undefined,
      () => undefined
    );
    await pending;
    return saved!;
  }

  private async readDisk(): Promise<DiskSettings> {
    return normalizeDiskSettings(await readJson(this.settingsPath));
  }
}
