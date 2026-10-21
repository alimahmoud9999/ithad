export interface StagedObligation {
  id: string;
  type: 'monthly_dues' | 'custom';
  title: string;
  amount: number;
  month: number; // 1 to 12
  year: number; // e.g. 2026
}
