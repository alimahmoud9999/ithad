/** Backend-neutral error: callers only ever read `message`. */
export interface RepoError {
  message: string;
}

/** Result shape for repository calls whose callers branch on success/failure. */
export interface RepoResult<T> {
  data: T | null;
  error: RepoError | null;
}

/** A plain row / partial row as sent to the backend (column name → value). */
export type RowPatch = Record<string, unknown>;
