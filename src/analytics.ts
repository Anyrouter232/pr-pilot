import { PRFile, ReviewComment, ReviewMetrics, Severity, AIProviderUsage } from './types';

export class ReviewAnalytics {
  private startTime: number;
  private endTime = 0;
  private files: PRFile[] = [];
  private comments: ReviewComment[] = [];
  private tokenUsage: AIProviderUsage | null = null;
  private modelUsed = '';
  private providerUsed = '';

  constructor() {
    this.startTime = Date.now();
  }

  recordFiles(files: PRFile[]): void {
    this.files = files;
  }

  recordComments(comments: ReviewComment[]): void {
    this.comments = comments;
  }

  recordTokenUsage(usage: AIProviderUsage | null): void {
    this.tokenUsage = usage;
  }

  recordModel(provider: string, model: string): void {
    this.providerUsed = provider;
    this.modelUsed = model;
  }

  finalize(): void {
    this.endTime = Date.now();
  }

  getMetrics(): ReviewMetrics {
    const issuesBySeverity: Record<Severity, number> = {
      critical: 0,
      warning: 0,
      suggestion: 0,
      nitpick: 0,
    };
    for (const c of this.comments) {
      issuesBySeverity[c.severity]++;
    }

    const fileCounts = new Map<string, number>();
    for (const c of this.comments) {
      fileCounts.set(c.path, (fileCounts.get(c.path) || 0) + 1);
    }
    const fileIssueRanking = Array.from(fileCounts.entries())
      .map(([filename, issueCount]) => ({ filename, issueCount }))
      .sort((a, b) => b.issueCount - a.issueCount);

    const totalLinesAnalyzed = this.files.reduce((sum, f) => sum + f.additions + f.deletions, 0);

    return {
      filesReviewed: this.files.length,
      totalLinesAnalyzed,
      issuesBySeverity,
      tokenUsage: this.tokenUsage,
      modelUsed: this.modelUsed,
      providerUsed: this.providerUsed,
      reviewDurationMs: this.endTime - this.startTime,
      fileIssueRanking,
    };
  }

  formatMarkdownReport(): string {
    const m = this.getMetrics();
    const duration = (m.reviewDurationMs / 1000).toFixed(1);

    const lines: string[] = [
      '',
      '<details>',
      '<summary>Review Stats</summary>',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Files reviewed | ${m.filesReviewed} |`,
      `| Lines analyzed | ${m.totalLinesAnalyzed} |`,
      `| Review time | ${duration}s |`,
      `| Provider | ${m.providerUsed} |`,
      `| Model | ${m.modelUsed} |`,
    ];

    if (m.tokenUsage) {
      lines.push(
        `| Tokens used | ${m.tokenUsage.totalTokens.toLocaleString()} (${m.tokenUsage.promptTokens.toLocaleString()} prompt + ${m.tokenUsage.completionTokens.toLocaleString()} completion) |`
      );
    }

    const totalIssues = Object.values(m.issuesBySeverity).reduce((a, b) => a + b, 0);
    if (totalIssues > 0) {
      lines.push('', '**Issues by severity:**', '');
      const severityEmoji: Record<Severity, string> = {
        critical: '🔴',
        warning: '🟡',
        suggestion: '🔵',
        nitpick: '⚪',
      };
      for (const sev of ['critical', 'warning', 'suggestion', 'nitpick'] as Severity[]) {
        if (m.issuesBySeverity[sev] > 0) {
          lines.push(`- ${severityEmoji[sev]} ${sev}: ${m.issuesBySeverity[sev]}`);
        }
      }
    }

    if (m.fileIssueRanking.length > 0) {
      lines.push('', '**Most issues:**', '');
      for (const f of m.fileIssueRanking.slice(0, 5)) {
        lines.push(`- \`${f.filename}\` (${f.issueCount})`);
      }
    }

    lines.push('', '</details>');

    return lines.join('\n');
  }
}
