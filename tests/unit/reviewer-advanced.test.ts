import { describe, it, expect } from 'vitest';
import { buildReviewPrompt, parseReviewResponse, formatReviewComment } from '../../src/ai/reviewer';
import { ReviewResult } from '../../src/core/types';

describe('buildReviewPrompt', () => {
  it('should include all PR metadata', () => {
    const prompt = buildReviewPrompt(
      'Fix auth bug',
      'alice',
      'fix/auth',
      'main',
      3,
      'diff content',
      10000,
    );
    expect(prompt).toContain('Fix auth bug');
    expect(prompt).toContain('alice');
    expect(prompt).toContain('fix/auth');
    expect(prompt).toContain('main');
    expect(prompt).toContain('3');
    expect(prompt).toContain('diff content');
  });

  it('should truncate large diffs', () => {
    const largeDiff = 'x'.repeat(5000);
    const prompt = buildReviewPrompt('PR', 'user', 'h', 'b', 1, largeDiff, 1000);
    expect(prompt).toContain('truncated');
    expect(prompt.length).toBeLessThan(largeDiff.length + 500);
  });

  it('should not truncate small diffs', () => {
    const smallDiff = 'small change';
    const prompt = buildReviewPrompt('PR', 'user', 'h', 'b', 1, smallDiff, 10000);
    expect(prompt).not.toContain('truncated');
    expect(prompt).toContain('small change');
  });

  it('should include structured JSON format requirements', () => {
    const prompt = buildReviewPrompt('PR', 'user', 'h', 'b', 1, 'diff', 10000);
    expect(prompt).toContain('"findings"');
    expect(prompt).toContain('"severity"');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('approve');
    expect(prompt).toContain('request_changes');
  });

  it('should request only real issues, no style nitpicks', () => {
    const prompt = buildReviewPrompt('PR', 'user', 'h', 'b', 1, 'diff', 10000);
    expect(prompt).toContain('no style nitpicks');
  });
});

describe('parseReviewResponse — valid JSON', () => {
  it('should parse clean JSON response', () => {
    const response = JSON.stringify({
      findings: [
        {
          severity: 'high',
          file: 'src/auth.ts',
          line: 42,
          title: 'SQL Injection risk',
          description: 'User input not sanitized',
          suggestion: 'Use parameterized queries',
          category: 'security',
        },
      ],
      summary: 'Found 1 security issue',
      verdict: 'request_changes',
    });

    const result = parseReviewResponse(
      response,
      123,
      'owner/repo',
      'claude-sonnet-4-20250514',
      500,
    );
    expect(result.prNumber).toBe(123);
    expect(result.repo).toBe('owner/repo');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[0].file).toBe('src/auth.ts');
    expect(result.findings[0].category).toBe('security');
    expect(result.verdict).toBe('request_changes');
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.tokensUsed).toBe(500);
  });

  it('should parse response wrapped in markdown code blocks', () => {
    const response = '```json\n{"findings":[],"summary":"All good","verdict":"approve"}\n```';
    const result = parseReviewResponse(response, 1, 'repo', 'model', 100);
    expect(result.verdict).toBe('approve');
    expect(result.findings).toHaveLength(0);
  });

  it('should handle multiple findings', () => {
    const response = JSON.stringify({
      findings: [
        {
          severity: 'critical',
          file: 'a.ts',
          line: 1,
          title: 'Bug',
          description: 'd',
          category: 'bug',
        },
        {
          severity: 'medium',
          file: 'b.ts',
          line: 5,
          title: 'Perf',
          description: 'd',
          category: 'performance',
        },
        {
          severity: 'low',
          file: 'c.ts',
          line: 10,
          title: 'Quality',
          description: 'd',
          category: 'quality',
        },
      ],
      summary: 'Mixed findings',
      verdict: 'request_changes',
    });

    const result = parseReviewResponse(response, 1, 'repo', 'model', 200);
    expect(result.findings).toHaveLength(3);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[2].severity).toBe('low');
  });

  it('should handle missing optional fields', () => {
    const response = JSON.stringify({
      findings: [{ severity: 'low', title: 'Minor' }],
      summary: 'Looks fine',
      verdict: 'comment',
    });

    const result = parseReviewResponse(response, 1, 'repo', 'model', 50);
    expect(result.findings[0].file).toBe('');
    expect(result.findings[0].line).toBe(0);
    expect(result.findings[0].suggestion).toBeUndefined();
  });

  it('should default verdict to comment', () => {
    const response = JSON.stringify({ findings: [], summary: 'ok' });
    const result = parseReviewResponse(response, 1, 'repo', 'model', 50);
    expect(result.verdict).toBe('comment');
  });

  it('should throw for invalid JSON', () => {
    expect(() => parseReviewResponse('not json', 1, 'repo', 'model', 0)).toThrow();
  });
});

describe('formatReviewComment', () => {
  it('should format approve verdict with checkmark', () => {
    const result: ReviewResult = {
      prNumber: 1,
      repo: 'repo',
      findings: [],
      summary: 'Looks perfect',
      verdict: 'approve',
      timestamp: '2026-04-06T10:00:00Z',
      model: 'claude-sonnet-4-20250514',
      tokensUsed: 100,
    };

    const comment = formatReviewComment(result);
    expect(comment).toContain('✅');
    expect(comment).toContain('AI Code Review');
    expect(comment).toContain('Looks perfect');
    expect(comment).toContain('No issues found');
    expect(comment).toContain('Quvantic');
  });

  it('should format request_changes with red circle', () => {
    const result: ReviewResult = {
      prNumber: 42,
      repo: 'org/repo',
      findings: [
        {
          severity: 'critical',
          file: 'src/db.ts',
          line: 15,
          title: 'SQL Injection',
          description: 'Unsanitized input in query',
          suggestion: 'Use parameterized queries',
          category: 'security',
        },
      ],
      summary: 'Critical security issue found',
      verdict: 'request_changes',
      timestamp: '2026-04-06T10:00:00Z',
      model: 'claude-sonnet-4-20250514',
      tokensUsed: 300,
    };

    const comment = formatReviewComment(result);
    expect(comment).toContain('🔴');
    expect(comment).toContain('CRITICAL');
    expect(comment).toContain('SQL Injection');
    expect(comment).toContain('src/db.ts:15');
    expect(comment).toContain('parameterized queries');
    expect(comment).toContain('1 critical');
  });

  it('should show all severity emojis', () => {
    const result: ReviewResult = {
      prNumber: 1,
      repo: 'r',
      findings: [
        { severity: 'critical', file: 'a', line: 1, title: 'C', description: 'd', category: 'bug' },
        { severity: 'high', file: 'b', line: 2, title: 'H', description: 'd', category: 'bug' },
        {
          severity: 'medium',
          file: 'c',
          line: 3,
          title: 'M',
          description: 'd',
          category: 'quality',
        },
        { severity: 'low', file: 'd', line: 4, title: 'L', description: 'd', category: 'quality' },
      ],
      summary: 'Mixed',
      verdict: 'request_changes',
      timestamp: '',
      model: 'm',
      tokensUsed: 0,
    };

    const comment = formatReviewComment(result);
    expect(comment).toContain('🔴');
    expect(comment).toContain('🟠');
    expect(comment).toContain('🟡');
    expect(comment).toContain('🔵');
    expect(comment).toContain('1 critical, 1 high, 1 medium, 1 low');
  });

  it('should include model info in footer', () => {
    const result: ReviewResult = {
      prNumber: 1,
      repo: 'r',
      findings: [],
      summary: 'ok',
      verdict: 'approve',
      timestamp: '',
      model: 'claude-opus-4-20250514',
      tokensUsed: 0,
    };

    const comment = formatReviewComment(result);
    expect(comment).toContain('claude-opus-4-20250514');
  });
});
