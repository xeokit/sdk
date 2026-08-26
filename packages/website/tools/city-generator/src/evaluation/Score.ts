import type {Candidate} from "./Candidate";
import type {EvaluationContext} from "./EvaluationContext";

export interface EvaluationBreakdown {
  evaluator: string;
  score: number;
  weight: number;
  weightedScore: number;
  notes?: string[];
}

export interface EvaluationScore {
  score: number;
  breakdown: EvaluationBreakdown[];
}

export interface Evaluator<T = unknown> {
  name: string;
  defaultWeight: number;
  evaluate(candidate: Candidate<T>, context: EvaluationContext): number;
  describe?(candidate: Candidate<T>, context: EvaluationContext, score: number): string[];
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
