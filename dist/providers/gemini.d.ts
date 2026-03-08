import { AIProviderUsage } from '../types';
import { AIProvider, AIReviewResponse } from './provider';
export declare class GeminiProvider implements AIProvider {
    readonly name = "gemini";
    private genAI;
    private model;
    private lastUsage;
    constructor(apiKey: string, model: string);
    reviewDiff(systemPrompt: string, userPrompt: string): Promise<AIReviewResponse>;
    getLastUsage(): AIProviderUsage | null;
    private validateResponse;
}
//# sourceMappingURL=gemini.d.ts.map