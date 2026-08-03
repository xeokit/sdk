import type {Candidate} from "./Candidate";
import type {EvaluationContext} from "./EvaluationContext";
import type {EvaluationOptions, SelectionResult} from "./EvaluationEngine";
import {appendEvaluationReport, createDefaultUrbanEvaluationEngine} from "./EvaluationEngine";

export function selectUrbanCandidate<T>(
  candidates: Candidate<T>[],
  context: EvaluationContext,
  options: EvaluationOptions = {}
): SelectionResult<T> {
  const fallback = candidates[0];
  if (!fallback) {
    throw new Error(`[UrbanEvaluation] No candidates supplied for ${context.stage}`);
  }
  if (context.config?.evaluation?.enabled === false || candidates.length === 1) {
    return {
      candidate: fallback,
      score: {score: 1, breakdown: []}
    };
  }
  const engine = createDefaultUrbanEvaluationEngine(context.config?.evaluation?.weights);
  const result = engine.selectBest(candidates, context, {
    ...options,
    weights: {
      ...options.weights,
      ...context.config?.evaluation?.weights
    }
  });
  appendEvaluationReport(context, result.report);
  return result;
}
