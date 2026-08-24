/**
 * EditorStatusBar の検証スペック（A 移植 pilot #1）。
 * i18n 依存の純表示部品を、withVerifyProviders（NextIntlClientProvider）で孤立検証できる実証。
 *
 * Issue #360 / #229 で 3カラム（保存状態 / 文字数ゲージ / 漬け込みまでの文脈）に再設計した。
 * 相対時刻は `lastSavedAt` を props で受けるので、固定値を渡せば決定的に検証できる。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { type EditorStatus, EditorStatusBar, PICKLE_HINT_CHARS } from './editor-status-bar';

interface Props {
  status: EditorStatus;
  charCount: number;
  lastSavedAt?: number | null;
  onCharCountClick?: () => void;
}

const noop = () => {};

/** 固定の基準時刻（相対時刻の描画を決定的にするため、Date.now() は使わない）。 */
const T0 = Date.UTC(2026, 4, 1, 9, 0, 0);

registerUnit<Props>({
  id: 'EditorStatusBar',
  title: 'EditorStatusBar',
  description: 'エディタ下部のステータスバー（保存状態 + 文字数バー + 漬け込みまでの文脈）',
  kind: 'component',
  render: (props) => withVerifyProviders(<EditorStatusBar {...props} />),
  fixtures: [
    {
      id: 'editing',
      description: '編集中・未保存（自動保存されることを告げる）',
      props: { status: 'editing', charCount: 120, lastSavedAt: null, onCharCountClick: noop },
    },
    {
      id: 'saved',
      description: '保存済み（相対時刻を出す）',
      props: { status: 'saved', charCount: 800, lastSavedAt: T0, onCharCountClick: noop },
    },
    {
      id: 'saving',
      description: '保存中（in-flight）',
      props: { status: 'saving', charCount: 1500, lastSavedAt: T0, onCharCountClick: noop },
    },
    {
      id: 'empty',
      description: '1文字も書いていない（右カラムは書き出しの案内）',
      props: { status: 'editing', charCount: 0, lastSavedAt: null, onCharCountClick: noop },
    },
    {
      id: 'overflow',
      probe: true,
      description: 'Probe: 2000字超でもバーは100%で頭打ち（レイアウト崩れない）',
      props: { status: 'saved', charCount: 8000, lastSavedAt: T0, onCharCountClick: noop },
    },
    {
      id: 'no-stats-handler',
      probe: true,
      description: 'Probe: onCharCountClick 未指定でも文字数は読め、ボタンは無効化される',
      props: { status: 'editing', charCount: 42, lastSavedAt: null },
    },
  ],
  invariants: [
    {
      id: 'charcount-rendered',
      description: '文字数が "<n> CHARS" として表示される',
      check: ({ root, props }) =>
        Boolean(root.textContent?.includes(`${props.charCount} CHARS`)) ||
        `"${props.charCount} CHARS" が描画されていない`,
    },
    {
      id: 'inflight-contract',
      description: 'saving/autosaving のときだけ inFlight=true',
      check: ({ contract, props }) => {
        const expected = props.status === 'saving' || props.status === 'autosaving';
        return (
          contract.inFlight === String(expected) ||
          `inFlight 契約不一致: status=${props.status} → contract.inFlight=${contract.inFlight}`
        );
      },
    },
    {
      id: 'fill-capped',
      description: 'バーの幅は 0〜100% に収まる（charCount 過大でも頭打ち）',
      check: ({ contract }) => {
        const pct = Number(contract.fillPct);
        return (pct >= 0 && pct <= 100) || `fillPct が 0〜100 の範囲外: ${contract.fillPct}`;
      },
    },
    {
      id: 'ever-saved-contract',
      description: 'everSaved 契約が lastSavedAt の有無と一致する',
      check: ({ contract, props }) => {
        const expected = (props.lastSavedAt ?? null) !== null;
        return (
          contract.everSaved === String(expected) ||
          `everSaved=${contract.everSaved}, 期待=${expected}`
        );
      },
    },
    {
      id: 'context-column-never-empty',
      description: '右カラム（漬け込みまでの文脈）が常に何かを語る（空白の帯にしない）',
      check: ({ root }) => {
        const columns = root.querySelectorAll('[data-verify-unit="EditorStatusBar"] > *');
        const last = columns[columns.length - 1];
        const text = last?.textContent?.trim() ?? '';
        return text.length > 0 || '右カラムが空（#360 の「何のための帯か分からない」に戻っている）';
      },
    },
    {
      id: 'stats-button-disabled-without-handler',
      description: 'onCharCountClick が無いときは文字数ボタンが disabled になる',
      check: ({ root, props }) => {
        const button = root.querySelector('button');
        if (!button) return '文字数ボタンが見つからない';
        const expected = !props.onCharCountClick;
        const isDisabled = button.hasAttribute('disabled');
        return isDisabled === expected || `disabled=${isDisabled}, 期待=${expected}`;
      },
    },
    {
      id: 'gauge-threshold-consistent',
      description: 'fillPct が PICKLE_HINT_CHARS を基準に算出されている',
      check: ({ contract, props }) => {
        const expected = Math.min(100, (props.charCount / PICKLE_HINT_CHARS) * 100);
        return (
          Math.abs(Number(contract.fillPct) - expected) < 0.001 ||
          `fillPct=${contract.fillPct}, 期待=${expected}`
        );
      },
    },
  ],
});
