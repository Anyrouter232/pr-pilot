import * as core from '@actions/core';
import {
  ResolvedConfig,
  PRFile,
  ReviewComment,
  ReviewResult,
  Severity,
  IncrementalContext,
} from './types';
import { GitHubClient } from './github';
import { createProvider } from './providers';
import { resolveApiKey } from './config';
import { buildAnnotatedDiff, isLineInDiff } from './parser';
import { getSystemPrompt, getUserPrompt, getUserPromptForGroup } from './prompts';
import { groupFiles } from './grouper';
import { ReviewAnalytics } from './analytics';
import { getIncrementalContext, getIncrementalFiles } from './incremental';
import { isSeverityAboveThreshold } from './repo-config';

const MAX_DIFF_CHARS = 100_000;
const FILE_GROUP_THRESHOLD = 5;

export async function runReview(
  config: ResolvedConfig,
  ghClient: GitHubClient
): Promise<{ result: ReviewResult; incrementalCtx?: IncrementalContext }> {
  const analytics = new ReviewAnalytics();
  const apiKey = resolveApiKey(config);
  const aiClient = createProvider(config.provider, apiKey, config.model || undefined);
  const prContext = ghClient.getContext();

  analytics.recordModel(aiClient.name, config.model || 'default');
  core.info(`Reviewing PR #${prContext.pullNumber}: ${prContext.title}`);
  core.info(`Provider: ${aiClient.name}, Model: ${config.model || 'default'}`);

  // Check for incremental review
  const eventAction = ghClient.getEventAction();
  let incrementalCtx: IncrementalContext | undefined;
  let files: PRFile[];

  if (eventAction === 'synchronize') {
    incrementalCtx = await getIncrementalContext(ghClient.getOctokit(), prContext);

    if (incrementalCtx.isIncremental && incrementalCtx.commitRange) {
      files = await getIncrementalFiles(
        ghClient.getOctokit(),
        prContext,
        incrementalCtx,
        config.excludePatterns,
        config.maxFiles
      );

      if (files.length === 0) {
        // Fallback to full review if incremental diff is empty
        core.info('Incremental diff empty, falling back to full review.');
        files = await ghClient.getChangedFiles(config.excludePatterns, config.maxFiles);
        incrementalCtx = undefined;
      } else {
        core.info(`Incremental review: ${files.length} files changed since last review.`);
      }
    } else if (incrementalCtx.isIncremental && !incrementalCtx.commitRange) {
      core.info('No new commits since last review. Skipping.');
      analytics.finalize();
      return {
        result: {
          summary: 'No new changes to review since last PR Pilot review.',
          comments: [],
          issuesCount: 0,
          approvalSuggestion: 'comment',
          analyticsReport: '',
          metrics: analytics.getMetrics(),
        },
      };
    } else {
      files = await ghClient.getChangedFiles(config.excludePatterns, config.maxFiles);
    }
  } else {
    files = await ghClient.getChangedFiles(config.excludePatterns, config.maxFiles);
  }

  core.info(`Found ${files.length} reviewable files.`);
  analytics.recordFiles(files);

  if (files.length === 0) {
    analytics.finalize();
    return {
      result: {
        summary: 'No reviewable code changes found in this PR.',
        comments: [],
        issuesCount: 0,
        approvalSuggestion: 'approve',
        analyticsReport: '',
        metrics: analytics.getMetrics(),
      },
      incrementalCtx,
    };
  }

  const systemPrompt = getSystemPrompt(config);

  // Decide: single batch vs grouped review
  let allComments: ReviewComment[] = [];
  let overallSummary = '';
  let overallSeverity: 'approve' | 'request_changes' | 'comment' = 'approve';

  if (files.length > FILE_GROUP_THRESHOLD) {
    // Grouped review for larger PRs
    const fileGroups = groupFiles(files);
    core.info(`Organized ${files.length} files into ${fileGroups.length} review groups.`);

    const summaries: string[] = [];

    for (const group of fileGroups) {
      const annotatedDiffs = buildAnnotatedDiffsWithLimit(group.files, MAX_DIFF_CHARS);
      if (annotatedDiffs.length === 0) continue;

      const userPrompt = getUserPromptForGroup(prContext, group, annotatedDiffs);
      core.info(`Reviewing group: ${group.name}`);

      const aiResponse = await aiClient.reviewDiff(systemPrompt, userPrompt);
      summaries.push(aiResponse.summary);

      if (aiResponse.overallSeverity === 'request_changes') {
        overallSeverity = 'request_changes';
      } else if (aiResponse.overallSeverity === 'comment' && overallSeverity === 'approve') {
        overallSeverity = 'comment';
      }

      const groupComments = mapAIResponseToComments(aiResponse.files, group.files);
      allComments.push(...groupComments);
    }

    overallSummary = summaries.join('\n\n');
    analytics.recordTokenUsage(aiClient.getLastUsage());
  } else {
    // Single batch review for smaller PRs
    const annotatedDiffs = buildAnnotatedDiffsWithLimit(files, MAX_DIFF_CHARS);
    const userPrompt = getUserPrompt(prContext, annotatedDiffs);

    core.info(`Prompt size: ~${(systemPrompt.length + userPrompt.length).toLocaleString()} chars`);

    const aiResponse = await aiClient.reviewDiff(systemPrompt, userPrompt);
    analytics.recordTokenUsage(aiClient.getLastUsage());

    overallSummary = aiResponse.summary;
    overallSeverity = aiResponse.overallSeverity;
    allComments = mapAIResponseToComments(aiResponse.files, files);
  }

  // Apply severity threshold filter
  allComments = allComments.filter((c) =>
    isSeverityAboveThreshold(c.severity, config.severityThreshold)
  );

  // Apply max comment length
  if (config.maxCommentLength > 0) {
    allComments = allComments.map((c) => ({
      ...c,
      body:
        c.body.length > config.maxCommentLength
          ? c.body.substring(0, config.maxCommentLength) + '...'
          : c.body,
    }));
  }

  analytics.recordComments(allComments);
  analytics.finalize();

  const issuesCount = allComments.filter(
    (c) => c.severity === 'critical' || c.severity === 'warning'
  ).length;

  // Auto-approve if configured and no issues
  if (config.autoApprove && issuesCount === 0) {
    overallSeverity = 'approve';
  }

  return {
    result: {
      summary: overallSummary,
      comments: allComments,
      issuesCount,
      approvalSuggestion: overallSeverity,
      analyticsReport: analytics.formatMarkdownReport(),
      metrics: analytics.getMetrics(),
    },
    incrementalCtx,
  };
}

function mapAIResponseToComments(
  aiFiles: Array<{
    filename: string;
    comments: Array<{ line: number; severity: Severity; comment: string }>;
  }>,
  prFiles: PRFile[]
): ReviewComment[] {
  const comments: ReviewComment[] = [];

  for (const fileReview of aiFiles) {
    const file = prFiles.find((f) => f.filename === fileReview.filename);
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

  return comments;
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
