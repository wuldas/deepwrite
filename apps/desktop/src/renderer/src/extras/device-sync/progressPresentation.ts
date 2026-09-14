import type { SyncStatus } from "@deepwrite/contracts/renderer";
import { syncPresentation } from "./presentation";

export function syncProgressPresentation(status: SyncStatus, pending: boolean) {
  const view = syncPresentation(status);
  const { phase, title, total, completed, filesTotal, filesCompleted } =
    status.progress;
  const first = status.issues.some((issue) => issue.reason === "first-sync");
  const currentItem = pending
    ? title.match(/^(?:上传到远端|下载到本机|读取变化)：([\s\S]+)$/)?.[1]
    : undefined;
  const transferring = phase === "transferring" || phase === "applying";
  const determinate =
    total > 0 &&
    (pending ? transferring : ["complete", "partial"].includes(phase));
  const done = Math.min(total, Math.max(0, completed));
  let badge: string;
  let stage: string;
  if (pending) {
    if (phase === "saving") [badge, stage] = ["准备中", "正在准备本机内容"];
    else if (phase === "checking")
      [badge, stage] = ["检查中", "正在检查远端更新"];
    else if (phase === "applying")
      [badge, stage] = ["写入中", "正在写入本机内容"];
    else if (phase === "transferring" && title.startsWith("上传到远端"))
      [badge, stage] = ["上传中", "正在上传本机修改"];
    else if (phase === "transferring" && title.startsWith("下载到本机"))
      [badge, stage] = ["下载中", "正在下载远端更新"];
    else if (phase === "transferring")
      [badge, stage] = ["读取中", "正在读取变化内容"];
    else [badge, stage] = ["处理中", "正在处理同步操作"];
  } else if (first) [badge, stage] = ["待确认", "请确认首次同步内容"];
  else if (phase === "failed") [badge, stage] = ["未完成", "本次操作未完成"];
  else if (phase === "cancelled") [badge, stage] = ["已取消", "本次操作已取消"];
  else if (phase === "partial") [badge, stage] = ["待处理", "本次操作已结束"];
  else if (phase === "complete") [badge, stage] = ["已完成", "本次操作已完成"];
  else if (!status.firstSyncConfirmed)
    [badge, stage] = ["待初始化", "请先预览首次同步"];
  else if (
    view.uploads.length ||
    view.downloads.length ||
    view.adoptionKeys.length
  )
    [badge, stage] = ["待同步", "等待手动同步"];
  else if (!status.lastCheckedAt)
    [badge, stage] = ["待检查", "等待检查远端更新"];
  else [badge, stage] = ["已对齐", "本机与已检查的远端一致"];

  return {
    badge,
    stage,
    determinate,
    completed: done,
    total,
    percent: determinate ? (done / total) * 100 : 0,
    count: determinate ? `${done} / ${total} 项` : pending ? "请稍候" : "—",
    detail: currentItem ? `正在处理：${currentItem}` : title || view.title,
    secondary: pending
      ? transferring && filesTotal
        ? `当前作品文件 ${Math.min(filesTotal, Math.max(0, filesCompleted ?? 0))} / ${filesTotal}`
        : phase === "checking"
          ? "只检查其他设备已上传的变更记录"
          : "完成后显示本次同步结果"
      : title
        ? view.title
        : "选择上传本机修改，或下载远端更新"
  };
}
