import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { EnvVars } from '../../../config/env.config';

export type ImageType = 'jpg' | 'png' | 'webp';

/** Recognises an image by its first bytes, so a file cannot pass as a photo just by claiming a MIME type. */
export function detectImageType(bytes: Buffer): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

/**
 * Where photo files live. Today: a folder on the API server's disk (fine for development and a single
 * server; the files are served at /media). When an object-storage provider is chosen (S3, R2, ...),
 * only this class changes: `save` uploads and `remove` deletes, and the rest of the API is untouched.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(config: ConfigService<EnvVars, true>) {
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  /** Stores the bytes under the user's own folder and returns the storage path (`{userId}/{uuid}.{ext}`). */
  async save(userId: string, bytes: Buffer, type: ImageType): Promise<string> {
    const path = `${userId}/${randomUUID()}.${type}`;
    const target = join(this.root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return path;
  }

  /** Best effort: a missing file must not stop the database record from being deleted. */
  async remove(path: string): Promise<void> {
    const target = resolve(this.root, path);
    if (!target.startsWith(this.root)) return; // never delete outside the upload folder
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`could not delete ${path}: ${(error as Error).message}`);
      }
    }
  }
}
