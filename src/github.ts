import * as github from '@actions/github';
import * as core from '@actions/core';
import { PRContext, PRFile, ReviewComment, ReviewResult, IncrementalContext } from './types';
import { minimatch } from 'minimatch';
import { buildShaMarker } from './incremental';

type Octokit = ReturnType<typeof github.getOctokit>;

export class GitHubClient {
  private octokit: Octokit;
  private context: PRContext;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.context = this.buildContext();
  }

  private buildContext(): PRContext {
    const ctx = github.context;
    const pr = ctx.payload.pull_request;

    if (!pr) {
      throw new Error('This action can only run on pull_request events.');
    }

    return {
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      pullNumber: pr.number,
      title: pr.title as string,
      body: (pr.body as string) || '',
      baseSha: pr.base.sha as string,
      headSha: pr.head.sha as string,
    };
  }

  getContext(): PRContext {
    return this.context;
  }

  getOctokit(): Octokit {
    return this.octokit;
  }

  getEventAction(): string {
    return (github.context.payload.action as string) || '';
  }

  async getChangedFiles(excludePatterns: string[], maxFiles: number): Promise<PRFile[]> {
    const { owner, repo, pullNumber } = this.context;

    const files = await this.octokit.paginate(this.octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    let filtered = files.filter((file) => {
      if (!file.patch) return false;
      return !excludePatterns.some((pattern) => minimatch(file.filename, pattern));
    });

    if (maxFiles > 0 && filtered.length > maxFiles) {
      core.warning(
        `PR has ${filtered.length} reviewable files, but max-files is ${maxFiles}. ` +
          `Reviewing only the first ${maxFiles} files.`
      );
      filtered = filtered.slice(0, maxFiles);
    }

    return filtered.map((f) => ({
      filename: f.filename,
      status: f.status as PRFile['status'],
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    }));
  }

  async postReview(result: ReviewResult, incrementalCtx?: IncrementalContext): Promise<number> {
    const { owner, repo, pullNumber } = this.context;

    const apiComments = result.comments.map((c) => ({
      path: c.path,
      line: c.line,
      side: c.side as 'RIGHT',
      body: this.formatCommentBody(c),
    }));

    let event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT';
    if (result.approvalSuggestion === 'approve' && result.issuesCount === 0) {
      event = 'APPROVE';
    } else if (result.approvalSuggestion === 'request_changes') {
      event = 'REQUEST_CHANGES';
    }

    const reviewBody = this.buildReviewBody(result, incrementalCtx);

    const { data: review } = await this.octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body: reviewBody,
      event,
      comments: apiComments,
    });

    return review.id;
  }

  private formatCommentBody(comment: ReviewComment): string {
    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      warning: '🟡',
      suggestion: '🔵',
      nitpick: '⚪',
    };
    const emoji = severityEmoji[comment.severity] || '💬';
    return `${emoji} **${comment.severity.toUpperCase()}**\n\n${comment.body}`;
  }

  private buildReviewBody(result: ReviewResult, incrementalCtx?: IncrementalContext): string {
    const lines: string[] = ['## PR Pilot Review', ''];

    if (incrementalCtx?.isIncremental && incrementalCtx.commitRange) {
      lines.push(
        `> **Incremental review** of new changes (\`${incrementalCtx.previousSha!.substring(0, 7)}..${incrementalCtx.currentSha.substring(0, 7)}\`)`,
        ''
      );
    }

    lines.push(result.summary, '', `**Issues found:** ${result.issuesCount}`);

    if (result.analyticsReport) {
      lines.push(result.analyticsReport);
    }

    lines.push(
      '',
      '---',
      '*Automated review by [PR Pilot](https://github.com/Anyrouter232/pr-pilot) powered by AI*',
      '',
      buildShaMarker(this.context.headSha)
    );

    return lines.join('\n');
  }
}
