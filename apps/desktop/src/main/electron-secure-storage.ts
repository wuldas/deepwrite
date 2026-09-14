import { safeStorage } from "electron";
import type { SecureStorage } from "./secure-storage";

export const electronSecureStorage: SecureStorage = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (value) => safeStorage.encryptString(value),
  decryptString: (value) => safeStorage.decryptString(value)
};
