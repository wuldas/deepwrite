import { ipcRenderer } from "electron";
import type { DeepWriteTransport } from "./invoke";

export function createElectronTransport(): DeepWriteTransport {
  return {
    invokeChannel: (channel, payload) =>
      payload === undefined
        ? ipcRenderer.invoke(channel)
        : ipcRenderer.invoke(channel, payload),
    onChannelEvent: (channel, listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: unknown
      ): void => {
        listener(payload);
      };
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    }
  };
}
