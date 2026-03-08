import { AIProviderUsage } from '../types';
import { AIProvider, AIReviewResponse } from './provider';
export declare class AnthropicProvider implements AIProvider {
    readonly name = "anthropic";
    private client;
    private model;
    private lastUsage;
    constructor(apiKey: string, model: string);
    reviewDiff(systemPrompt: string, userPrompt: string): Promise<AIReviewResponse>;
    getLastUsage(): AIProviderUsage | null;
    private stripMarkdownFences;
    private validateResponse;
}
//# sourceMappingURL=anthropic.d.ts.map