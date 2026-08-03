export interface Candidate<T = unknown> {
  id: string;
  label?: string;
  value: T;
  metrics?: Record<string, number>;
  tags?: string[];
  notes?: string[];
}

export function candidateMetric(candidate: Candidate, key: string, fallback = 0): number {
  const value = candidate.metrics?.[key];
  return Number.isFinite(value) ? Number(value) : fallback;
}
