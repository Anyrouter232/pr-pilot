import { PRFile, ReviewComment, ReviewMetrics, AIProviderUsage } from './types';
export declare class ReviewAnalytics {
    private startTime;
    private endTime;
    private files;
    private comments;
    private tokenUsage;
    private modelUsed;
    private providerUsed;
    constructor();
    recordFiles(files: PRFile[]): void;
    recordComments(comments: ReviewComment[]): void;
    recordTokenUsage(usage: AIProviderUsage | null): void;
    recordModel(provider: string, model: string): void;
    finalize(): void;
    getMetrics(): ReviewMetrics;
    formatMarkdownReport(): string;
}
