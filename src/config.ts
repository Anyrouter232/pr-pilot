import * as core from '@actions/core';
import { ActionConfig, ProviderName } from './types';

export function getConfig(): ActionConfig {
  const excludeRaw = core.getInput('exclude-patterns');
  const provider = (core.getInput('provider') || 'openai') as ProviderName;

  const config: ActionConfig = {
    githubToken: core.getInput('github-token', { required: true }),
    provider,
    openaiApiKey: core.getInput('openai-api-key') || '',
    anthropicApiKey: core.getInput('anthropic-api-key') || '',
    geminiApiKey: core.getInput('gemini-api-key') || '',
    model: core.getInput('model') || '',
    maxFiles: parseInt(core.getInput('max-files') || '20', 10),
    excludePatterns: excludeRaw
      ? excludeRaw
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
    reviewLevel: (core.getInput('review-level') || 'standard') as ActionConfig['reviewLevel'],
    customPrompt: core.getInput('custom-prompt') || '',
    postSummary: core.getInput('post-summary') !== 'false',
    failOnIssues: core.getInput('fail-on-issues') === 'true',
  };

  validateProviderApiKey(config);

  return config;
}

function validateProviderApiKey(config: ActionConfig): void {
  const keyMap: Record<ProviderName, string> = {
    openai: config.openaiApiKey,
    anthropic: config.anthropicApiKey,
    gemini: config.geminiApiKey,
  };

  const key = keyMap[config.provider];
  if (!key) {
    throw new Error(
      `API key required for provider "${config.provider}". ` +
        `Set the "${config.provider === 'openai' ? 'openai-api-key' : config.provider === 'anthropic' ? 'anthropic-api-key' : 'gemini-api-key'}" input.`
    );
  }
}

export function resolveApiKey(config: ActionConfig): string {
  const keyMap: Record<ProviderName, string> = {
    openai: config.openaiApiKey,
    anthropic: config.anthropicApiKey,
    gemini: config.geminiApiKey,
  };
  return keyMap[config.provider];
}
