import * as core from '@actions/core';
import { ActionConfig } from './types';

export function getConfig(): ActionConfig {
  const excludeRaw = core.getInput('exclude-patterns');

  return {
    githubToken: core.getInput('github-token', { required: true }),
    openaiApiKey: core.getInput('openai-api-key', { required: true }),
    model: core.getInput('model') || 'gpt-5.4',
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
}
