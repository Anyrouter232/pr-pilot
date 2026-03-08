import { ResolvedConfig, ReviewResult, IncrementalContext } from './types';
import { GitHubClient } from './github';
export declare function runReview(config: ResolvedConfig, ghClient: GitHubClient): Promise<{
    result: ReviewResult;
    incrementalCtx?: IncrementalContext;
}>;
