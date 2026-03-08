import * as core from '@actions/core';
import { ActionConfig, PRFile, ReviewComment, ReviewResult } from './types';
import { GitHubClient } from './github';
import { OpenAIClient } from './openai';
import { buildAnnotatedDiff, isLineInDiff } from './parser';
import { getSystemPrompt, getUserPrompt } from './prompts';

const MAX_DIFF_CHARS = 100_000;

export async function runReview(config: ActionConfig): Promise<ReviewResult> {
  const ghClient = new GitHubClient(config.githubToken);
  const aiClient = new OpenAIClient(config.openaiApiKey, config.model);
  const prContext = ghClient.getContext();

  core.info(`Reviewing PR #${prContext.pullNumber}: ${prContext.title}`);

  const files = await ghClient.getChangedFiles(config.excludePatterns, config.maxFiles);
  core.info(`Found ${files.length} reviewable files.`);

  if (files.length === 0) {
    core.info('No reviewable files found. Skipping review.');
    return {
      summary: 'No reviewable code changes found in this PR.',
      comments: [],
      issuesCount: 0,
      approvalSuggestion: 'approve',
    };
  }

  const annotatedDiffs = buildAnnotatedDiffsWithLimit(files, MAX_DIFF_CHARS);

  const systemPrompt = getSystemPrompt(config);
  const userPrompt = getUserPrompt(prContext, annotatedDiffs);

  core.info(`Prompt size: ~${(systemPrompt.length + userPrompt.length).toLocaleString()} chars`);

  const aiResponse = await aiClient.reviewDiff(systemPrompt, userPrompt);

  const comments: ReviewComment[] = [];
  for (const fileReview of aiResponse.files) {
    const file = files.find((f) => f.filename === fileReview.filename);
    if (!file) continue;

    for (const c of fileReview.comments) {
      if (isLineInDiff(file, c.line)) {
        comments.push({
          path: fileReview.filename,
          line: c.line,
          side: 'RIGHT',
          body: c.comment,
          severity: c.severity,
        });
      } else {
        core.warning(`Skipping comment on ${fileReview.filename}:${c.line} - line not in diff.`);
      }
    }
  }

  return {
    summary: aiResponse.summary,
    comments,
    issuesCount: comments.filter((c) => c.severity === 'critical' || c.severity === 'warning')
      .length,
    approvalSuggestion: aiResponse.overallSeverity,
  };
}

function buildAnnotatedDiffsWithLimit(files: PRFile[], maxChars: number): string[] {
  const diffs: string[] = [];
  let totalChars = 0;

  for (const file of files) {
    const annotated = buildAnnotatedDiff(file);
    if (totalChars + annotated.length > maxChars) {
      core.warning(
        `Diff size exceeds ${maxChars.toLocaleString()} chars. ` +
          `Reviewing ${diffs.length} of ${files.length} files.`
      );
      break;
    }
    diffs.push(annotated);
    totalChars += annotated.length;
  }

  return diffs;
}
