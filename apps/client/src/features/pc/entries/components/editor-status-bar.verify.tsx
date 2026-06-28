/**
 * EditorStatusBar の検証スペック（A 移植 pilot #1）。
 * i18n 依存の純表示部品を、withVerifyProviders（NextIntlClientProvider）で孤立検証できる実証。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { type EditorStatus, EditorStatusBar } from './editor-status-bar';

interface Props {
  status: EditorStatus;
  charCount: number;
}

registerUnit<Props>({
  id: 'EditorStatusBar',
  title: 'EditorStatusBar',
  description: 'エディタ下部のステータスバー（保存状態 + 文字数バー）',
  kind: 'component',
  render: (props) => withVerifyProviders(<EditorStatusBar {...props} />),
  fixtures: [
    { id: 'editing', description: '編集中', props: { status: 'editing', charCount: 120 } },
    { id: 'saved', description: '保存済み', props: { status: 'saved', charCount: 800 } },
    {
      id: 'saving',
      description: '保存中（in-flight）',
      props: { status: 'saving', charCount: 1500 },
    },
    {
      id: 'overflow',
      probe: true,
      description: 'Probe: 2000字超でもバーは100%で頭打ち（レイアウト崩れない）',
      props: { status: 'saved', charCount: 8000 },
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
  ],
});
