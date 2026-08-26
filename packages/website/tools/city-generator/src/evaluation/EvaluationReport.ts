import type {Candidate} from "./Candidate";
import type {EvaluationScore} from "./Score";
import type {EvaluationStage} from "./EvaluationContext";

export interface CandidateEvaluationReport {
  id: string;
  label?: string;
  score: number;
  metrics?: Record<string, number>;
  tags?: string[];
  notes: string[];
}

export interface EvaluationReport {
  id: string;
  stage: EvaluationStage;
  subjectId?: string;
  selectedCandidateId: string;
  selectedScore: number;
  threshold: number;
  attemptCount: number;
  candidateCount: number;
  accepted: boolean;
  candidates: CandidateEvaluationReport[];
}

export interface EvaluationSummary {
  count: number;
  averageScore: number;
  minimumScore: number;
  byStage: Record<string, {
    count: number;
    averageScore: number;
    minimumScore: number;
  }>;
}

export interface CompactCandidateEvaluationReport {
  id: string;
  label?: string;
  score: number;
  tags?: string[];
  notes?: string[];
  metrics?: Record<string, number>;
}

export interface CompactEvaluationReport {
  id: string;
  stage: EvaluationReport["stage"];
  subjectId?: string;
  selectedCandidateId: string;
  selectedScore: number;
  threshold: number;
  attemptCount: number;
  candidateCount: number;
  accepted: boolean;
  candidates: CompactCandidateEvaluationReport[];
}

export function createCandidateReport(candidate: Candidate, score: EvaluationScore, selected: boolean): CandidateEvaluationReport {
  const notes = score.breakdown
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 4)
    .flatMap((entry) => entry.notes?.length ? entry.notes : [`${entry.evaluator}: ${entry.score.toFixed(2)}`]);
  return {
    id: candidate.id,
    label: candidate.label,
    score: roundScore(score.score),
    metrics: compactMetrics(candidate.metrics),
    tags: candidate.tags,
    notes: selected ? ["Selected", ...notes] : notes
  };
}

export function summarizeEvaluationReports(reports: EvaluationReport[] = []): EvaluationSummary {
  const byStage: EvaluationSummary["byStage"] = {};
  let total = 0;
  let min = 1;
  for (const report of reports) {
    total += report.selectedScore;
    min = Math.min(min, report.selectedScore);
    const stage = byStage[report.stage] || {count: 0, averageScore: 0, minimumScore: 1};
    stage.count++;
    stage.averageScore += report.selectedScore;
    stage.minimumScore = Math.min(stage.minimumScore, report.selectedScore);
    byStage[report.stage] = stage;
  }
  for (const stage of Object.values(byStage)) {
    stage.averageScore = roundScore(stage.averageScore / Math.max(1, stage.count));
    stage.minimumScore = roundScore(stage.minimumScore);
  }
  return {
    count: reports.length,
    averageScore: roundScore(total / Math.max(1, reports.length)),
    minimumScore: reports.length ? roundScore(min) : 0,
    byStage
  };
}

export function compactEvaluationReports(reports: EvaluationReport[] = []): CompactEvaluationReport[] {
  return reports.map((report) => {
    const detailed = report.stage === "road-layout"
      || report.stage === "block-subdivision"
      || report.stage === "park-placement"
      || report.stage === "landmark-placement";
    return {
      id: report.id,
      stage: report.stage,
      subjectId: report.subjectId,
      selectedCandidateId: report.selectedCandidateId,
      selectedScore: report.selectedScore,
      threshold: report.threshold,
      attemptCount: report.attemptCount,
      candidateCount: report.candidateCount,
      accepted: report.accepted,
      candidates: report.candidates
        .slice(0, detailed ? 6 : 3)
        .map((candidate) => ({
          id: candidate.id,
          label: candidate.label,
          score: candidate.score,
          tags: candidate.tags,
          notes: detailed ? candidate.notes.slice(0, 3) : candidate.notes.slice(0, 1),
          metrics: detailed ? candidate.metrics : undefined
        }))
    };
  });
}

function compactMetrics(metrics: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!metrics) {
    return undefined;
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (Number.isFinite(value)) {
      result[key] = Math.round(value * 1000) / 1000;
    }
  }
  return result;
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}
