import { AIProviderUsage } from '../types';
import { AIProvider, AIReviewResponse } from './provider';
export declare class OpenAIProvider implements AIProvider {
    readonly name = "openai";
    private client;
    private model;
    private lastUsage;
    constructor(apiKey: string, model: string);
    reviewDiff(systemPrompt: string, userPrompt: string): Promise<AIReviewResponse>;
    getLastUsage(): AIProviderUsage | null;
    private validateResponse;
}
//# sourceMappingURL=openai.d.ts.map