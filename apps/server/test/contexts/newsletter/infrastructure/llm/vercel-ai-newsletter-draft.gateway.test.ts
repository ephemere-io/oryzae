import { describe, expect, it } from 'vitest';
import type { MergedPullRequest } from '@/contexts/newsletter/domain/gateways/changelog-source.gateway.js';
import { __INTERNAL } from '@/contexts/newsletter/infrastructure/llm/vercel-ai-newsletter-draft.gateway.js';

const { buildPrompt } = __INTERNAL;

const pullRequests: MergedPullRequest[] = [
  {
    number: 601,
    title: 'feat(study): 積みのいちばん上は新規執筆に戻す',
    mergedAt: '2026-09-10T00:00:00.000Z',
    body: '書斎の積みから新規執筆へ戻れるようにした。',
    url: 'https://github.com/ephemere-io/oryzae/pull/601',
  },
  {
    number: 602,
    title: 'chore(deps): bump undici',
    mergedAt: '2026-09-11T00:00:00.000Z',
    body: '',
    url: 'https://github.com/ephemere-io/oryzae/pull/602',
  },
];

describe('buildPrompt', () => {
  it('PR の番号・タイトル・本文をすべて素材として渡す', () => {
    const prompt = buildPrompt({ pullRequests, since: null, previousSubjects: [] });

    expect(prompt).toContain('#601');
    expect(prompt).toContain('積みのいちばん上は新規執筆に戻す');
    expect(prompt).toContain('書斎の積みから新規執筆へ戻れるようにした。');
    expect(prompt).toContain('#602');
  });

  it('本文が空の PR も落とさない（タイトルだけでも素材になる）', () => {
    const prompt = buildPrompt({ pullRequests, since: null, previousSubjects: [] });
    expect(prompt).toContain('(本文なし)');
  });

  it('前回配信の時刻を「いつ以降か」として渡す', () => {
    const prompt = buildPrompt({
      pullRequests,
      since: '2026-08-01T00:00:00.000Z',
      previousSubjects: [],
    });
    expect(prompt).toContain('前回の配信（2026-08-01T00:00:00.000Z）以降');
  });

  it('初回は「これが初回の配信」と伝える（存在しない前回に言及させない）', () => {
    const prompt = buildPrompt({ pullRequests, since: null, previousSubjects: [] });
    expect(prompt).toContain('これが初回の配信');
    expect(prompt).not.toContain('前回の配信（');
  });

  it('直近の件名を渡すのは、渡すものがあるときだけ', () => {
    const withSubjects = buildPrompt({
      pullRequests,
      since: null,
      previousSubjects: ['8 月の更新'],
    });
    expect(withSubjects).toContain('8 月の更新');
    expect(withSubjects).toContain('同じ言い回しを繰り返さない');

    const withoutSubjects = buildPrompt({ pullRequests, since: null, previousSubjects: [] });
    expect(withoutSubjects).not.toContain('同じ言い回しを繰り返さない');
  });

  // 素材は開発者向けの言葉で、そのまま並べると使用者には読めない。
  // 水増しされたお知らせは次から読まれなくなるので、落とす指示は必須。
  it('「利用者に見えない変更は載せない」「事実だけ」を必ず指示する', () => {
    const prompt = buildPrompt({ pullRequests, since: null, previousSubjects: [] });
    expect(prompt).toContain('載せない');
    expect(prompt).toContain('素材に無い機能・日付・数字を足さない');
    expect(prompt).toContain('PR のタイトルをそのまま並べない');
  });

  // 本文レンダラ (newsletter-content.service) が解釈できない記法を書かれると、
  // そのまま素の文字として届く。使える記法をプロンプトで閉じる。
  it('使える記法をレンダラの対応範囲に限定する', () => {
    const prompt = buildPrompt({ pullRequests, since: null, previousSubjects: [] });
    expect(prompt).toContain('表・画像・コードブロック・HTML は使えません');
  });
});
