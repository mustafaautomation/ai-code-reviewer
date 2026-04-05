export class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  async getPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github.v3.diff',
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch PR diff: ${res.status}`);
    return res.text();
  }

  async postReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error(`Failed to post comment: ${res.status}`);
  }

  async submitReview(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ body, event }),
    });
    if (!res.ok) throw new Error(`Failed to submit review: ${res.status}`);
  }
}
