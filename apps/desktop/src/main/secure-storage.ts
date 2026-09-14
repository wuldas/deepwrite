import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SECRET_KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export interface SecureStorage {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

function deriveEnvironmentKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function loadNodeStorageKey(userDataPath: string): Buffer {
  const configuredSecret = process.env.DEEPWRITE_WEB_SECRET?.trim();
  if (configuredSecret) {
    return deriveEnvironmentKey(configuredSecret);
  }

  const keyPath = join(userDataPath, "config", "web-secret.key");
  mkdirSync(join(userDataPath, "config"), { recursive: true });
  if (existsSync(keyPath)) {
    const key = readFileSync(keyPath);
    if (key.byteLength === SECRET_KEY_BYTES) return key;
    throw new Error("独立 Web 服务密钥文件无效，请删除后重新启动。 ");
  }

  const key = randomBytes(SECRET_KEY_BYTES);
  writeFileSync(keyPath, key, { mode: 0o600, flag: "wx" });
  return key;
}

/** AES-GCM storage for the standalone Node service. */
export class NodeSecureStorage implements SecureStorage {
  private readonly key: Buffer;

  constructor(userDataPath: string) {
    this.key = loadNodeStorageKey(userDataPath);
  }

  isEncryptionAvailable(): boolean {
    return this.key.byteLength === SECRET_KEY_BYTES;
  }

  encryptString(value: string): Buffer {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]);
  }

  decryptString(value: Buffer): string {
    if (value.byteLength < IV_BYTES + AUTH_TAG_BYTES) {
      throw new Error("独立 Web 服务密文无效。 ");
    }
    const iv = value.subarray(0, IV_BYTES);
    const authTag = value.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const ciphertext = value.subarray(IV_BYTES + AUTH_TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString("utf8");
  }
}
