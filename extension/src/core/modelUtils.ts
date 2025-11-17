/**
 * Model utilities and metadata
 *
 * This module provides centralized utilities for managing language model configurations,
 * including metadata registry, validation, parsing, and formatting for UI display.
 *
 * @module modelUtils
 */

import { ModelConfig, ModelMetadata } from './types.js';

/**
 * Centralized model metadata registry mapping model identifiers to their display metadata.
 *
 * Model identifiers follow the format: `provider/model-name`
 *
 * @example
 * ```typescript
 * const metadata = MODEL_METADATA['copilot/gpt-4o'];
 * console.log(metadata.label); // 'GPT-4o'
 * ```
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
 * Default model identifier used when no model is configured.
 *
 * @constant
 * @default 'copilot/gpt-4o'
 */
export const DEFAULT_MODEL = 'copilot/gpt-4o';

/**
 * Type guard to validate model string format at runtime.
 *
 * A valid model string must be non-empty and contain a '/' separator
 * between provider and model name.
 *
 * @param value - Value to check
 * @returns True if value is a valid model string
 *
 * @example
 * ```typescript
 * isValidModelString('copilot/gpt-4o'); // true
 * isValidModelString('invalid'); // false
 * isValidModelString(''); // false
 * ```
 */
export function isValidModelString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.includes('/');
}

/**
 * Type guard to validate chat strategy configuration at runtime.
 *
 * @param value - Value to check
 * @returns True if value is a valid chat strategy
 *
 * @example
 * ```typescript
 * isValidChatStrategy('useChatModel'); // true
 * isValidChatStrategy('useConfiguredModel'); // true
 * isValidChatStrategy('invalid'); // false
 * ```
 */
export function isValidChatStrategy(value: unknown): value is 'useChatModel' | 'useConfiguredModel' {
  return value === 'useChatModel' || value === 'useConfiguredModel';
}

/**
 * Parse model configuration string into vendor and family components.
 *
 * @param modelString - Model identifier in format 'provider/model-name'
 * @returns Parsed configuration with vendor and family
 * @throws {Error} If model string format is invalid
 *
 * @example
 * ```typescript
 * const config = parseModelConfig('copilot/gpt-4o');
 * // { vendor: 'copilot', family: 'gpt-4o' }
 *
 * parseModelConfig('invalid'); // throws Error
 * ```
 */
export function parseModelConfig(modelString: string): ModelConfig {
  const parts = modelString.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid model format: ${modelString}. Expected format: provider/model-name`);
  }
  return { vendor: parts[0], family: parts[1] };
}

/**
 * Get model metadata or return default metadata for unknown models.
 *
 * This function looks up the model in the metadata registry. If not found,
 * it attempts to parse the model string and generate sensible defaults.
 *
 * @param modelString - Model identifier in format 'provider/model-name'
 * @returns Model metadata for display
 *
 * @example
 * ```typescript
 * const metadata = getModelMetadata('copilot/gpt-4o');
 * // { label: 'GPT-4o', shortLabel: 'GPT-4o', description: '...' }
 *
 * const unknown = getModelMetadata('custom/unknown-model');
 * // { label: 'unknown-model', shortLabel: 'unknown-model', description: 'custom model' }
 * ```
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
 * Format model string for status bar display with icon and tooltip.
 *
 * @param modelString - Model identifier in format 'provider/model-name'
 * @returns Object containing formatted text and tooltip for status bar
 *
 * @example
 * ```typescript
 * const formatted = formatModelForStatusBar('copilot/gpt-4o');
 * // {
 * //   text: '$(hubot) GPT-4o',
 * //   tooltip: 'Nanodex Model: GPT-4o\nClick to view configuration'
 * // }
 * ```
 */
export function formatModelForStatusBar(modelString: string): { text: string; tooltip: string } {
  const metadata = getModelMetadata(modelString);
  return {
    text: `$(hubot) ${metadata.shortLabel}`,
    tooltip: `Nanodex Model: ${metadata.label}\nClick to view configuration`
  };
}

/**
 * Get list of available model options for use in quick pick menus.
 *
 * @returns Array of model options with label, description, and value
 *
 * @example
 * ```typescript
 * const models = getAvailableModels();
 * const selected = await vscode.window.showQuickPick(models, {
 *   placeHolder: 'Select a model'
 * });
 * ```
 */
export function getAvailableModels(): Array<{ label: string; description: string; value: string }> {
  return Object.entries(MODEL_METADATA).map(([value, metadata]) => ({
    label: metadata.label,
    description: metadata.description,
    value
  }));
}
