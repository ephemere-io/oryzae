import { describe, expect, it } from 'vitest';
import { __INTERNAL } from '@/contexts/fermentation/infrastructure/llm/vercel-ai-analysis.gateway.js';
import {
  computeCostFromTokens,
  FERMENTATION_MODEL_ID,
  FERMENTATION_MODEL_RATE,
  OCR_MODEL_ID,
  PHOTO_TRANSCRIPTION_MODEL_ID,
} from '@/contexts/shared/infrastructure/claude-pricing.js';

describe('computeCostFromTokens', () => {
  it('両方 null/undefined なら null (コスト不明)', () => {
    expect(computeCostFromTokens(null, null)).toBeNull();
    expect(computeCostFromTokens(undefined, undefined)).toBeNull();
  });

  it('claude-sonnet-4-6 価格で算出する ($3/1M in, $15/1M out)', () => {
    const cost = computeCostFromTokens(1_000_000, 1_000_000);
    expect(cost).not.toBeNull();
    expect(cost?.totalCost).toBeCloseTo(18.0, 10); // 3 + 15
    expect(cost?.promptTokens).toBe(1_000_000);
    expect(cost?.completionTokens).toBe(1_000_000);
  });

  it('現実的なトークン数で算出する', () => {
    const cost = computeCostFromTokens(5000, 2000);
    // 5000*3/1e6 + 2000*15/1e6 = 0.015 + 0.030 = 0.045
    expect(cost?.totalCost).toBeCloseTo(0.045, 10);
  });

  it('片方だけ欠けても 0 扱いで算出する', () => {
    const cost = computeCostFromTokens(1000, null);
    expect(cost?.totalCost).toBeCloseTo(0.003, 10);
    expect(cost?.completionTokens).toBe(0);
  });

  // 文字起こし (photo_transcription_usages) はモデル名を保存するので単価が引ける。
  it('モデル未指定は発酵のモデル (claude-sonnet-4-6) を既定にする', () => {
    expect(computeCostFromTokens(1000, 1000)?.totalCost).toBeCloseTo(
      computeCostFromTokens(1000, 1000, 'claude-sonnet-4-6')?.totalCost ?? Number.NaN,
      10,
    );
    expect(computeCostFromTokens(1000, 1000, null)?.totalCost).toBeCloseTo(0.018, 10);
  });

  // 未知のモデルを 0 円にすると、モデル差し替え時に集計が黙って過少になる。
  it('未知のモデル名でも 0 円にはせず既定の単価で算出する', () => {
    const unknown = computeCostFromTokens(1000, 1000, 'claude-something-new');
    expect(unknown?.totalCost).toBeCloseTo(0.018, 10);
  });
});

// 推定コストが静かにズレる唯一の経路は「価格表とモデルの対応が切れること」。
// gateway がこの定数を使う限り、モデル変更は型エラーになって CI で止まる。
describe('価格表とモデルの対応', () => {
  it('公表単価と一致する ($3 / $15 per MTok)', () => {
    expect(FERMENTATION_MODEL_ID).toBe('claude-sonnet-4-6');
    expect(FERMENTATION_MODEL_RATE.inputUsdPerMTok).toBe(3.0);
    expect(FERMENTATION_MODEL_RATE.outputUsdPerMTok).toBe(15.0);
  });

  it('computeCostFromTokens が価格表の単価をそのまま使う', () => {
    const cost = computeCostFromTokens(1_000_000, 1_000_000);
    expect(cost?.totalCost).toBeCloseTo(
      FERMENTATION_MODEL_RATE.inputUsdPerMTok + FERMENTATION_MODEL_RATE.outputUsdPerMTok,
      10,
    );
  });

  it('gateway がプロンプトを組める（価格表の定数を import しても壊れない）', () => {
    // gateway が claude-pricing を import する構造になったことの回帰確認。
    expect(typeof __INTERNAL.buildPrompt).toBe('function');
  });
});

// コストの用途別内訳は cost_report の **モデル別** 実額で出している
// (anthropic-cost-api.ts)。2026-09-16 に board の OCR を opus-5 → sonnet-5 へ
// 落としたので、モデルと用途はもう 1:1 ではない（OCR と写真の文字起こしが同じ行に
// 入る）。混ざること自体は許容した判断だが、**混ざっている事実が名前から消える**のは
// 許さない——消えると「OCR の実額」として読まれてしまう。
describe('用途とモデルの対応', () => {
  it('発酵だけは他の用途と別モデル（推定と実額の突き合わせがこれに依存する）', () => {
    // cron-cost-alert.ts の fermentationActualUsd は「発酵モデルの実額」を拾って
    // 推定と比べ、乖離率を出す。画像系と同じモデルになるとその額に別用途が混ざり、
    // 乖離率が意味を失う。混ざってよいのは画像系どうしだけ。
    expect(FERMENTATION_MODEL_ID).not.toBe(OCR_MODEL_ID);
    expect(FERMENTATION_MODEL_ID).not.toBe(PHOTO_TRANSCRIPTION_MODEL_ID);
  });

  it('board の OCR と写真の文字起こしは同じモデル（コストを優先して揃えた）', () => {
    // 意図的に揃えている。経緯は claude-pricing.ts と docs/observability-guide.md。
    // 再び分けること自体は禁止していないが、そのときはここも一緒に直す。
    expect(OCR_MODEL_ID).toBe('claude-sonnet-5');
    expect(PHOTO_TRANSCRIPTION_MODEL_ID).toBe('claude-sonnet-5');
  });

  // モデル ID から用途を読み替える featureOfModel は 2026-09 に撤去した。
  // ボード OCR と写真の文字起こしが同じ claude-sonnet-5 で区別できないうえ、
  // CI の Claude が同じモデルを使えば同じ行に混ざる。実際 9/15 に定期監査の
  // 消費が「OCR $6.46」と報告され、9/23 には発酵 2 件（$0.12）の行に org 全体の
  // $6.44 が積まれた。用途別の実額は Workspace 軸で取る（anthropic-cost-api.ts）。
  it('モデル ID から用途を読み替える口を持たない', async () => {
    const pricing = await import('@/contexts/shared/infrastructure/claude-pricing.js');

    expect(Object.keys(pricing)).not.toContain('featureOfModel');
  });

  it('OCR のモデルは価格表に載せない（実額から取るので二重管理しない）', async () => {
    const pricing = await import('@/contexts/shared/infrastructure/claude-pricing.js');
    // RATES は非公開なので、公開されている単価の口が発酵のぶんだけであることで代用する。
    expect(Object.keys(pricing)).not.toContain('OCR_MODEL_RATE');
  });
});
