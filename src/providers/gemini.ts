import { GoogleGenerativeAI } from '@google/generative-ai';
import * as core from '@actions/core';
import { AIProviderUsage } from '../types';
import { AIProvider, AIReviewResponse } from './provider';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private genAI: GoogleGenerativeAI;
  private model: string;
  private lastUsage: AIProviderUsage | null = null;

  constructor(apiKey: string, model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async reviewDiff(systemPrompt: string, userPrompt: string): Promise<AIReviewResponse> {
    core.info(`Sending review request to Gemini (model: ${this.model})...`);

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error('Gemini returned an empty response.');
    }

    const usage = response.usageMetadata;
    this.lastUsage = {
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
      totalTokens: usage?.totalTokenCount ?? 0,
    };

    core.info(
      `Gemini response received. Tokens used: ${this.lastUsage.totalTokens.toLocaleString()}`
    );

    try {
      const parsed = JSON.parse(content) as AIReviewResponse;
      return this.validateResponse(parsed);
    } catch {
      core.error(`Failed to parse Gemini response as JSON: ${content.substring(0, 500)}`);
      throw new Error('Gemini response was not valid JSON. This may be a model issue.');
    }
  }

  getLastUsage(): AIProviderUsage | null {
    return this.lastUsage;
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
