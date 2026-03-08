import { OpenAIFileReview } from './types';
export interface OpenAIReviewResponse {
    summary: string;
    files: OpenAIFileReview[];
    overallSeverity: 'approve' | 'request_changes' | 'comment';
}
export declare class OpenAIClient {
    private client;
    private model;
    constructor(apiKey: string, model: string);
    reviewDiff(systemPrompt: string, userPrompt: string): Promise<OpenAIReviewResponse>;
    private validateResponse;
}
