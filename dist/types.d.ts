export type ProviderName = 'openai' | 'anthropic' | 'gemini';
export type Severity = 'critical' | 'warning' | 'suggestion' | 'nitpick';
export interface AIProviderUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export interface ActionConfig {
    githubToken: string;
    provider: ProviderName;
    openaiApiKey: string;
    anthropicApiKey: string;
    geminiApiKey: string;
    model: string;
    maxFiles: number;
    excludePatterns: string[];
    reviewLevel: 'concise' | 'standard' | 'thorough';
    customPrompt: string;
    postSummary: boolean;
    failOnIssues: boolean;
}
export interface RepoConfig {
    provider?: ProviderName;
    model?: string;
    max_files?: number;
    exclude_patterns?: string[];
    review_level?: 'concise' | 'standard' | 'thorough';
    custom_prompt?: string;
    post_summary?: boolean;
    fail_on_issues?: boolean;
    ignore_paths?: string[];
    review_rules?: string[];
    language_hints?: Record<string, string>;
    severity_threshold?: Severity;
    max_comment_length?: number;
    auto_approve?: boolean;
}
export interface ResolvedConfig extends ActionConfig {
    ignorePaths: string[];
    reviewRules: string[];
    languageHints: Record<string, string>;
    severityThreshold: Severity;
    maxCommentLength: number;
    autoApprove: boolean;
}
export interface PRContext {
    owner: string;
    repo: string;
    pullNumber: number;
    title: string;
    body: string;
    baseSha: string;
    headSha: string;
}
export interface PRFile {
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
    additions: number;
    deletions: number;
    patch?: string;
}
export interface DiffHunk {
    filename: string;
    startLine: number;
    endLine: number;
    content: string;
}
export interface ReviewComment {
    path: string;
    line: number;
    side: 'RIGHT';
    body: string;
    severity: Severity;
}
export interface ReviewResult {
    summary: string;
    comments: ReviewComment[];
    issuesCount: number;
    approvalSuggestion: 'approve' | 'request_changes' | 'comment';
    analyticsReport: string;
    metrics: ReviewMetrics;
}
export interface ReviewMetrics {
    filesReviewed: number;
    totalLinesAnalyzed: number;
    issuesBySeverity: Record<Severity, number>;
    tokenUsage: AIProviderUsage | null;
    modelUsed: string;
    providerUsed: string;
    reviewDurationMs: number;
    fileIssueRanking: Array<{
        filename: string;
        issueCount: number;
    }>;
}
export interface AIFileReview {
    filename: string;
    comments: Array<{
        line: number;
        severity: Severity;
        comment: string;
    }>;
    fileSummary: string;
}
export interface IncrementalContext {
    isIncremental: boolean;
    previousSha: string | null;
    currentSha: string;
    commitRange: string | null;
}
export interface FileGroup {
    name: string;
    files: PRFile[];
    context: string;
}
