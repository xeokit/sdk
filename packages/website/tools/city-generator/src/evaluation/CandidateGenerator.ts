import type {Candidate} from "./Candidate";
import type {EvaluationContext} from "./EvaluationContext";

export type CandidateGenerator<T = unknown> = (attempt: number, context: EvaluationContext) => Candidate<T>[];
