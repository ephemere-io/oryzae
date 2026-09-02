import { describe, expect, it } from 'vitest';
import { parseDimension, parseWorldCoord } from '@/contexts/board/presentation/params';

/**
 * 画像の実寸はクライアントの自己申告なので、入口で疑ってかかる。
 * 以前は `Number.isFinite(x) ? x : undefined` で、0 も負値も "12abc" も通っていた。
 */
describe('parseDimension', () => {
  it('数字だけの文字列を数値にする', () => {
    expect(parseDimension('800')).toBe(800);
  });

  it('前後の空白は許す', () => {
    expect(parseDimension(' 800 ')).toBe(800);
  });

  it('数字以外が混じっていたら捨てる', () => {
    // Number.parseInt は "12abc" を 12 として通してしまう
    expect(parseDimension('12abc')).toBeUndefined();
    expect(parseDimension('abc')).toBeUndefined();
    expect(parseDimension('8.5')).toBeUndefined();
    expect(parseDimension('1e3')).toBeUndefined();
  });

  it('0 と負値は捨てる（縦横比の計算が壊れる）', () => {
    expect(parseDimension('0')).toBeUndefined();
    expect(parseDimension('-100')).toBeUndefined();
  });

  it('現実離れした大きさは捨てる（桁数でも縛る）', () => {
    expect(parseDimension('20000')).toBe(20000);
    expect(parseDimension('20001')).toBeUndefined();
    // 精度が落ちるような桁数は、数にする前に落とす
    expect(parseDimension('9'.repeat(30))).toBeUndefined();
  });

  it('文字列以外は捨てる', () => {
    expect(parseDimension(undefined)).toBeUndefined();
    expect(parseDimension(null)).toBeUndefined();
    expect(parseDimension(800)).toBeUndefined();
  });

  it('空文字は捨てる', () => {
    expect(parseDimension('')).toBeUndefined();
    expect(parseDimension('   ')).toBeUndefined();
  });
});

/**
 * 置き場所は寸法と違い、負の値も小数も正しい（原点より左・上にも置ける）。
 * だからといって何でも通すわけではなく、形を外れた値は既定のランダム配置に落とす。
 */
describe('parseWorldCoord', () => {
  it('負の値も小数も受ける（原点より左・上に置ける）', () => {
    expect(parseWorldCoord('120')).toBe(120);
    expect(parseWorldCoord('-40')).toBe(-40);
    expect(parseWorldCoord('12.5')).toBe(12.5);
    expect(parseWorldCoord('-12.5')).toBe(-12.5);
    expect(parseWorldCoord('0')).toBe(0);
  });

  it('数字で始まるだけの文字列は捨てる（parseFloat が拾ってしまう）', () => {
    expect(parseWorldCoord('12abc')).toBeUndefined();
    expect(parseWorldCoord('12px')).toBeUndefined();
  });

  it('指数表記は捨てる（Infinity になりうる）', () => {
    expect(parseWorldCoord('1e999')).toBeUndefined();
    expect(parseWorldCoord('1e3')).toBeUndefined();
  });

  it('Infinity / NaN の綴りは捨てる', () => {
    expect(parseWorldCoord('Infinity')).toBeUndefined();
    expect(parseWorldCoord('-Infinity')).toBeUndefined();
    expect(parseWorldCoord('NaN')).toBeUndefined();
  });

  it('現実離れした遠さは捨てる', () => {
    expect(parseWorldCoord('1000000')).toBe(1000000);
    expect(parseWorldCoord('-1000000')).toBe(-1000000);
    expect(parseWorldCoord('9'.repeat(30))).toBeUndefined();
  });

  it('前後の空白は許すが、文字列以外と空文字は捨てる', () => {
    expect(parseWorldCoord(' 120 ')).toBe(120);
    expect(parseWorldCoord('')).toBeUndefined();
    expect(parseWorldCoord('   ')).toBeUndefined();
    expect(parseWorldCoord(undefined)).toBeUndefined();
    expect(parseWorldCoord(null)).toBeUndefined();
    expect(parseWorldCoord(120)).toBeUndefined();
  });
});
