import { PRContext, PRFile, ReviewResult } from './types';
export declare class GitHubClient {
    private octokit;
    private context;
    constructor(token: string);
    private buildContext;
    getContext(): PRContext;
    getChangedFiles(excludePatterns: string[], maxFiles: number): Promise<PRFile[]>;
    postReview(result: ReviewResult): Promise<number>;
    private formatCommentBody;
    private buildReviewBody;
}
