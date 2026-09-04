/**
 * SpElementSheet の検証スペック（円の中の要素を読むボトムシート）。
 *
 * 完全に props だけの presentational な部品。要素の種類（言葉 / 抜粋 / 手紙）で
 * 中身が切り替わる判別共用体なので、3 種すべてを fixture にして
 * 「その種類にだけ出るもの」（手紙の返信ボタン等）が漏れないことを固定する。
 *
 * i18n（sp.jar）依存のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpElementSheet, type SpJarElement } from './sp-element-sheet';

interface Props {
  element: SpJarElement;
  onClose: () => void;
  onReply: () => void;
  onOpenSource: (entryId: string) => void;
}

const noop = () => {};

const keyword: SpJarElement = {
  kind: 'keyword',
  id: 'k-1',
  keyword: '感謝',
  description: '小さなことに気づく力。',
};

const snippet: SpJarElement = {
  kind: 'snippet',
  id: 's-1',
  originalText: '朝の光がきれいだった',
  sourceDate: '2026-06-18T00:00:00.000Z',
  selectionReason: '同じ光景が三度出てくる。',
};

const letter: SpJarElement = {
  kind: 'letter',
  id: 'l-1',
  bodyText: 'あなたの言葉から、静かな喜びが立ち上っています。',
  sources: [
    { id: 'e-1', title: '朝の光', createdAt: '2026-06-18T00:00:00.000Z' },
    { id: 'e-2', title: '', createdAt: '2026-06-19T00:00:00.000Z' },
  ],
};

registerUnit<Props>({
  id: 'SpElementSheet',
  title: 'SpElementSheet',
  description: '円の中の要素（言葉・抜粋・手紙）の中身を読むボトムシート。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '640px' }}>
        <SpElementSheet {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'keyword',
      description: '言葉（keyword ＋ 意味）',
      props: { element: keyword, onClose: noop, onReply: noop, onOpenSource: noop },
    },
    {
      id: 'snippet',
      description: '抜粋（本文 ＋ 日付 ＋ 選ばれた理由）',
      props: { element: snippet, onClose: noop, onReply: noop, onOpenSource: noop },
    },
    {
      id: 'letter',
      description: '手紙（本文 ＋ もとになった記録 ＋ 返事を書く）',
      props: { element: letter, onClose: noop, onReply: noop, onOpenSource: noop },
    },
    {
      id: 'letter-without-sources',
      probe: true,
      description: 'Probe: もとになった記録が無ければ見出しごと出さない',
      props: {
        element: { ...letter, sources: [] },
        onClose: noop,
        onReply: noop,
        onOpenSource: noop,
      },
    },
    {
      id: 'keyword-without-description',
      probe: true,
      description: 'Probe: 意味が空の言葉でも見出しだけで成立する',
      props: {
        element: { ...keyword, description: '' },
        onClose: noop,
        onReply: noop,
        onOpenSource: noop,
      },
    },
    {
      id: 'empty-letter',
      probe: true,
      description: 'Probe: 本文が空の手紙は「まだ手紙がありません」に倒す（空白にしない）',
      props: {
        element: { ...letter, bodyText: '', sources: [] },
        onClose: noop,
        onReply: noop,
        onOpenSource: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'kind-matches-contract',
      description: '契約が要素の種類を名乗る',
      check: ({ contract, props }) =>
        contract.kind === props.element.kind ||
        `contract.kind="${contract.kind}" だが element.kind="${props.element.kind}"`,
    },
    {
      id: 'reply-only-for-letters',
      description: '「返事を書く」は手紙のときだけ出す（言葉や抜粋に返事はしない）',
      check: ({ root, contract }) => {
        const hasReply = (root.textContent ?? '').includes('返事を書く');
        return (
          hasReply === (contract.kind === 'letter') ||
          `返事ボタン=${hasReply} だが kind="${contract.kind}"`
        );
      },
    },
    {
      id: 'sources-only-when-present',
      description: 'もとになった記録は在るときだけ見出しごと出す',
      onlyFixtures: ['letter', 'letter-without-sources'],
      check: ({ root, props }) => {
        const shown = (root.textContent ?? '').includes('もとになった記録');
        const expected = props.element.kind === 'letter' && props.element.sources.length > 0;
        return shown === expected || `見出し=${shown}（期待: ${expected}）`;
      },
    },
    {
      id: 'untitled-source-still-openable',
      description: '見出しの無い記録も名前を補って開ける（開けなくならないように）',
      onlyFixtures: ['letter'],
      check: ({ root }) => {
        const shown = (root.textContent ?? '').includes('無題の記録');
        return shown || '見出しの無い記録が空のボタンになっている';
      },
    },
    {
      id: 'empty-letter-says-so',
      description: '本文が空でも空白にしない',
      onlyFixtures: ['empty-letter'],
      check: ({ root }) => {
        const shown = (root.textContent ?? '').includes('まだ手紙がありません');
        return shown || '本文が空のとき、何も書かれていない面になっている';
      },
    },
    {
      id: 'dismissable',
      description: '閉じる道が2つある（ボタンと背景）。片方しか無いと戻れなくなる',
      check: ({ root }) => {
        const buttons = Array.from(root.querySelectorAll('button')).filter(
          (b) => b.textContent?.includes('閉じる') || b.getAttribute('aria-label') === '閉じる',
        );
        return buttons.length >= 2 || `閉じる道が ${buttons.length} 本しかない`;
      },
    },
  ],
});
