import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// features/ の直下は reach（pc / sp / shared）の 3 つだけ。
//
// 以前は「端末非依存の UI」を features/{domain} のフラットな第4のグループに置き、
// features/shared は UI を持たないロジック専用層としていた。これは穴になっていた:
//
//   - pc/sp は他ドメインを import できない（例外は features/shared のみ）
//     → pc/sp から flat features は import できない
//   - features/shared には UI を置けない
//   → 「PC と SP で同じ見た目で、両方から使いたいドメイン UI」に置き場が無く、
//      pc と sp にコピーするしかなかった
//
// これは #490 そのもの（SP が PC のコードを再利用できず重複が生まれる）で、
// ロジックについては直したのに UI については同じ罠が残っていた。
// そこで shared に UI を許し、flat 層を畳んだ。防ぎたかった「shared の中で端末が
// 分岐する」は dep-cruiser の shared-no-device-detection が直接禁じる。

const REACH = ['pc', 'shared', 'sp'];

describe('features/ の直下は reach だけ', () => {
  it('pc / sp / shared 以外のディレクトリが無い', () => {
    const dirs = readdirSync('src/features', { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(dirs).toEqual(REACH);
  });
});
