import { ReviewAnalytics } from '../src/analytics';
import { PRFile, ReviewComment } from '../src/types';

describe('ReviewAnalytics', () => {
  it('should return zero metrics when no data recorded', () => {
    const analytics = new ReviewAnalytics();
    analytics.finalize();
    const metrics = analytics.getMetrics();

    expect(metrics.filesReviewed).toBe(0);
    expect(metrics.totalLinesAnalyzed).toBe(0);
    expect(metrics.issuesBySeverity.critical).toBe(0);
    expect(metrics.issuesBySeverity.warning).toBe(0);
    expect(metrics.issuesBySeverity.suggestion).toBe(0);
    expect(metrics.issuesBySeverity.nitpick).toBe(0);
    expect(metrics.tokenUsage).toBeNull();
    expect(metrics.fileIssueRanking).toEqual([]);
    expect(metrics.reviewDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should count files correctly', () => {
    const analytics = new ReviewAnalytics();
    const files: PRFile[] = [
      { filename: 'a.ts', status: 'modified', additions: 10, deletions: 5 },
      { filename: 'b.ts', status: 'added', additions: 20, deletions: 0 },
      { filename: 'c.ts', status: 'modified', additions: 3, deletions: 8 },
    ];
    analytics.recordFiles(files);
    analytics.finalize();

    const metrics = analytics.getMetrics();
    expect(metrics.filesReviewed).toBe(3);
    expect(metrics.totalLinesAnalyzed).toBe(46);
  });

  it('should tally severity counts correctly', () => {
    const analytics = new ReviewAnalytics();
    const comments: ReviewComment[] = [
      { path: 'a.ts', line: 1, side: 'RIGHT', body: 'bug', severity: 'critical' },
      { path: 'a.ts', line: 5, side: 'RIGHT', body: 'perf', severity: 'warning' },
      { path: 'b.ts', line: 2, side: 'RIGHT', body: 'style', severity: 'nitpick' },
      { path: 'b.ts', line: 10, side: 'RIGHT', body: 'idea', severity: 'suggestion' },
      { path: 'a.ts', line: 20, side: 'RIGHT', body: 'sec', severity: 'critical' },
    ];
    analytics.recordComments(comments);
    analytics.finalize();

    const metrics = analytics.getMetrics();
    expect(metrics.issuesBySeverity.critical).toBe(2);
    expect(metrics.issuesBySeverity.warning).toBe(1);
    expect(metrics.issuesBySeverity.suggestion).toBe(1);
    expect(metrics.issuesBySeverity.nitpick).toBe(1);
  });

  it('should rank files by issue count descending', () => {
    const analytics = new ReviewAnalytics();
    const comments: ReviewComment[] = [
      { path: 'few.ts', line: 1, side: 'RIGHT', body: 'x', severity: 'warning' },
      { path: 'many.ts', line: 1, side: 'RIGHT', body: 'x', severity: 'critical' },
      { path: 'many.ts', line: 5, side: 'RIGHT', body: 'x', severity: 'warning' },
      { path: 'many.ts', line: 10, side: 'RIGHT', body: 'x', severity: 'suggestion' },
      { path: 'mid.ts', line: 1, side: 'RIGHT', body: 'x', severity: 'nitpick' },
      { path: 'mid.ts', line: 3, side: 'RIGHT', body: 'x', severity: 'nitpick' },
    ];
    analytics.recordComments(comments);
    analytics.finalize();

    const metrics = analytics.getMetrics();
    expect(metrics.fileIssueRanking[0].filename).toBe('many.ts');
    expect(metrics.fileIssueRanking[0].issueCount).toBe(3);
    expect(metrics.fileIssueRanking[1].filename).toBe('mid.ts');
    expect(metrics.fileIssueRanking[1].issueCount).toBe(2);
    expect(metrics.fileIssueRanking[2].filename).toBe('few.ts');
    expect(metrics.fileIssueRanking[2].issueCount).toBe(1);
  });

  it('should record token usage', () => {
    const analytics = new ReviewAnalytics();
    analytics.recordTokenUsage({
      promptTokens: 500,
      completionTokens: 200,
      totalTokens: 700,
    });
    analytics.finalize();

    const metrics = analytics.getMetrics();
    expect(metrics.tokenUsage).toEqual({
      promptTokens: 500,
      completionTokens: 200,
      totalTokens: 700,
    });
  });

  it('should record model and provider', () => {
    const analytics = new ReviewAnalytics();
    analytics.recordModel('anthropic', 'claude-sonnet-4-6');
    analytics.finalize();

    const metrics = analytics.getMetrics();
    expect(metrics.providerUsed).toBe('anthropic');
    expect(metrics.modelUsed).toBe('claude-sonnet-4-6');
  });

  it('should track duration between constructor and finalize', async () => {
    const analytics = new ReviewAnalytics();
    await new Promise((resolve) => setTimeout(resolve, 50));
    analytics.finalize();

    const metrics = analytics.getMetrics();
    expect(metrics.reviewDurationMs).toBeGreaterThanOrEqual(40);
  });
});

describe('ReviewAnalytics.formatMarkdownReport', () => {
  it('should produce a details wrapper', () => {
    const analytics = new ReviewAnalytics();
    analytics.finalize();
    const report = analytics.formatMarkdownReport();

    expect(report).toContain('<details>');
    expect(report).toContain('</details>');
    expect(report).toContain('<summary>Review Stats</summary>');
  });

  it('should include metrics table', () => {
    const analytics = new ReviewAnalytics();
    analytics.recordFiles([{ filename: 'a.ts', status: 'modified', additions: 10, deletions: 5 }]);
    analytics.recordModel('openai', 'gpt-5.4');
    analytics.finalize();

    const report = analytics.formatMarkdownReport();

    expect(report).toContain('| Files reviewed | 1 |');
    expect(report).toContain('| Lines analyzed | 15 |');
    expect(report).toContain('| Provider | openai |');
    expect(report).toContain('| Model | gpt-5.4 |');
  });

  it('should include token usage when present', () => {
    const analytics = new ReviewAnalytics();
    analytics.recordTokenUsage({ promptTokens: 1000, completionTokens: 500, totalTokens: 1500 });
    analytics.finalize();

    const report = analytics.formatMarkdownReport();
    expect(report).toContain('Tokens used');
    expect(report).toContain('1,500');
  });

  it('should omit token line when no usage', () => {
    const analytics = new ReviewAnalytics();
    analytics.finalize();

    const report = analytics.formatMarkdownReport();
    expect(report).not.toContain('Tokens used');
  });

  it('should list severity breakdown when issues exist', () => {
    const analytics = new ReviewAnalytics();
    analytics.recordComments([
      { path: 'a.ts', line: 1, side: 'RIGHT', body: 'x', severity: 'critical' },
      { path: 'a.ts', line: 2, side: 'RIGHT', body: 'x', severity: 'warning' },
    ]);
    analytics.finalize();

    const report = analytics.formatMarkdownReport();
    expect(report).toContain('critical: 1');
    expect(report).toContain('warning: 1');
  });

  it('should list top files by issues', () => {
    const analytics = new ReviewAnalytics();
    analytics.recordComments([
      { path: 'top.ts', line: 1, side: 'RIGHT', body: 'x', severity: 'warning' },
      { path: 'top.ts', line: 2, side: 'RIGHT', body: 'x', severity: 'critical' },
    ]);
    analytics.finalize();

    const report = analytics.formatMarkdownReport();
    expect(report).toContain('`top.ts` (2)');
  });
});
