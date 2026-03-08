import * as github from '@actions/github';
import { PRContext, PRFile, IncrementalContext } from './types';
type Octokit = ReturnType<typeof github.getOctokit>;
export declare function getIncrementalContext(octokit: Octokit, prContext: PRContext): Promise<IncrementalContext>;
export declare function findPreviousReviewSha(octokit: Octokit, prContext: PRContext): Promise<string | null>;
export declare function getIncrementalFiles(octokit: Octokit, prContext: PRContext, incrementalCtx: IncrementalContext, excludePatterns: string[], maxFiles: number): Promise<PRFile[]>;
export declare function buildShaMarker(sha: string): string;
export declare function extractShaFromMarker(text: string): string | null;
export {};
