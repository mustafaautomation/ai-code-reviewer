export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ReviewFinding {
  severity: Severity;
  file: string;
  line: number;
  title: string;
  description: string;
  suggestion?: string;
  category: 'bug' | 'security' | 'performance' | 'quality';
}

export interface ReviewResult {
  prNumber: number;
  repo: string;
  findings: ReviewFinding[];
  summary: string;
  verdict: 'approve' | 'request_changes' | 'comment';
  timestamp: string;
  model: string;
  tokensUsed: number;
}

export interface PullRequestEvent {
  action: string;
  number: number;
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
  pull_request: {
    number: number;
    title: string;
    body: string;
    user: { login: string };
    head: { ref: string };
    base: { ref: string };
    changed_files: number;
    additions: number;
    deletions: number;
  };
}

export interface AppConfig {
  port: number;
  githubToken: string;
  anthropicApiKey: string;
  model: string;
  webhookSecret: string;
  maxDiffSize: number;
}
