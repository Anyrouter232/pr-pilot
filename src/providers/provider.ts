import { AIProviderUsage, AIFileReview } from '../types';

export interface AIReviewResponse {
  summary: string;
  files: AIFileReview[];
  overallSeverity: 'approve' | 'request_changes' | 'comment';
}

export interface AIProvider {
  readonly name: string;
  reviewDiff(systemPrompt: string, userPrompt: string): Promise<AIReviewResponse>;
  getLastUsage(): AIProviderUsage | null;
}
