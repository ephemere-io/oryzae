/**
 * SpSnippetSheet の検証スペック（スニペットを書く／直すシート）。
 *
 * props だけの presentational な部品。守るのは「**空では保存させない**」「上限を超えたら
 * 保存させない」「保存中・読み取り中は閉じさせない」の 3 つ。どれも押せてしまうと、失敗が
 * 盤面に出ないまま黙って何も起きない（ボードには専用のエラー表示が無い）。
 *
 * i18n（sp.board / board.snippet_dialog）依存のため withVerifyProviders で包む。
 */

import { MAX_SNIPPET_TEXT_LENGTH } from '@oryzae/shared';
import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { type SpSnippetOcrStatus, SpSnippetSheet } from './sp-snippet-sheet';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialText?: string;
  saving?: boolean;
  ocrStatus?: SpSnippetOcrStatus;
  fromImage?: boolean;
  onPickImage?: () => void;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

const noop = () => {};
const ACTIONS = { onSubmit: noop, onClose: noop, onPickImage: noop };

registerUnit<Props>({
  id: 'SpSnippetSheet',
  title: 'SpSnippetSheet',
  description: 'スニペットの本文を書く／直す下からのシート（画像からの読み取りつき）。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '640px' }}>
        <SpSnippetSheet {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'create',
      description: '新しく書く（空なので保存は押せない。画像から読み取る口がある）',
      props: { open: true, mode: 'create', ...ACTIONS },
    },
    {
      id: 'edit',
      description: '既にある本文を直す（読み取りの口は出さない）',
      props: { open: true, mode: 'edit', initialText: '朝の光がきれいだった', ...ACTIONS },
    },
    {
      id: 'saving',
      probe: true,
      description: 'Probe: 保存中は閉じさせない・二重に送らせない',
      props: {
        open: true,
        mode: 'edit',
        initialText: '朝の光がきれいだった',
        saving: true,
        ...ACTIONS,
      },
    },
    {
      id: 'too-long',
      probe: true,
      description: 'Probe: 上限を超えたら保存させない（サーバーに弾かせない）',
      props: {
        open: true,
        mode: 'edit',
        initialText: 'あ'.repeat(MAX_SNIPPET_TEXT_LENGTH + 1),
        ...ACTIONS,
      },
    },
    {
      id: 'reading',
      probe: true,
      description: 'Probe: 読み取り中は保存も閉じるも押せない（結果が分からなくなる）',
      props: { open: true, mode: 'create', ocrStatus: 'reading', ...ACTIONS },
    },
    {
      id: 'from-image',
      probe: true,
      description: 'Probe: 読み取った本文は欄に載り、誤りが混じりうる旨を添える',
      props: {
        open: true,
        mode: 'create',
        initialText: '読み取った文字',
        fromImage: true,
        ...ACTIONS,
      },
    },
    {
      id: 'ocr-failed',
      probe: true,
      description: 'Probe: 読み取れなかったら理由を出し、もう一度選べる',
      props: { open: true, mode: 'create', ocrStatus: 'failed', ...ACTIONS },
    },
  ],
  invariants: [
    {
      id: 'submit-blocked-when-unusable',
      description: '空・長すぎ・保存中・読み取り中は保存を押せない',
      check: ({ root, contract }) => {
        const save = [...root.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('保存'),
        );
        if (!save) return '保存ボタンが無い';
        const blocked =
          contract.empty === 'true' ||
          contract.tooLong === 'true' ||
          contract.saving === 'true' ||
          contract.ocrStatus === 'reading';
        return (
          save.disabled === blocked ||
          `disabled=${save.disabled} だが empty=${contract.empty} tooLong=${contract.tooLong} saving=${contract.saving} ocr=${contract.ocrStatus}`
        );
      },
    },
    {
      id: 'cannot-close-while-busy',
      description: '保存中・読み取り中は閉じられない（途中で消えると結果が分からない）',
      onlyFixtures: ['saving', 'reading'],
      check: ({ root }) => {
        const cancel = [...root.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('キャンセル'),
        );
        return cancel?.disabled === true || '保存中・読み取り中なのにキャンセルが押せる';
      },
    },
    {
      id: 'counter-only-near-limit',
      description: '文字数は上限が近いときだけ数える',
      onlyFixtures: ['create', 'edit'],
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return !text.includes(String(MAX_SNIPPET_TEXT_LENGTH)) || '短い本文で上限を数えている';
      },
    },
    {
      id: 'edit-starts-from-existing-text',
      description: '直すときは元の本文から始まる',
      onlyFixtures: ['edit'],
      check: ({ root }) => {
        const area = root.querySelector('textarea');
        return (
          area?.value === '朝の光がきれいだった' || `本文が入っていない: "${area?.value ?? ''}"`
        );
      },
    },
    {
      id: 'ocr-only-when-creating',
      description: '画像から読み取る口は新しく作るときだけ（直すときは本文が主役）',
      check: ({ root, contract }) => {
        const trigger = root.querySelector('[data-ocr-trigger]') !== null;
        return (
          trigger === (contract.mode === 'create') ||
          `読み取りの口=${trigger} だが mode=${contract.mode}`
        );
      },
    },
    {
      id: 'from-image-carries-a-caveat',
      description: '読み取った本文には「誤りが混じることがある」を添える',
      onlyFixtures: ['from-image'],
      check: ({ root }) => {
        const area = root.querySelector('textarea');
        if (area?.value !== '読み取った文字') return '読み取った本文が欄に載っていない';
        return (root.textContent ?? '').includes('読み取りました') || '注意書きが無い';
      },
    },
    {
      id: 'failure-offers-retry',
      description: '読み取れなかったら理由と、もう一度選ぶ口を出す',
      onlyFixtures: ['ocr-failed'],
      check: ({ root }) => {
        const text = root.textContent ?? '';
        if (!text.includes('失敗')) return '失敗の理由が出ていない';
        return text.includes('もう一度') || 'もう一度選ぶ口が無い';
      },
    },
  ],
});
