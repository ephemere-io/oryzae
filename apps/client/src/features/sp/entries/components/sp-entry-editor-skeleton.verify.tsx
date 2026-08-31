/**
 * SpEntryEditorSkeleton の検証スペック。
 * 新規（/entries/new）と既存（/entries/[id]）で出す枠が変わることを固定する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { SpEntryEditorSkeleton } from './sp-entry-editor-skeleton';

interface Props {
  bodyLines?: number;
  withPickleCta?: boolean;
}

registerUnit<Props>({
  id: 'SpEntryEditorSkeleton',
  title: 'SpEntryEditorSkeleton',
  description: 'SP エディタのロード枠: ステータス / タイトル / 問いチップ / 本文 / 漬け込み CTA',
  kind: 'component',
  render: (props) => <SpEntryEditorSkeleton {...props} />,
  fixtures: [
    {
      id: 'existing-entry',
      description: '既存エントリ（本文あり・漬け込み CTA あり）',
      props: { bodyLines: 4, withPickleCta: true },
    },
    {
      id: 'new-entry',
      probe: true,
      description: 'Probe: 新規は本文が空・CTA も無い（偽の行を出さない）',
      props: { bodyLines: 0, withPickleCta: false },
    },
    {
      id: 'long-body',
      probe: true,
      description: 'Probe: 本文が長くても CTA は最下段に残る',
      props: { bodyLines: 20, withPickleCta: true },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'cta-follows-props',
      description: 'withPickleCta のときだけ CTA 枠を描く（新規エントリには CTA が無い）',
      check: ({ root, props }) => {
        const has = Boolean(root.querySelector('[data-skeleton-slot="pickle-cta"]'));
        return has === Boolean(props.withPickleCta) || `CTA 枠の有無が props と不一致: has=${has}`;
      },
    },
    {
      id: 'body-lines-match',
      description: '本文の行枠の数が指定どおり（新規=0 で偽の本文を出さない）',
      check: ({ root, props }) => {
        const body = root.querySelector('[data-skeleton-slot="body"]');
        const expected = props.bodyLines ?? 4;
        const actual = body?.childElementCount ?? -1;
        return actual === expected || `本文の行数が不一致: ${actual} (期待: ${expected})`;
      },
    },
  ],
});
