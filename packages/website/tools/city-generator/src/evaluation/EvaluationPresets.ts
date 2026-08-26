import type {CityGeneratorConfig, EvaluationPresetName} from "../types";

export interface ResolvedEvaluationConfig {
  enabled: boolean;
  threshold?: number;
  maxRetries?: number;
  weights?: Record<string, number>;
}

const presets: Record<EvaluationPresetName, ResolvedEvaluationConfig> = {
  fast: {
    enabled: true,
    threshold: 0.5,
    maxRetries: 0,
    weights: {
      "Walkability": 0.9,
      "Block Quality": 0.8,
      "Pattern Fit": 0.75,
      "Profile Fit": 0.7,
      "Skyline": 0.65,
      "Variety": 0.55,
      "Landmark Quality": 0.45
    }
  },
  balanced: {
    enabled: true,
    threshold: 0.56,
    maxRetries: 1,
    weights: {
      "Walkability": 1,
      "Block Quality": 0.95,
      "Pattern Fit": 1,
      "Profile Fit": 0.9,
      "Skyline": 0.8,
      "Variety": 0.7,
      "Landmark Quality": 0.65
    }
  },
  quality: {
    enabled: true,
    threshold: 0.62,
    maxRetries: 2,
    weights: {
      "Walkability": 1.1,
      "Block Quality": 1.05,
      "Pattern Fit": 1.1,
      "Profile Fit": 1,
      "Skyline": 0.95,
      "Variety": 0.85,
      "Landmark Quality": 0.8
    }
  }
};

export function resolveEvaluationPreset(config: Partial<CityGeneratorConfig>): ResolvedEvaluationConfig {
  const presetName = config.evaluationPreset ?? "balanced";
  const preset = presets[presetName] || presets.balanced;
  return {
    enabled: config.evaluation?.enabled ?? preset.enabled,
    threshold: config.evaluation?.threshold ?? preset.threshold,
    maxRetries: config.evaluation?.maxRetries ?? preset.maxRetries,
    weights: {
      ...preset.weights,
      ...config.evaluation?.weights
    }
  };
}

export function evaluationPresetNames(): EvaluationPresetName[] {
  return ["fast", "balanced", "quality"];
}
