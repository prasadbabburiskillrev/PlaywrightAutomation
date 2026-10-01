import path from 'path';
import { Locator } from '@playwright/test';

// Exactly what Playwright's setInputFiles accepts: one or more paths on disk,
// or one or more in-memory { name, mimeType, buffer } payloads (not mixed).
export type UploadFiles = Parameters<Locator['setInputFiles']>[0];
type FilePayload = { name: string; mimeType: string; buffer: Buffer };

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

// Small, real, committed files covering the two accepted families the portal
// lists ("jpeg, jpg, pdf, png").
export const SAMPLE_PDF = path.join(UPLOADS_DIR, 'sample-document.pdf');
export const SAMPLE_PNG = path.join(UPLOADS_DIR, 'sample-image.png');

// Rejection cases are generated in memory rather than committed: an 11 MB
// file has no business in git, and a .txt fixture adds nothing a buffer
// doesn't.
export function unsupportedTypeFile(): FilePayload {
  return { name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('not an accepted file type') };
}

// The portal's limit is 10 MB ("Single File Size: 10 MB"); 11 MB is safely over.
export function oversizedFile(): FilePayload {
  return { name: 'oversized.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024, 'A') };
}
