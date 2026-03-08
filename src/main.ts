import * as core from '@actions/core';
import { getConfig } from './config';
import { runReview } from './review';
import { GitHubClient } from './github';

export async function run(): Promise<void> {
  try {
    const config = getConfig();

    core.info('PR Pilot starting review...');

    const result = await runReview(config);

    const ghClient = new GitHubClient(config.githubToken);
    if (config.postSummary || result.comments.length > 0) {
      const reviewId = await ghClient.postReview(result);
      core.setOutput('review-comment-id', reviewId.toString());
      core.info(`Review posted successfully (ID: ${reviewId}).`);
    }

    core.setOutput('issues-found', result.issuesCount.toString());

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
