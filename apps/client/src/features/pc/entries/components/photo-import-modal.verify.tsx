/**
 * PhotoImportModal の検証スペック。
 *
 * 状態は usePhotoImport が持ち、このモーダルは props を映すだけなので、内部 state 遷移は
 * 持たない。よって act fixture ではなく「state の組み合わせ × invariant」で検証する。
 *
 * ここで固定したい契約は 2 つ:
 *  1. 文字起こし結果が出ている間は「本文に入れる」導線だけを見せる（写真として貼る導線は消す）。
 *  2. 通信中はキャンセルを含む全ボタンを止める — 二重送信は実費に直結する。
 */

import { registerUnit } from '@oryzae/verify';
import type { PhotoImportState } from '@/features/shared/entries/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { PhotoImportModal } from './photo-import-modal';

interface Props {
  state: PhotoImportState;
  onTranscribe: () => void;
  onAttach: () => void;
  onInsertTranscript: () => void;
  onDiscardTranscript: () => void;
  onClose: () => void;
}

const noop = () => {};

const callbacks = {
  onTranscribe: noop,
  onAttach: noop,
  onInsertTranscript: noop,
  onDiscardTranscript: noop,
  onClose: noop,
};

// 孤立検証では実ファイルを読めないので、プレビューは 1x1 の data URI で代用する。
const PREVIEW = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function state(overrides: Partial<PhotoImportState>): PhotoImportState {
  return {
    open: true,
    fileName: 'note.jpg',
    previewUrl: PREVIEW,
    status: 'idle',
    error: '',
    transcript: null,
    ...overrides,
  };
}

registerUnit<Props>({
  id: 'PhotoImportModal',
  title: 'PhotoImportModal',
  description: '写真を「文字として読み込む」か「写真として貼る」か選ばせるモーダル（PC・純表示）',
  kind: 'component',
  render: (props) => withVerifyProviders(<PhotoImportModal {...props} />),
  fixtures: [
    {
      id: 'preview',
      description: 'プレビュー表示（取り込み方を選ぶ）',
      props: { state: state({}), ...callbacks },
    },
    {
      id: 'transcribing',
      description: '文字起こし中（全ボタン停止）',
      props: { state: state({ status: 'transcribing' }), ...callbacks },
    },
    {
      id: 'transcript',
      description: '文字起こし結果の確認',
      props: {
        state: state({ transcript: '今日は雨だった。\n傘を持たずに出て、少し濡れた。' }),
        ...callbacks,
      },
    },
    {
      id: 'transcript-empty',
      probe: true,
      description: 'Probe: 文字が写っていなかった場合（空文字）でも挿入させない',
      props: { state: state({ transcript: '' }), ...callbacks },
    },
    {
      id: 'error',
      probe: true,
      description: 'Probe: エラー表示（レート制限など）でも操作導線が残る',
      props: { state: state({ error: '時間をおいてからもう一度お試しください。' }), ...callbacks },
    },
    {
      id: 'long-transcript',
      probe: true,
      description: 'Probe: 長い文字起こし結果でもレイアウトが崩れない',
      props: {
        state: state({ transcript: 'あ'.repeat(400).replace(/(.{40})/g, '$1\n') }),
        ...callbacks,
      },
    },
  ],
  // open=false の fixture は持たない。PC のモーダルは閉じているとき null を返す作りで
  // （pickle-confirm-modal 等と同じ）、DOM 契約そのものが出ないため孤立検証に乗らない。
  invariants: [
    {
      id: 'busy-disables-every-button',
      description: '通信中は全ボタンが disabled（二重送信は実費に直結する）',
      check: ({ root, contract }) => {
        if (contract.status === 'idle') return true;
        const buttons = Array.from(root.querySelectorAll('button'));
        if (buttons.length === 0) return 'ボタンが見つからない';
        const enabled = buttons.filter((b) => !b.disabled);
        return (
          enabled.length === 0 ||
          `status=${contract.status} なのに ${enabled.length} 個のボタンが有効なまま`
        );
      },
    },
    {
      id: 'transcript-hides-attach',
      description: '文字起こし結果の確認中は「写真として貼る」導線を出さない',
      check: ({ root, contract, props }) => {
        if (contract.hasTranscript !== 'true') return true;
        const labels = Array.from(root.querySelectorAll('button')).map((b) => b.textContent ?? '');
        const attachShown = labels.some((label) => label === '写真として貼る');
        return (
          (!attachShown && labels.length === 2) ||
          `結果確認中のボタンが想定外: ${JSON.stringify(labels)} (transcript=${JSON.stringify(props.state.transcript)})`
        );
      },
    },
    {
      id: 'empty-transcript-blocks-insert',
      description: '文字が取れなかったときは「本文に入れる」を押せない',
      check: ({ root, props }) => {
        if (props.state.transcript !== '') return true;
        const buttons = Array.from(root.querySelectorAll('button'));
        const insert = buttons[buttons.length - 1];
        if (!insert) return '挿入ボタンが見つからない';
        return insert.disabled || '空の文字起こし結果なのに挿入ボタンが有効';
      },
    },
    {
      id: 'error-is-visible',
      description: 'error 契約が立っていればエラー文言が実際に描画される',
      check: ({ root, contract, props }) => {
        if (contract.hasError !== 'true') return true;
        return (
          Boolean(root.textContent?.includes(props.state.error)) ||
          'hasError=true なのにエラー文言が描画されていない'
        );
      },
    },
  ],
});
