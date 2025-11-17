/**
 * Model utilities and metadata
 */

import { ModelConfig, ModelMetadata } from './types.js';

/**
 * Centralized model metadata registry
 */
export const MODEL_METADATA: Record<string, ModelMetadata> = {
  'copilot/gpt-4o': {
    label: 'GPT-4o',
    shortLabel: 'GPT-4o',
    description: 'Best balance of quality and speed'
  },
  'copilot/gpt-4o-mini': {
    label: 'GPT-4o Mini',
    shortLabel: 'GPT-4o mini',
    description: 'Faster, cheaper for simple tasks'
  },
  'copilot/claude-3.5-sonnet': {
    label: 'Claude 3.5 Sonnet',
    shortLabel: 'Claude 3.5',
    description: "Anthropic's latest model"
  },
  'copilot/o1': {
    label: 'o1',
    shortLabel: 'o1',
    description: 'Advanced reasoning model'
  },
  'copilot/o1-mini': {
    label: 'o1 Mini',
    shortLabel: 'o1 mini',
    description: 'Efficient reasoning model'
  }
};

/**
 * Default model string
 */
export const DEFAULT_MODEL = 'copilot/gpt-4o';

/**
 * Type guard for valid model strings
 */
export function isValidModelString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.includes('/');
}

/**
 * Type guard for valid chat strategy
 */
export function isValidChatStrategy(value: unknown): value is 'useChatModel' | 'useConfiguredModel' {
  return value === 'useChatModel' || value === 'useConfiguredModel';
}

/**
 * Parse model configuration string with validation
 */
export function parseModelConfig(modelString: string): ModelConfig {
  const parts = modelString.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid model format: ${modelString}. Expected format: provider/model-name`);
  }
  return { vendor: parts[0], family: parts[1] };
}

/**
 * Get model metadata or return default for unknown models
 */
export function getModelMetadata(modelString: string): ModelMetadata {
  const metadata = MODEL_METADATA[modelString];
  if (metadata) {
    return metadata;
  }

  // Return sensible defaults for unknown models
  try {
    const config = parseModelConfig(modelString);
    return {
      label: config.family,
      shortLabel: config.family,
      description: `${config.vendor} model`
    };
  } catch {
    return {
      label: 'Unknown',
      shortLabel: 'Unknown',
      description: modelString
    };
  }
}

/**
 * Format model string for status bar display
 */
export function formatModelForStatusBar(modelString: string): { text: string; tooltip: string } {
  const metadata = getModelMetadata(modelString);
  return {
    text: `$(hubot) ${metadata.shortLabel}`,
    tooltip: `Nanodex Model: ${metadata.label}\nClick to view configuration`
  };
}

/**
 * Get list of available model options
 */
export function getAvailableModels(): Array<{ label: string; description: string; value: string }> {
  return Object.entries(MODEL_METADATA).map(([value, metadata]) => ({
    label: metadata.label,
    description: metadata.description,
    value
  }));
}
