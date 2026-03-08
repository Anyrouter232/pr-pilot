import * as github from '@actions/github';
import { PRContext, PRFile, ReviewResult, IncrementalContext } from './types';
type Octokit = ReturnType<typeof github.getOctokit>;
export declare class GitHubClient {
    private octokit;
    private context;
    constructor(token: string);
    private buildContext;
    getContext(): PRContext;
    getOctokit(): Octokit;
    getEventAction(): string;
    getChangedFiles(excludePatterns: string[], maxFiles: number): Promise<PRFile[]>;
    postReview(result: ReviewResult, incrementalCtx?: IncrementalContext): Promise<number>;
    private formatCommentBody;
    private buildReviewBody;
}
export {};
