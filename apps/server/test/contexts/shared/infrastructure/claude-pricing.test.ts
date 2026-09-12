import { describe, expect, it } from 'vitest';
import { __INTERNAL } from '@/contexts/fermentation/infrastructure/llm/vercel-ai-analysis.gateway.js';
import {
  computeCostFromTokens,
  FERMENTATION_MODEL_ID,
  FERMENTATION_MODEL_RATE,
  featureOfModel,
  NEWSLETTER_MODEL_ID,
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
// (anthropic-cost-api.ts)。発酵と OCR が同じモデルになると、その内訳が
// 用途別として機能しなくなる（混ざって区別できない）。
describe('用途とモデルの対応', () => {
  it('4 つの用途はすべて別モデル（モデル別内訳が用途別内訳として成立する前提）', () => {
    // どれか 2 つが同じモデルになると、その 2 つの費用が同じバケットに混ざり、
    // 用途別の内訳として読めなくなる。全通りすべてを見る。
    const ids = [
      FERMENTATION_MODEL_ID,
      OCR_MODEL_ID,
      PHOTO_TRANSCRIPTION_MODEL_ID,
      NEWSLETTER_MODEL_ID,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('4 つの用途すべてが名前に読み替えられる', () => {
    // 読み替えられないモデルは費用が「分類不明」に落ちる。#529 で写真の文字起こしが
    // 登録漏れになり、管理画面でも費用アラートでも分類されていなかった。
    expect(featureOfModel(FERMENTATION_MODEL_ID)).toBe('発酵');
    expect(featureOfModel(OCR_MODEL_ID)).toBe('OCR');
    expect(featureOfModel(PHOTO_TRANSCRIPTION_MODEL_ID)).toBe('写真の文字起こし');
    expect(featureOfModel(NEWSLETTER_MODEL_ID)).toBe('ニュースレター下書き');
  });

  it('用途名は互いに重ならない（内訳が読めなくなるため）', () => {
    const names = [
      FERMENTATION_MODEL_ID,
      OCR_MODEL_ID,
      PHOTO_TRANSCRIPTION_MODEL_ID,
      NEWSLETTER_MODEL_ID,
    ].map(featureOfModel);
    expect(new Set(names).size).toBe(names.length);
  });

  it('未登録のモデルは null（分類不明）を返す', () => {
    // CI や別用途が同じ API キーを使うと未知のモデルが混ざる。
    // 勝手にどれかの用途へ寄せず、分類不明のまま返す。
    expect(featureOfModel('claude-opus-4-8')).toBeNull();
  });

  it('OCR のモデルは価格表に載せない（実額から取るので二重管理しない）', async () => {
    const pricing = await import('@/contexts/shared/infrastructure/claude-pricing.js');
    // RATES は非公開なので、公開されている単価の口が発酵のぶんだけであることで代用する。
    expect(Object.keys(pricing)).not.toContain('OCR_MODEL_RATE');
  });
});
