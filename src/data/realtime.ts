export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RecordChange<T = any> {
  type: ChangeType;
  /** The row after the change (empty on DELETE). */
  record: T;
  /** The row before the change, when the backend provides it. */
  old: Partial<T>;
}

export interface TableSubscription {
  table: string;
  onChange: (change: RecordChange) => void;
}

export interface RealtimeGateway {
  /** Listen to row changes on the given tables; returns an unsubscribe function. */
  subscribe(subscriptions: TableSubscription[]): () => void;
}
