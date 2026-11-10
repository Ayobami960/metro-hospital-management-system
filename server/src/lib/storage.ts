import { createHash, randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Object storage boundary. Clinical files must never be publicly addressable:
 * the database stores a random key, and the only way a client reads a file is
 * `GET /files/:id/download`, which checks scope and then mints a short-lived
 * signed URL. No filename, MRN or patient name is ever part of a key.
 */
export interface UploadInput {
  buffer: Buffer;
  contentType: string;
  ownerType: string;
  extension: string;
}

export interface StoredObject {
  provider: "CLOUDINARY";
  key: string;
  url: string | null;
  sizeBytes: number;
  checksumSha256: string;
}

export interface StorageProvider {
  upload(input: UploadInput): Promise<StoredObject>;
  destroy(key: string, contentType: string): Promise<void>;
  signedUrl(key: string, contentType: string, extension: string): Promise<string>;
}

const resourceTypeFor = (contentType: string): "image" | "video" | "raw" => {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "raw";
};

/** `public_id` is a UUID; the extension is the only client-derived component. */
const buildKey = (ownerType: string): string =>
  `${env.cloudinary.folder}/${ownerType.toLowerCase()}/${randomUUID()}`;

class CloudinaryStorage implements StorageProvider {
  private configured = false;

  private configure(): void {
    if (this.configured) return;
    const { cloudName, apiKey, apiSecret } = env.cloudinary;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary credentials are not configured");
    }
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.configured = true;
  }

  async upload(input: UploadInput): Promise<StoredObject> {
    this.configure();
    const key = buildKey(input.ownerType);
    const result = await new Promise<{ public_id: string; secure_url?: string; bytes: number }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${env.cloudinary.folder}/${input.ownerType.toLowerCase()}`,
            public_id: key.slice(key.lastIndexOf("/") + 1),
            resource_type: resourceTypeFor(input.contentType),
            // Authenticated assets are not fetchable from a raw URL.
            type: "private",
            access_mode: "authenticated",
            overwrite: false,
            invalidate: true,
            // No tags, context or display name: Cloudinary metadata must not
            // become a side channel for PHI.
          },
          (error, uploaded) => {
            if (error || !uploaded) {
              reject(error ?? new Error("Cloudinary upload returned no result"));
              return;
            }
            resolve(uploaded as { public_id: string; secure_url?: string; bytes: number });
          },
        );
        stream.end(input.buffer);
      },
    );

    return {
      provider: "CLOUDINARY",
      key: result.public_id || key,
      url: null,
      sizeBytes: input.buffer.length,
      checksumSha256: createHash("sha256").update(input.buffer).digest("hex"),
    };
  }

  async destroy(key: string, contentType: string): Promise<void> {
    this.configure();
    await cloudinary.uploader.destroy(key, {
      resource_type: resourceTypeFor(contentType),
      type: "private",
      invalidate: true,
    });
  }

  async signedUrl(key: string, contentType: string, extension: string): Promise<string> {
    this.configure();
    this.assertDeliveryConfigured();
    return cloudinary.utils.private_download_url(key, extension, {
      resource_type: resourceTypeFor(contentType),
      type: "private",
      expires_at: Math.floor(Date.now() / 1000) + env.cloudinary.urlExpiresSeconds,
      attachment: false,
    });
  }

  private assertDeliveryConfigured(): void {
    if (!env.cloudinary.cloudName) {
      throw new Error("Cloudinary is not configured for private delivery");
    }
  }
}

/**
 * Deterministic stand-in used by tests and local development when Cloudinary
 * credentials are absent. It never touches the network and never returns a real
 * signed URL, which is exactly what the tests need to assert scope safely.
 */
export class MemoryStorage implements StorageProvider {
  readonly objects = new Map<string, { buffer: Buffer; contentType: string }>();

  async upload(input: UploadInput): Promise<StoredObject> {
    const key = buildKey(input.ownerType);
    this.objects.set(key, { buffer: input.buffer, contentType: input.contentType });
    return {
      provider: "CLOUDINARY",
      key,
      url: null,
      sizeBytes: input.buffer.length,
      checksumSha256: createHash("sha256").update(input.buffer).digest("hex"),
    };
  }

  async destroy(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async signedUrl(key: string): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + env.cloudinary.urlExpiresSeconds;
    const signature = createHash("sha256").update(`${key}:${expires}`).digest("hex").slice(0, 16);
    return `https://storage.test/${encodeURIComponent(key)}?expires=${expires}&signature=${signature}`;
  }
}

let cached: StorageProvider | null = null;

export const storage = (): StorageProvider => {
  if (cached) return cached;
  const configured = Boolean(
    env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret,
  );
  if (env.isTest) {
    cached = new MemoryStorage();
  } else if (configured) {
    cached = new CloudinaryStorage();
  } else {
    logger.warn(
      { provider: "memory" },
      "Cloudinary credentials are missing; using the in-memory storage adapter",
    );
    cached = new MemoryStorage();
  }
  return cached;
};

/** Test hook: a fresh adapter per test file that needs isolation. */
export const resetStorage = (): void => {
  cached = null;
};
