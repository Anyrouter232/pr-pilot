export interface ActionConfig {
  githubToken: string;
  openaiApiKey: string;
  model: string;
  maxFiles: number;
  excludePatterns: string[];
  reviewLevel: 'concise' | 'standard' | 'thorough';
  customPrompt: string;
  postSummary: boolean;
  failOnIssues: boolean;
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
  severity: 'critical' | 'warning' | 'suggestion' | 'nitpick';
}

export interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
  issuesCount: number;
  approvalSuggestion: 'approve' | 'request_changes' | 'comment';
}

export interface OpenAIFileReview {
  filename: string;
  comments: Array<{
    line: number;
    severity: 'critical' | 'warning' | 'suggestion' | 'nitpick';
    comment: string;
  }>;
  fileSummary: string;
}
