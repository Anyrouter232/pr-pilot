import OpenAI from 'openai';
import * as core from '@actions/core';
import { OpenAIFileReview } from './types';

export interface OpenAIReviewResponse {
  summary: string;
  files: OpenAIFileReview[];
  overallSeverity: 'approve' | 'request_changes' | 'comment';
}

export class OpenAIClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async reviewDiff(systemPrompt: string, userPrompt: string): Promise<OpenAIReviewResponse> {
    core.info(`Sending review request to OpenAI (model: ${this.model})...`);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty response.');
    }

    core.info(
      `OpenAI response received. Tokens used: ${response.usage?.total_tokens ?? 'unknown'}`
    );

    try {
      const parsed = JSON.parse(content) as OpenAIReviewResponse;
      return this.validateResponse(parsed);
    } catch (error) {
      core.error(`Failed to parse OpenAI response as JSON: ${content.substring(0, 500)}`);
      throw new Error('OpenAI response was not valid JSON. This may be a model issue.');
    }
  }

  private validateResponse(response: OpenAIReviewResponse): OpenAIReviewResponse {
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
