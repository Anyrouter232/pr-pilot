import * as github from '@actions/github';
import { ActionConfig, RepoConfig, ResolvedConfig, Severity } from './types';
type Octokit = ReturnType<typeof github.getOctokit>;
export declare function loadRepoConfig(octokit: Octokit, owner: string, repo: string, ref: string): Promise<RepoConfig | null>;
export declare function validateRepoConfig(raw: unknown): RepoConfig;
export declare function mergeConfigs(actionConfig: ActionConfig, repoConfig: RepoConfig | null): ResolvedConfig;
export declare function isSeverityAboveThreshold(severity: Severity, threshold: Severity): boolean;
export {};
