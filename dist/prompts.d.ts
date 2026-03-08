import { ResolvedConfig, PRContext, FileGroup } from './types';
export declare function getSystemPrompt(config: ResolvedConfig): string;
export declare function getUserPrompt(prContext: PRContext, annotatedDiffs: string[]): string;
export declare function getUserPromptForGroup(prContext: PRContext, group: FileGroup, annotatedDiffs: string[]): string;
