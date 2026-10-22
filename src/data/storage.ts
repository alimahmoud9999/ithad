import type { RepoError } from './result';

export interface FileStorage {
  /** Stores a file and returns its public URL (`url` may be null if the backend has none). */
  upload(
    bucket: string,
    path: string,
    data: ArrayBuffer,
    contentType: string
  ): Promise<{ url: string | null; error: RepoError | null }>;
}
