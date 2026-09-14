import { contextBridge } from "electron";

import { createElectronTransport } from "./electron-transport";
import { setDeepWriteTransport } from "./invoke";
import { deepWriteApi } from "./api-object";
import { conversationPersistence } from "./conversation-persistence-api";
import { deviceSync } from "./device-sync-api";

contextBridge.exposeInMainWorld("deepwrite", {
  ...deepWriteApi,
  conversationPersistence,
  deviceSync
});
