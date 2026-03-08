import * as yaml from 'js-yaml';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionConfig, RepoConfig, ResolvedConfig, Severity, ProviderName } from './types';

type Octokit = ReturnType<typeof github.getOctokit>;

const SEVERITY_ORDER: Severity[] = ['nitpick', 'suggestion', 'warning', 'critical'];

const RESOLVED_DEFAULTS: Omit<ResolvedConfig, keyof ActionConfig> = {
  ignorePaths: [],
  reviewRules: [],
  languageHints: {},
  severityThreshold: 'nitpick',
  maxCommentLength: 0,
  autoApprove: false,
};

export async function loadRepoConfig(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<RepoConfig | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: '.pr-pilot.yml',
      ref,
    });

    if ('content' in data && 'encoding' in data && data.encoding === 'base64') {
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      const parsed = yaml.load(content);
      return validateRepoConfig(parsed);
    }
    return null;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status: number }).status === 404
    ) {
      core.info('No .pr-pilot.yml found in repo root. Using action inputs only.');
      return null;
    }
    core.warning(
      `Failed to load .pr-pilot.yml: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    return null;
  }
}

export function validateRepoConfig(raw: unknown): RepoConfig {
  if (!raw || typeof raw !== 'object') return {};

  const config = raw as Record<string, unknown>;
  const result: RepoConfig = {};

  if (
    typeof config.provider === 'string' &&
    ['openai', 'anthropic', 'gemini'].includes(config.provider)
  ) {
    result.provider = config.provider as ProviderName;
  }

  if (typeof config.model === 'string') {
    result.model = config.model;
  }

  if (typeof config.max_files === 'number' && config.max_files >= 0) {
    result.max_files = config.max_files;
  }

  if (Array.isArray(config.exclude_patterns)) {
    result.exclude_patterns = config.exclude_patterns.filter(
      (p): p is string => typeof p === 'string'
    );
  }

  if (
    typeof config.review_level === 'string' &&
    ['concise', 'standard', 'thorough'].includes(config.review_level)
  ) {
    result.review_level = config.review_level as RepoConfig['review_level'];
  }

  if (typeof config.custom_prompt === 'string') {
    result.custom_prompt = config.custom_prompt;
  }

  if (typeof config.post_summary === 'boolean') {
    result.post_summary = config.post_summary;
  }

  if (typeof config.fail_on_issues === 'boolean') {
    result.fail_on_issues = config.fail_on_issues;
  }

  if (Array.isArray(config.ignore_paths)) {
    result.ignore_paths = config.ignore_paths.filter((p): p is string => typeof p === 'string');
  }

  if (Array.isArray(config.review_rules)) {
    result.review_rules = config.review_rules.filter((r): r is string => typeof r === 'string');
  }

  if (config.language_hints && typeof config.language_hints === 'object') {
    const hints: Record<string, string> = {};
    for (const [key, val] of Object.entries(config.language_hints as Record<string, unknown>)) {
      if (typeof key === 'string' && typeof val === 'string') {
        hints[key] = val;
      }
    }
    result.language_hints = hints;
  }

  if (
    typeof config.severity_threshold === 'string' &&
    SEVERITY_ORDER.includes(config.severity_threshold as Severity)
  ) {
    result.severity_threshold = config.severity_threshold as Severity;
  }

  if (typeof config.max_comment_length === 'number' && config.max_comment_length > 0) {
    result.max_comment_length = config.max_comment_length;
  }

  if (typeof config.auto_approve === 'boolean') {
    result.auto_approve = config.auto_approve;
  }

  return result;
}

export function mergeConfigs(
  actionConfig: ActionConfig,
  repoConfig: RepoConfig | null
): ResolvedConfig {
  const resolved: ResolvedConfig = {
    ...actionConfig,
    ...RESOLVED_DEFAULTS,
  };

  if (!repoConfig) return resolved;

  // Repo-only fields — always apply from repo config
  resolved.ignorePaths = repoConfig.ignore_paths ?? [];
  resolved.reviewRules = repoConfig.review_rules ?? [];
  resolved.languageHints = repoConfig.language_hints ?? {};
  resolved.severityThreshold = repoConfig.severity_threshold ?? 'nitpick';
  resolved.maxCommentLength = repoConfig.max_comment_length ?? 0;
  resolved.autoApprove = repoConfig.auto_approve ?? false;

  // Shared fields — repo config fills gaps when action input is at default
  if (!actionConfig.model && repoConfig.model) {
    resolved.model = repoConfig.model;
  }
  if (repoConfig.custom_prompt && !actionConfig.customPrompt) {
    resolved.customPrompt = repoConfig.custom_prompt;
  }

  // Merge exclude patterns (combine both)
  if (repoConfig.exclude_patterns && repoConfig.exclude_patterns.length > 0) {
    resolved.excludePatterns = [
      ...new Set([...resolved.excludePatterns, ...repoConfig.exclude_patterns]),
    ];
  }

  // Merge ignore paths into exclude patterns
  if (resolved.ignorePaths.length > 0) {
    resolved.excludePatterns = [...new Set([...resolved.excludePatterns, ...resolved.ignorePaths])];
  }

  return resolved;
}

export function isSeverityAboveThreshold(severity: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(threshold);
}
