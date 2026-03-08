import * as github from '@actions/github';
import * as core from '@actions/core';
import { PRContext, PRFile, IncrementalContext } from './types';
import { minimatch } from 'minimatch';

type Octokit = ReturnType<typeof github.getOctokit>;

const SHA_MARKER_RE = /<!-- pr-pilot-head-sha:([a-f0-9]{40}) -->/;

export async function getIncrementalContext(
  octokit: Octokit,
  prContext: PRContext
): Promise<IncrementalContext> {
  const previousSha = await findPreviousReviewSha(octokit, prContext);

  if (!previousSha) {
    core.info('No previous review found. Performing full review.');
    return {
      isIncremental: false,
      previousSha: null,
      currentSha: prContext.headSha,
      commitRange: null,
    };
  }

  core.info(
    `Previous review at SHA: ${previousSha.substring(0, 7)}. Current: ${prContext.headSha.substring(0, 7)}`
  );

  if (previousSha === prContext.headSha) {
    core.info('No new commits since last review.');
    return {
      isIncremental: true,
      previousSha,
      currentSha: prContext.headSha,
      commitRange: null,
    };
  }

  return {
    isIncremental: true,
    previousSha,
    currentSha: prContext.headSha,
    commitRange: `${previousSha}...${prContext.headSha}`,
  };
}

export async function findPreviousReviewSha(
  octokit: Octokit,
  prContext: PRContext
): Promise<string | null> {
  const { owner, repo, pullNumber } = prContext;

  try {
    const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    // Search in reverse chronological order for the most recent marker
    for (let i = reviews.length - 1; i >= 0; i--) {
      const body = reviews[i].body || '';
      const match = body.match(SHA_MARKER_RE);
      if (match) {
        return match[1];
      }
    }
  } catch (error) {
    core.warning(
      `Failed to search for previous reviews: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  return null;
}

export async function getIncrementalFiles(
  octokit: Octokit,
  prContext: PRContext,
  incrementalCtx: IncrementalContext,
  excludePatterns: string[],
  maxFiles: number
): Promise<PRFile[]> {
  if (!incrementalCtx.commitRange || !incrementalCtx.previousSha) {
    return [];
  }

  const { owner, repo } = prContext;

  try {
    const { data } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: incrementalCtx.previousSha,
      head: incrementalCtx.currentSha,
    });

    let filtered = (data.files || []).filter((file) => {
      if (!file.patch) return false;
      return !excludePatterns.some((pattern) => minimatch(file.filename, pattern));
    });

    if (maxFiles > 0 && filtered.length > maxFiles) {
      core.warning(
        `Incremental diff has ${filtered.length} files, but max-files is ${maxFiles}. ` +
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
  } catch (error) {
    core.warning(
      `Failed to get incremental diff: ${error instanceof Error ? error.message : 'unknown error'}. Falling back to full review.`
    );
    return [];
  }
}

export function buildShaMarker(sha: string): string {
  return `<!-- pr-pilot-head-sha:${sha} -->`;
}

export function extractShaFromMarker(text: string): string | null {
  const match = text.match(SHA_MARKER_RE);
  return match ? match[1] : null;
}
