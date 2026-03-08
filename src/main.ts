import * as core from '@actions/core';
import { getConfig } from './config';
import { runReview } from './review';
import { GitHubClient } from './github';
import { loadRepoConfig, mergeConfigs } from './repo-config';

export async function run(): Promise<void> {
  try {
    const actionConfig = getConfig();
    const ghClient = new GitHubClient(actionConfig.githubToken);
    const prContext = ghClient.getContext();

    core.info('PR Pilot starting review...');

    // Load and merge repo config
    const repoConfig = await loadRepoConfig(
      ghClient.getOctokit(),
      prContext.owner,
      prContext.repo,
      prContext.headSha
    );
    const config = mergeConfigs(actionConfig, repoConfig);

    // Run the review
    const { result, incrementalCtx } = await runReview(config, ghClient);

    // Post the review
    if (config.postSummary || result.comments.length > 0) {
      const reviewId = await ghClient.postReview(result, incrementalCtx);
      core.setOutput('review-comment-id', reviewId.toString());
      core.info(`Review posted successfully (ID: ${reviewId}).`);
    }

    // Set outputs
    core.setOutput('issues-found', result.issuesCount.toString());
    core.setOutput('files-reviewed', result.metrics.filesReviewed.toString());
    core.setOutput('tokens-used', (result.metrics.tokenUsage?.totalTokens ?? 0).toString());
    core.setOutput('review-duration-ms', result.metrics.reviewDurationMs.toString());
    core.setOutput('provider', result.metrics.providerUsed);

    if (config.failOnIssues && result.issuesCount > 0) {
      core.setFailed(
        `PR Pilot found ${result.issuesCount} issue(s). Set fail-on-issues to false to disable this.`
      );
    }

    core.info(`Review complete. ${result.issuesCount} issue(s) found.`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`PR Pilot failed: ${error.message}`);
    } else {
      core.setFailed('PR Pilot failed with an unknown error.');
    }
  }
}
