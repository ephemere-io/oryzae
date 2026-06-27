/**
 * 横展開のリファレンス用・自己完結サンプル（実 feature 非依存・いつでも削除可）。
 *
 * 実 feature にユニットを足すときは、このファイルをテンプレートに、コンポーネント側へ
 * `verifyAttrs` を付け、feature の隣に `<x>.verify.tsx` を置いて register.ts に1行足す。
 * propsSchema には `@oryzae/shared` の既存 Zod スキーマを流用できる（このサンプルは
 * 依存を増やさないため propsSchema を省き、不整合は invariant で検出する）。
 */

import { registerUnit, verifyAttrs } from '@oryzae/verify';

interface ExampleProgressProps {
  total: number;
  done: number;
  active: number;
}

function ExampleProgress({ total, done, active }: ExampleProgressProps) {
  const complete = total > 0 && done === total;
  return (
    <div
      className={complete ? 'progress is-complete' : 'progress'}
      {...verifyAttrs({
        unit: 'ExampleProgress',
        total,
        done,
        active,
        consistent: total === done + active,
        complete,
      })}
    >
      <strong>{done}</strong> / {total}
    </div>
  );
}

registerUnit<ExampleProgressProps>({
  id: 'ExampleProgress',
  title: 'ExampleProgress（リファレンス）',
  description: '横展開テンプレート。実 feature には影響しない自己完結サンプル。',
  kind: 'component',
  render: (props) => <ExampleProgress {...props} />,
  fixtures: [
    { id: 'mixed', description: '3件中1件完了', props: { total: 3, done: 1, active: 2 } },
    { id: 'all-done', description: '全件完了', props: { total: 2, done: 2, active: 0 } },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 0件でも崩れない',
      props: { total: 0, done: 0, active: 0 },
    },
    {
      id: 'inconsistent',
      probe: true,
      description: 'Probe: total≠done+active。invariant が FAIL すべき（嘘を捕まえる実証）。',
      props: { total: 10, done: 3, active: 4 },
    },
  ],
  invariants: [
    {
      id: 'counts-consistent',
      description: 'total === done + active（合計が一致する）',
      check: ({ props }) =>
        props.total === props.done + props.active ||
        `total=${props.total} !== done=${props.done} + active=${props.active}`,
    },
    {
      id: 'complete-class-matches',
      description: 'is-complete クラスは done===total のときだけ付く',
      check: ({ root, contract }) => {
        const el = root.querySelector('[data-verify-unit="ExampleProgress"]');
        const hasClass = Boolean(el?.classList.contains('is-complete'));
        return (
          hasClass === (contract.complete === 'true') ||
          `class/contract mismatch: complete=${contract.complete}, hasClass=${hasClass}`
        );
      },
    },
    {
      id: 'rendered-done-matches',
      description: '表示の done 数が props.done と一致',
      check: ({ root, props }) => {
        const strong = root.querySelector('strong');
        return (
          strong?.textContent?.trim() === String(props.done) ||
          `rendered "${strong?.textContent}", expected "${props.done}"`
        );
      },
    },
  ],
});
