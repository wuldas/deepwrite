import type { DeepWriteApi } from "@deepwrite/contracts";
import { deepWriteApi } from "./api-object";
import { setDeepWriteTransport } from "./invoke";
import { createWebTransport } from "./web-transport";

declare global {
  interface Window {
    deepwrite: DeepWriteApi;
  }
}

setDeepWriteTransport(createWebTransport());
window.deepwrite = deepWriteApi;
