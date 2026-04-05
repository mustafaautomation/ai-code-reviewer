import express from 'express';
import { PullRequestEvent, AppConfig } from '../core/types';
import { GitHubClient } from '../github/client';
import { ClaudeClient } from '../ai/claude-client';
import { buildReviewPrompt, parseReviewResponse, formatReviewComment } from '../ai/reviewer';

export function createApp(config: AppConfig): express.Application {
  const app = express();
  app.use(express.json());

  const github = new GitHubClient(config.githubToken);
  const claude = new ClaudeClient(config.anthropicApiKey, config.model);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', model: config.model });
  });

  app.post('/webhook', async (req, res) => {
    const event = req.body as PullRequestEvent;

    if (event.action !== 'opened' && event.action !== 'synchronize') {
      res.json({ skipped: true, reason: `action=${event.action}` });
      return;
    }

    const { repository, pull_request: pr } = event;
    const [owner, repo] = repository.full_name.split('/');

    console.log(`Reviewing PR #${pr.number}: ${pr.title} (${owner}/${repo})`);

    try {
      const diff = await github.getPullRequestDiff(owner, repo, pr.number);

      const prompt = buildReviewPrompt(
        pr.title,
        pr.user.login,
        pr.head.ref,
        pr.base.ref,
        pr.changed_files,
        diff,
        config.maxDiffSize,
      );

      const { text, tokensUsed } = await claude.analyze(prompt);

      const result = parseReviewResponse(
        text,
        pr.number,
        repository.full_name,
        config.model,
        tokensUsed,
      );
      const comment = formatReviewComment(result);

      await github.postReviewComment(owner, repo, pr.number, comment);

      console.log(`Review posted: ${result.findings.length} findings, verdict=${result.verdict}`);
      res.json({ reviewed: true, findings: result.findings.length, verdict: result.verdict });
    } catch (err) {
      console.error(`Review failed: ${(err as Error).message}`);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return app;
}

// Start server when run directly
if (require.main === module) {
  const config: AppConfig = {
    port: parseInt(process.env.PORT || '3000'),
    githubToken: process.env.GITHUB_TOKEN || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.MODEL || 'claude-sonnet-4-20250514',
    webhookSecret: process.env.WEBHOOK_SECRET || '',
    maxDiffSize: parseInt(process.env.MAX_DIFF_SIZE || '8000'),
  };

  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`AI Code Reviewer running on http://localhost:${config.port}`);
    console.log(`Model: ${config.model}`);
  });
}
