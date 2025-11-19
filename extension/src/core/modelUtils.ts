/**
 * Model utilities and metadata
 *
 * This module provides centralized utilities for managing language model configurations,
 * including metadata registry, validation, parsing, and formatting for UI display.
 *
 * @module modelUtils
 */

import * as vscode from 'vscode';
import { ModelConfig, ModelMetadata } from './types.js';

/**
 * Centralized model metadata registry mapping model identifiers to their display metadata.
 *
 * Model identifiers follow the format: `provider/model-name`
 *
 * NOTE: This registry is now optional. Models are dynamically queried from vscode.lm API.
 * This registry only provides enhanced display labels for known models.
 *
 * @example
 * ```typescript
 * const metadata = MODEL_METADATA['copilot/gpt-4o'];
 * console.log(metadata.label); // 'GPT-4o'
 * ```
 */
export const MODEL_METADATA: Record<string, ModelMetadata> = {
  // Hardcoded metadata removed - models are now queried dynamically from vscode.lm API
  // Keeping registry structure for potential future use (custom display names, etc.)
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
 * This function returns a static list based on MODEL_METADATA.
 * For dynamic model detection, use getAvailableModelsFromAPI().
 *
 * NOTE: MODEL_METADATA is now empty - this returns [] to force dynamic API usage.
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
  // Hardcoded models removed - returns empty array to force dynamic API query
  console.warn('[nanodex] getAvailableModels() called but MODEL_METADATA is empty - use getAvailableModelsFromAPI() instead');
  return [];
}

/**
 * Query available language models from VS Code Language Model API.
 *
 * This function dynamically detects all available models at runtime,
 * merging with MODEL_METADATA for enhanced display information.
 *
 * @returns Promise resolving to array of available models with metadata
 *
 * @example
 * ```typescript
 * const models = await getAvailableModelsFromAPI();
 * const selected = await vscode.window.showQuickPick(models, {
 *   placeHolder: 'Select a model'
 * });
 * ```
 */
export async function getAvailableModelsFromAPI(): Promise<Array<{
  id: string;
  vendor: string;
  family: string;
  version?: string;
  label: string;
  description: string;
  value: string;
}>> {
  try {
    // Check if vscode.lm API is available
    if (!vscode.lm || !vscode.lm.selectChatModels) {
      console.error('[nanodex] vscode.lm API not available - this should not happen in VS Code 1.105.0+');
      console.error('[nanodex] Falling back to empty list (no hardcoded models)');
      return [];
    }

    console.log('[nanodex] Querying vscode.lm.selectChatModels() for available models...');

    // Query all available models (no filter)
    const models = await vscode.lm.selectChatModels();

    console.log(`[nanodex] API returned ${models.length} models`);

    if (models.length === 0) {
      console.warn('[nanodex] No language models available from API - is Copilot installed and authenticated?');
      return [];
    }

    // Log each model from API for debugging
    models.forEach((model, index) => {
      console.log(`[nanodex] Model ${index + 1}: id="${model.id}", vendor="${model.vendor}", family="${model.family}", version="${model.version || 'none'}"`);
    });

    // Convert to QuickPick format, merge with metadata for known models
    const result = models.map(model => {
      const modelString = `${model.vendor}/${model.family}`;
      const metadata = MODEL_METADATA[modelString];

      const converted = {
        id: model.id,
        vendor: model.vendor,
        family: model.family,
        version: model.version,
        label: metadata?.label || model.family,
        description: metadata?.description || `${model.vendor} model${model.version ? ` (v${model.version})` : ''}`,
        value: modelString
      };

      console.log(`[nanodex] Converted to: label="${converted.label}", value="${converted.value}"`);
      return converted;
    });

    console.log(`[nanodex] Successfully converted ${result.length} models for display`);
    return result;
  } catch (error) {
    console.error('[nanodex] Failed to query available models from API:', error);
    console.error('[nanodex] Error details:', error instanceof Error ? error.message : String(error));
    // Return empty list - no hardcoded fallback
    return [];
  }
}
