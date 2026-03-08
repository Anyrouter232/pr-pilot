import Anthropic from '@anthropic-ai/sdk';
import * as core from '@actions/core';
import { AIProviderUsage } from '../types';
import { AIProvider, AIReviewResponse } from './provider';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;
  private lastUsage: AIProviderUsage | null = null;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async reviewDiff(systemPrompt: string, userPrompt: string): Promise<AIReviewResponse> {
    core.info(`Sending review request to Anthropic (model: ${this.model})...`);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Anthropic returned an empty response.');
    }

    this.lastUsage = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    core.info(
      `Anthropic response received. Tokens used: ${this.lastUsage.totalTokens.toLocaleString()}`
    );

    const content = this.stripMarkdownFences(textBlock.text);

    try {
      const parsed = JSON.parse(content) as AIReviewResponse;
      return this.validateResponse(parsed);
    } catch {
      core.error(`Failed to parse Anthropic response as JSON: ${content.substring(0, 500)}`);
      throw new Error('Anthropic response was not valid JSON. This may be a model issue.');
    }
  }

  getLastUsage(): AIProviderUsage | null {
    return this.lastUsage;
  }

  private stripMarkdownFences(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    return cleaned.trim();
  }

  private validateResponse(response: AIReviewResponse): AIReviewResponse {
    if (!response.summary || typeof response.summary !== 'string') {
      response.summary = 'No summary provided.';
    }
    if (!Array.isArray(response.files)) {
      response.files = [];
    }
    if (!['approve', 'request_changes', 'comment'].includes(response.overallSeverity)) {
      response.overallSeverity = 'comment';
    }

    for (const file of response.files) {
      if (!Array.isArray(file.comments)) {
        file.comments = [];
      }
      file.comments = file.comments.filter(
        (c) => typeof c.line === 'number' && typeof c.comment === 'string' && c.line > 0
      );
    }

    return response;
  }
}
