/**
 * PhotoDialog の検証スペック（A 移植）。
 * open=true で描画される写真アップロードのモーダル。i18n（board.photo_dialog）は
 * withVerifyProviders（NextIntlClientProvider）が供給する。
 *
 * uploading / hasPreview は File/Image/canvas を駆動して初めて到達する内部状態で、
 * jsdom では描画不能。よって到達可能な fixture は open=true の初期状態のみ。
 * バリエーションは props ではなく act（キャプション入力）で作る。
 * canSubmit を契約として公表し「送信ゲートはファイル選択依存（キャプションでは開かない）」を
 * probe で検証する。submit/picker クリックは画像 API に到達するため act では踏まない。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { PhotoDialog } from './photo-dialog';

interface Props {
  open: boolean;
  onSubmit: (file: File, caption: string, imageWidth: number, imageHeight: number) => Promise<void>;
  onClose: () => void;
}

const noop = () => {};
const asyncNoop = () => Promise.resolve();

registerUnit<Props>({
  id: 'PhotoDialog',
  title: 'PhotoDialog',
  description: '写真アップロードのモーダル（送信はファイル選択後のみ有効）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<PhotoDialog {...props} />),
  fixtures: [
    {
      id: 'open',
      description: '開いている（ファイル未選択・送信不可）',
      props: { open: true, onSubmit: asyncNoop, onClose: noop },
    },
    {
      id: 'caption-typed',
      probe: true,
      description: 'Probe: キャプションを入力しても、ファイル未選択なら送信は不可のまま',
      props: { open: true, onSubmit: asyncNoop, onClose: noop },
      act: async (ctx) => {
        await ctx.type('input[type="text"]', 'こんにちは');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'dialog-semantics',
      description: 'role="dialog" かつ aria-label を持つモーダルとして描画される',
      check: ({ root }) => {
        const dialog = root.querySelector('[data-verify-unit="PhotoDialog"]');
        const isDialog = dialog?.getAttribute('role') === 'dialog';
        const hasLabel = Boolean(dialog?.getAttribute('aria-label'));
        return (
          (isDialog && hasLabel) ||
          `dialog semantics 欠落: role=${dialog?.getAttribute('role')}, aria-label=${dialog?.getAttribute('aria-label')}`
        );
      },
    },
    {
      id: 'submit-disabled-matches-cansubmit',
      description: '送信ボタンの disabled は契約 canSubmit と一致する',
      check: ({ root, contract }) => {
        const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (!submit) return 'submit ボタンが見つからない';
        const expectedDisabled = contract.canSubmit === 'false';
        return (
          submit.disabled === expectedDisabled ||
          `submit.disabled=${submit.disabled} だが contract.canSubmit="${contract.canSubmit}"`
        );
      },
    },
    {
      id: 'submit-gated-by-file-not-caption',
      description: 'ファイル未選択なら送信不可（キャプション入力では開かない）',
      check: ({ root, contract }) => {
        const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        return (
          (contract.canSubmit === 'false' && submit?.disabled === true) ||
          `ファイル未選択なのに送信可能: canSubmit="${contract.canSubmit}", submit.disabled=${submit?.disabled}`
        );
      },
    },
    {
      id: 'cancel-and-picker-enabled-when-idle',
      description: 'アップロード中でなければキャンセル・写真選択ボタンは操作可能',
      check: ({ root, contract }) => {
        if (contract.uploading !== 'false') return true;
        const nonSubmit = Array.from(root.querySelectorAll('button')).filter(
          (b) => b.type !== 'submit',
        );
        return (
          (nonSubmit.length >= 2 && nonSubmit.every((b) => !b.disabled)) ||
          `idle なのに非送信ボタンが無効: count=${nonSubmit.length}, disabled=[${nonSubmit
            .map((b) => b.disabled)
            .join(',')}]`
        );
      },
    },
    {
      id: 'error-is-visible-when-set',
      description: 'error 契約が立っているとき、その理由が画面にも出ている',
      // 注意: 現状この分岐は **踏まれない**。error は画像のデコード失敗で立つが、
      // jsdom は画像を復号せず Image の onload も onerror も発火しないため、
      // 孤立描画では到達できない。将来 error を props で注入できるようにしたら
      // 効き始める。実際の詰み経路を守っているのは下の no-submit-without-file。
      check: ({ root, contract }) => {
        if (contract.error === 'none') return true;
        const shown = Array.from(root.querySelectorAll('p')).some(
          (p) => (p.textContent ?? '').trim().length > 0,
        );
        return shown || `error="${contract.error}" なのに画面に何も出ていない`;
      },
    },
    {
      id: 'no-submit-without-file',
      description: '画像が無いあいだは送信できない（デコードできない画像を選んだ後もここに戻る）',
      check: ({ root, contract }) => {
        if (contract.hasPreview === 'true') return true;
        const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (!submit) return 'submit ボタンが見つからない';
        return (
          submit.disabled ||
          'プレビューが無いのに送信できてしまう（開けない画像で固まる経路になる）'
        );
      },
    },
  ],
});
