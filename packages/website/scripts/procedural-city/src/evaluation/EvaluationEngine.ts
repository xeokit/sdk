import type {Candidate} from "./Candidate";
import type {CandidateGenerator} from "./CandidateGenerator";
import type {EvaluationContext} from "./EvaluationContext";
import type {EvaluationReport} from "./EvaluationReport";
import {createCandidateReport} from "./EvaluationReport";
import type {EvaluationScore, Evaluator} from "./Score";
import {clampScore} from "./Score";
import {WalkabilityEvaluator} from "./evaluators/WalkabilityEvaluator";
import {BlockQualityEvaluator} from "./evaluators/BlockQualityEvaluator";
import {SkylineEvaluator} from "./evaluators/SkylineEvaluator";
import {PatternEvaluator} from "./evaluators/PatternEvaluator";
import {ProfileEvaluator} from "./evaluators/ProfileEvaluator";
import {LandmarkEvaluator} from "./evaluators/LandmarkEvaluator";
import {VarietyEvaluator} from "./evaluators/VarietyEvaluator";

const reportSinks = new WeakMap<object, EvaluationReport[]>();

export interface EvaluationOptions {
  threshold?: number;
  maxRetries?: number;
  weights?: Record<string, number>;
  report?: boolean;
}

export interface RankedCandidate<T = unknown> {
  candidate: Candidate<T>;
  score: EvaluationScore;
}

export interface SelectionResult<T = unknown> {
  candidate: Candidate<T>;
  score: EvaluationScore;
  report?: EvaluationReport;
}

export class EvaluationEngine {
  private evaluators: Evaluator[];
  private weights: Record<string, number>;

  constructor(evaluators: Evaluator[], weights: Record<string, number> = {}) {
    this.evaluators = evaluators;
    this.weights = weights;
  }

  evaluate<T>(candidate: Candidate<T>, context: EvaluationContext, options: EvaluationOptions = {}): EvaluationScore {
    const breakdown = this.evaluators.map((evaluator) => {
      const weight = options.weights?.[evaluator.name] ?? this.weights[evaluator.name] ?? evaluator.defaultWeight;
      const score = clampScore(evaluator.evaluate(candidate, context));
      return {
        evaluator: evaluator.name,
        score,
        weight,
        weightedScore: score * weight,
        notes: evaluator.describe?.(candidate, context, score)
      };
    }).filter((entry) => entry.weight > 0);
    const weightTotal = breakdown.reduce((sum, entry) => sum + entry.weight, 0);
    const weightedTotal = breakdown.reduce((sum, entry) => sum + entry.weightedScore, 0);
    return {
      score: weightTotal > 0 ? clampScore(weightedTotal / weightTotal) : 0,
      breakdown
    };
  }

  rank<T>(candidates: Candidate<T>[], context: EvaluationContext, options: EvaluationOptions = {}): RankedCandidate<T>[] {
    return candidates
      .map((candidate) => ({
        candidate,
        score: this.evaluate(candidate, context, options)
      }))
      .sort((a, b) => {
        if (b.score.score !== a.score.score) {
          return b.score.score - a.score.score;
        }
        return a.candidate.id.localeCompare(b.candidate.id);
      });
  }

  selectBest<T>(candidates: Candidate<T>[], context: EvaluationContext, options: EvaluationOptions = {}): SelectionResult<T> {
    const ranked = this.rank(candidates, context, options);
    const best = ranked[0];
    if (!best) {
      throw new Error(`[EvaluationEngine] No candidates supplied for ${context.stage}`);
    }
    const threshold = options.threshold ?? 0;
    const report = options.report === false
      ? undefined
      : createReport(context, ranked, best, threshold, 1);
    return {
      candidate: best.candidate,
      score: best.score,
      report
    };
  }

  selectWithRetries<T>(
    generator: CandidateGenerator<T>,
    context: EvaluationContext,
    options: EvaluationOptions = {}
  ): SelectionResult<T> {
    const threshold = options.threshold ?? 0.55;
    const maxRetries = options.maxRetries ?? 1;
    let bestOverall: RankedCandidate<T> | undefined;
    let bestRanked: RankedCandidate<T>[] = [];
    let attemptCount = 0;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attemptCount = attempt + 1;
      const candidates = generator(attempt, context);
      const ranked = this.rank(candidates, context, options);
      if (!ranked.length) {
        continue;
      }
      const best = ranked[0];
      if (!bestOverall || best.score.score > bestOverall.score.score) {
        bestRanked = ranked;
        bestOverall = best;
      }
      if (best.score.score >= threshold) {
        break;
      }
    }
    if (!bestOverall) {
      throw new Error(`[EvaluationEngine] No candidates generated for ${context.stage}`);
    }
    const bestSelection: SelectionResult<T> = {
      candidate: bestOverall.candidate,
      score: bestOverall.score
    };
    if (options.report !== false) {
      bestSelection.report = createReport(context, bestRanked, bestOverall, threshold, attemptCount);
    }
    return bestSelection;
  }
}

export function createDefaultUrbanEvaluationEngine(weights: Record<string, number> = {}): EvaluationEngine {
  return new EvaluationEngine([
    new WalkabilityEvaluator(),
    new BlockQualityEvaluator(),
    new SkylineEvaluator(),
    new PatternEvaluator(),
    new ProfileEvaluator(),
    new LandmarkEvaluator(),
    new VarietyEvaluator()
  ], weights);
}

export function appendEvaluationReport(context: EvaluationContext, report: EvaluationReport | undefined): void {
  if (!report) {
    return;
  }
  const reports = context.config ? reportSinks.get(context.config) : undefined;
  if (reports) {
    reports.push(report);
  }
}

export function setEvaluationReportSink(config: object, reports: EvaluationReport[]): void {
  reportSinks.set(config, reports);
}

function createReport<T>(
  context: EvaluationContext,
  ranked: RankedCandidate<T>[],
  best: RankedCandidate<T>,
  threshold: number,
  attemptCount: number
): EvaluationReport {
  const selectedId = best.candidate.id;
  return {
    id: `${context.stage}:${context.subjectId || selectedId}`,
    stage: context.stage,
    subjectId: context.subjectId,
    selectedCandidateId: selectedId,
    selectedScore: round(best.score.score),
    threshold: round(threshold),
    attemptCount,
    candidateCount: ranked.length,
    accepted: best.score.score >= threshold,
    candidates: ranked.slice(0, 6).map((entry) => createCandidateReport(entry.candidate, entry.score, entry.candidate.id === selectedId))
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
