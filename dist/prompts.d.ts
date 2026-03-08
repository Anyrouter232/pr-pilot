import { ActionConfig, PRContext } from './types';
export declare function getSystemPrompt(config: ActionConfig): string;
export declare function getUserPrompt(prContext: PRContext, annotatedDiffs: string[]): string;
