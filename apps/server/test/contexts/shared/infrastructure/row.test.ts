import { describe, expect, it } from 'vitest';
import {
  readBoolean,
  readBooleanOr,
  readEnum,
  readNumber,
  readNumberOrNull,
  readOptionalNumber,
  readOptionalString,
  readRecord,
  readString,
  readStringArray,
  readStringOrNull,
  toRecord,
  toRecordArray,
} from '@/contexts/shared/infrastructure/row.js';

describe('toRecord', () => {
  it('オブジェクトはそのまま行として読める', () => {
    expect(toRecord({ id: 'a' })).toEqual({ id: 'a' });
  });

  it('null / 配列 / プリミティブは弾く', () => {
    expect(() => toRecord(null)).toThrow(/expected row to be an object but got null/i);
    expect(() => toRecord([])).toThrow(/array/);
    expect(() => toRecord('x')).toThrow(/string/);
  });
});

describe('toRecordArray', () => {
  it('行の配列を読める', () => {
    expect(toRecordArray([{ a: 1 }, { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('配列でなければ弾く', () => {
    expect(() => toRecordArray({})).toThrow(/expected rows to be an array/i);
  });

  it('要素がオブジェクトでなければ、何番目かが分かる形で弾く', () => {
    expect(() => toRecordArray([{ a: 1 }, 'nope'])).toThrow(/rows\[1\]/);
  });
});

describe('readString', () => {
  it('文字列カラムを読む', () => {
    expect(readString({ id: 'abc' }, 'id')).toBe('abc');
  });

  it('型が違えばカラム名付きで落ちる', () => {
    expect(() => readString({ id: 1 }, 'id')).toThrow(
      'Row column "id" expected string but got number',
    );
  });

  it('カラムが無ければ落ちる（undefined がドメインへ漏れない）', () => {
    expect(() => readString({}, 'id')).toThrow(/expected string but got undefined/);
  });

  it('null も落ちる', () => {
    expect(() => readString({ id: null }, 'id')).toThrow(/but got null/);
  });
});

describe('readNumber', () => {
  it('数値カラムを読む', () => {
    expect(readNumber({ x: 0 }, 'x')).toBe(0);
    expect(readNumber({ x: -1.5 }, 'x')).toBe(-1.5);
  });

  it('NaN は数値として扱わない', () => {
    expect(() => readNumber({ x: Number.NaN }, 'x')).toThrow(/expected number/);
  });

  it('数字文字列は受け付けない', () => {
    expect(() => readNumber({ x: '1' }, 'x')).toThrow(/but got string/);
  });
});

describe('readBoolean', () => {
  it('真偽値カラムを読む', () => {
    expect(readBoolean({ ok: false }, 'ok')).toBe(false);
  });

  it('型が違えば落ちる', () => {
    expect(() => readBoolean({ ok: 'true' }, 'ok')).toThrow(/expected boolean/);
  });
});

describe('readEnum', () => {
  const TYPES = ['entry', 'snippet', 'photo'] as const;

  it('許可値なら読める', () => {
    expect(readEnum({ t: 'snippet' }, 't', TYPES)).toBe('snippet');
  });

  it('許可値の外なら候補付きで落ちる', () => {
    expect(() => readEnum({ t: 'other' }, 't', TYPES)).toThrow(
      'Row column "t" expected entry | snippet | photo but got string',
    );
  });

  it('欠損も落ちる', () => {
    expect(() => readEnum({}, 't', TYPES)).toThrow(/but got undefined/);
  });
});

describe('NULL 許容の読み出し', () => {
  it('readStringOrNull は null と欠損をどちらも null にする', () => {
    expect(readStringOrNull({ a: null }, 'a')).toBeNull();
    expect(readStringOrNull({}, 'a')).toBeNull();
    expect(readStringOrNull({ a: 'x' }, 'a')).toBe('x');
  });

  it('readStringOrNull は型違いなら落ちる', () => {
    expect(() => readStringOrNull({ a: 1 }, 'a')).toThrow(/string \| null/);
  });

  it('readNumberOrNull も同様', () => {
    expect(readNumberOrNull({ a: null }, 'a')).toBeNull();
    expect(readNumberOrNull({ a: 3 }, 'a')).toBe(3);
    expect(() => readNumberOrNull({ a: 'x' }, 'a')).toThrow(/number \| null/);
  });

  it('readOptionalString / readOptionalNumber は undefined を返す', () => {
    expect(readOptionalString({}, 'a')).toBeUndefined();
    expect(readOptionalString({ a: null }, 'a')).toBeUndefined();
    expect(readOptionalNumber({}, 'a')).toBeUndefined();
    expect(readOptionalNumber({ a: 2 }, 'a')).toBe(2);
  });
});

describe('readBooleanOr', () => {
  it('NULL / 欠損は既定値に丸める', () => {
    expect(readBooleanOr({ a: null }, 'a', false)).toBe(false);
    expect(readBooleanOr({}, 'a', true)).toBe(true);
  });

  it('値があればそちらを優先する', () => {
    expect(readBooleanOr({ a: false }, 'a', true)).toBe(false);
  });

  it('型が違えば既定値に逃がさず落ちる', () => {
    expect(() => readBooleanOr({ a: 'no' }, 'a', false)).toThrow(/expected boolean/);
  });
});

describe('readStringArray', () => {
  it('文字列配列を読む', () => {
    expect(readStringArray({ urls: ['a', 'b'] }, 'urls')).toEqual(['a', 'b']);
  });

  it('NULL / 欠損は空配列', () => {
    expect(readStringArray({ urls: null }, 'urls')).toEqual([]);
    expect(readStringArray({}, 'urls')).toEqual([]);
  });

  it('要素に文字列以外が混じれば落ちる', () => {
    expect(() => readStringArray({ urls: ['a', 2] }, 'urls')).toThrow(/string\[\]/);
  });
});

describe('readRecord', () => {
  it('JSONB カラムを読む', () => {
    expect(readRecord({ ext: { k: 1 } }, 'ext')).toEqual({ k: 1 });
  });

  it('NULL / 欠損は空オブジェクト', () => {
    expect(readRecord({ ext: null }, 'ext')).toEqual({});
    expect(readRecord({}, 'ext')).toEqual({});
  });

  it('配列は弾く', () => {
    expect(() => readRecord({ ext: [] }, 'ext')).toThrow(/expected object but got array/);
  });
});
