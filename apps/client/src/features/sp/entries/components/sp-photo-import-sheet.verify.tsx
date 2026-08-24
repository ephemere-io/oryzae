/**
 * SpPhotoImportSheet の検証スペック。
 *
 * PC の PhotoImportModal と同じ契約を、SP の bottom-sheet 表現で守れているかを見る。
 * 状態は usePhotoImport が持つので内部 state 遷移は無く、state の組み合わせ × invariant で検証する。
 *
 * SP 固有で固定したいのは「背景タップでの取消も通信中は止める」こと — シートを閉じても
 * 通信は飛んだままなので、実費のかかる文字起こし中に閉じられると挙動が読めなくなる。
 */

import { registerUnit } from '@oryzae/verify';
import type { PhotoImportState } from '@/features/shared/entries/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpPhotoImportSheet } from './sp-photo-import-sheet';

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
  id: 'SpPhotoImportSheet',
  title: 'SpPhotoImportSheet',
  description: '写真の取り込み方を選ぶボトムシート（SP・純表示）',
  kind: 'component',
  render: (props) => withVerifyProviders(<SpPhotoImportSheet {...props} />),
  fixtures: [
    {
      id: 'preview',
      description: 'プレビュー表示（取り込み方を選ぶ）',
      props: { state: state({}), ...callbacks },
    },
    {
      id: 'transcribing',
      description: '文字起こし中（背景タップ含め全て停止）',
      props: { state: state({ status: 'transcribing' }), ...callbacks },
    },
    {
      id: 'transcript',
      description: '文字起こし結果の確認',
      props: { state: state({ transcript: '今日は雨だった。' }), ...callbacks },
    },
    {
      id: 'transcript-empty',
      probe: true,
      description: 'Probe: 文字が写っていなかった場合は挿入させない',
      props: { state: state({ transcript: '' }), ...callbacks },
    },
    {
      id: 'closed',
      probe: true,
      description: 'Probe: open=false ではシート本体を描画しない',
      props: { state: state({ open: false }), ...callbacks },
    },
    {
      id: 'long-transcript',
      probe: true,
      description: 'Probe: 長い結果でもシートが画面を突き抜けない',
      props: {
        state: state({ transcript: 'あ'.repeat(400).replace(/(.{40})/g, '$1\n') }),
        ...callbacks,
      },
    },
  ],
  invariants: [
    {
      id: 'closed-renders-no-sheet',
      description: 'open=false ならシート本体を出さない（契約ルートだけ残る）',
      check: ({ root, contract }) => {
        if (contract.open === 'true') return true;
        return (
          root.querySelectorAll('button').length === 0 ||
          'open=false なのに操作ボタンが描画されている'
        );
      },
    },
    {
      id: 'busy-disables-every-button',
      description: '通信中は背景タップ（取消）も含め全ボタンが disabled',
      check: ({ root, contract }) => {
        if (contract.status === 'idle' || contract.open !== 'true') return true;
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
      description: '結果確認中は「写真として貼る」導線を出さない',
      // 背景タップ用のボタン（ラベル無し）が常に居るので、文言のあるものだけを数える。
      check: ({ root, contract }) => {
        if (contract.hasTranscript !== 'true') return true;
        const labels = Array.from(root.querySelectorAll('button'))
          .map((b) => b.textContent ?? '')
          .filter((label) => label.length > 0);
        return (
          (!labels.includes('写真として貼る') && labels.length === 2) ||
          `結果確認中のボタンが想定外: ${JSON.stringify(labels)}`
        );
      },
    },
    {
      id: 'empty-transcript-blocks-insert',
      description: '文字が取れなかったときは挿入ボタンを押せない',
      check: ({ root, props }) => {
        if (props.state.transcript !== '') return true;
        const insert = Array.from(root.querySelectorAll('button')).find(
          (b) => b.textContent === '本文に入れる',
        );
        if (!insert) return '挿入ボタンが見つからない';
        return insert.disabled || '空の文字起こし結果なのに挿入ボタンが有効';
      },
    },
  ],
});
