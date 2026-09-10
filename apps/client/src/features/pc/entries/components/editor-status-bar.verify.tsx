/**
 * EditorStatusBar の検証スペック。
 *
 * 画面幅いっぱいの帯（保存状態＋文字数＋「あと何字」）をやめ、**左下の小さな処理表示**に
 * 作り直した。文字数と漬け込みの目安は、書いている最中に読む必要が無いので消してある
 * （漬け込みの条件はパレットのボタンの活性/非活性とツールチップが伝える）。
 *
 * ここで見張るのは「裏で起きていることだけを、起きているときだけ出す」という契約。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { type EditorStatus, EditorStatusBar } from './editor-status-bar';

interface Props {
  status: EditorStatus;
  lastSavedAt?: number | null;
}

/** 固定の基準時刻（Date.now() を使わず決定的にする）。 */
const T0 = Date.UTC(2026, 4, 1, 9, 0, 0);

registerUnit<Props>({
  id: 'EditorStatusBar',
  title: 'EditorStatusBar',
  description: '左下の処理表示（保存中／保存しました だけを、起きているときだけ出す）',
  kind: 'component',
  render: (props) => withVerifyProviders(<EditorStatusBar {...props} />),
  fixtures: [
    {
      id: 'idle',
      description: '編集中・未保存 — 何も出さない（無言が既定）',
      props: { status: 'editing', lastSavedAt: null },
    },
    {
      id: 'saving',
      description: '保存中（手動）',
      props: { status: 'saving', lastSavedAt: null },
    },
    {
      id: 'autosaving',
      description: '自動保存中',
      props: { status: 'autosaving', lastSavedAt: T0 },
    },
    {
      id: 'saved',
      description: '保存が終わった直後',
      props: { status: 'saved', lastSavedAt: T0 },
    },
    {
      id: 'saved-without-timestamp',
      probe: true,
      description: 'Probe: status=saved でも保存時刻が無ければ出さない（嘘をつかない）',
      props: { status: 'saved', lastSavedAt: null },
    },
    {
      id: 'editing-after-save',
      probe: true,
      description: 'Probe: 一度保存したあと編集を再開したら、また無言に戻る',
      props: { status: 'editing', lastSavedAt: T0 },
    },
  ],
  invariants: [
    {
      id: 'no-char-count',
      description: '文字数を出さない（書き手の判断が変わらない情報を常時出さない）',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return !/CHARS|\d+\s*字/.test(text) || `文字数らしき表示が残っている: "${text}"`;
      },
    },
    {
      id: 'inflight-contract',
      description: 'saving/autosaving のときだけ inFlight=true',
      check: ({ contract, props }) => {
        const expected = props.status === 'saving' || props.status === 'autosaving';
        return (
          contract.inFlight === String(expected) ||
          `inFlight 契約不一致: status=${props.status} → ${contract.inFlight}`
        );
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
      id: 'silent-unless-something-happens',
      description: '保存中でも保存直後でもなければ何も出さない',
      check: ({ contract, props }) => {
        const inFlight = props.status === 'saving' || props.status === 'autosaving';
        const showsSaved = props.status === 'saved' && (props.lastSavedAt ?? null) !== null;
        const expected = inFlight || showsSaved;
        return (
          contract.visible === String(expected) ||
          `visible=${contract.visible}, 期待=${expected}（status=${props.status}）`
        );
      },
    },
    {
      id: 'does-not-block-the-paper',
      description: '本文の上に置くので、クリックを吸わない',
      check: ({ root }) => {
        const el = root.querySelector('[data-verify-unit="EditorStatusBar"]');
        if (!el) return '契約要素が見つからない';
        return (
          el.className.includes('pointer-events-none') ||
          'pointer-events が生きている（本文のクリックを奪う）'
        );
      },
    },
  ],
});
