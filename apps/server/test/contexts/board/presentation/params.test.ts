import { describe, expect, it } from 'vitest';
import { parseDimension } from '@/contexts/board/presentation/params';

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
