import { validateRepoConfig, mergeConfigs, isSeverityAboveThreshold } from '../src/repo-config';
import { ActionConfig, RepoConfig } from '../src/types';

describe('validateRepoConfig', () => {
  it('should return empty object for null input', () => {
    expect(validateRepoConfig(null)).toEqual({});
  });

  it('should return empty object for non-object input', () => {
    expect(validateRepoConfig('string')).toEqual({});
    expect(validateRepoConfig(42)).toEqual({});
  });

  it('should validate a full valid config', () => {
    const input = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      max_files: 30,
      exclude_patterns: ['*.lock', 'dist/**'],
      review_level: 'thorough',
      custom_prompt: 'Focus on security.',
      post_summary: false,
      fail_on_issues: true,
      ignore_paths: ['vendor/**', 'generated/**'],
      review_rules: ['No console.log in production code', 'All functions need error handling'],
      language_hints: { '.tsx': 'React TypeScript', '.py': 'Python' },
      severity_threshold: 'warning',
      max_comment_length: 500,
      auto_approve: true,
    };

    const result = validateRepoConfig(input);

    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.max_files).toBe(30);
    expect(result.exclude_patterns).toEqual(['*.lock', 'dist/**']);
    expect(result.review_level).toBe('thorough');
    expect(result.custom_prompt).toBe('Focus on security.');
    expect(result.post_summary).toBe(false);
    expect(result.fail_on_issues).toBe(true);
    expect(result.ignore_paths).toEqual(['vendor/**', 'generated/**']);
    expect(result.review_rules).toHaveLength(2);
    expect(result.language_hints).toEqual({ '.tsx': 'React TypeScript', '.py': 'Python' });
    expect(result.severity_threshold).toBe('warning');
    expect(result.max_comment_length).toBe(500);
    expect(result.auto_approve).toBe(true);
  });

  it('should drop invalid field types silently', () => {
    const input = {
      provider: 123,
      model: false,
      max_files: 'not a number',
      exclude_patterns: 'not an array',
      review_level: 'invalid',
      severity_threshold: 'mega',
      max_comment_length: -10,
      auto_approve: 'yes',
    };

    const result = validateRepoConfig(input);

    expect(result.provider).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.max_files).toBeUndefined();
    expect(result.exclude_patterns).toBeUndefined();
    expect(result.review_level).toBeUndefined();
    expect(result.severity_threshold).toBeUndefined();
    expect(result.max_comment_length).toBeUndefined();
    expect(result.auto_approve).toBeUndefined();
  });

  it('should filter non-string entries in arrays', () => {
    const input = {
      ignore_paths: ['valid/**', 42, null, 'also-valid'],
      review_rules: [true, 'No any types'],
    };

    const result = validateRepoConfig(input);

    expect(result.ignore_paths).toEqual(['valid/**', 'also-valid']);
    expect(result.review_rules).toEqual(['No any types']);
  });

  it('should filter non-string entries in language_hints', () => {
    const input = {
      language_hints: { '.ts': 'TypeScript', '.bad': 123, '.py': 'Python' },
    };

    const result = validateRepoConfig(input);

    expect(result.language_hints).toEqual({ '.ts': 'TypeScript', '.py': 'Python' });
  });
});

describe('mergeConfigs', () => {
  const baseActionConfig: ActionConfig = {
    githubToken: 'token',
    provider: 'openai',
    openaiApiKey: 'key',
    anthropicApiKey: '',
    geminiApiKey: '',
    model: '',
    maxFiles: 20,
    excludePatterns: ['*.lock'],
    reviewLevel: 'standard',
    customPrompt: '',
    postSummary: true,
    failOnIssues: false,
  };

  it('should return defaults when repo config is null', () => {
    const resolved = mergeConfigs(baseActionConfig, null);

    expect(resolved.ignorePaths).toEqual([]);
    expect(resolved.reviewRules).toEqual([]);
    expect(resolved.languageHints).toEqual({});
    expect(resolved.severityThreshold).toBe('nitpick');
    expect(resolved.maxCommentLength).toBe(0);
    expect(resolved.autoApprove).toBe(false);
  });

  it('should apply repo-only fields from repo config', () => {
    const repoConfig: RepoConfig = {
      ignore_paths: ['vendor/**'],
      review_rules: ['No console.log'],
      language_hints: { '.rs': 'Rust' },
      severity_threshold: 'warning',
      max_comment_length: 300,
      auto_approve: true,
    };

    const resolved = mergeConfigs(baseActionConfig, repoConfig);

    expect(resolved.ignorePaths).toEqual(['vendor/**']);
    expect(resolved.reviewRules).toEqual(['No console.log']);
    expect(resolved.languageHints).toEqual({ '.rs': 'Rust' });
    expect(resolved.severityThreshold).toBe('warning');
    expect(resolved.maxCommentLength).toBe(300);
    expect(resolved.autoApprove).toBe(true);
  });

  it('should fill model from repo config when action input is empty', () => {
    const repoConfig: RepoConfig = { model: 'gpt-5.3-instant' };

    const resolved = mergeConfigs(baseActionConfig, repoConfig);
    expect(resolved.model).toBe('gpt-5.3-instant');
  });

  it('should not override model when action input is set', () => {
    const configWithModel = { ...baseActionConfig, model: 'gpt-5.4' };
    const repoConfig: RepoConfig = { model: 'gpt-5.3-instant' };

    const resolved = mergeConfigs(configWithModel, repoConfig);
    expect(resolved.model).toBe('gpt-5.4');
  });

  it('should merge exclude patterns from both sources', () => {
    const repoConfig: RepoConfig = {
      exclude_patterns: ['dist/**', '*.generated.ts'],
    };

    const resolved = mergeConfigs(baseActionConfig, repoConfig);

    expect(resolved.excludePatterns).toContain('*.lock');
    expect(resolved.excludePatterns).toContain('dist/**');
    expect(resolved.excludePatterns).toContain('*.generated.ts');
  });

  it('should merge ignore_paths into exclude patterns', () => {
    const repoConfig: RepoConfig = {
      ignore_paths: ['vendor/**'],
    };

    const resolved = mergeConfigs(baseActionConfig, repoConfig);

    expect(resolved.excludePatterns).toContain('vendor/**');
  });
});

describe('isSeverityAboveThreshold', () => {
  it('should return true when severity matches threshold', () => {
    expect(isSeverityAboveThreshold('warning', 'warning')).toBe(true);
  });

  it('should return true when severity is above threshold', () => {
    expect(isSeverityAboveThreshold('critical', 'warning')).toBe(true);
    expect(isSeverityAboveThreshold('warning', 'nitpick')).toBe(true);
  });

  it('should return false when severity is below threshold', () => {
    expect(isSeverityAboveThreshold('nitpick', 'warning')).toBe(false);
    expect(isSeverityAboveThreshold('suggestion', 'critical')).toBe(false);
  });

  it('should pass everything when threshold is nitpick', () => {
    expect(isSeverityAboveThreshold('nitpick', 'nitpick')).toBe(true);
    expect(isSeverityAboveThreshold('critical', 'nitpick')).toBe(true);
  });
});
