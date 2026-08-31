/**
 * EntryCardContent の検証スペック（A 移植）。
 * ボードカードに載る純表示部品（タイトル・プレビュー・日付）。props だけで孤立描画でき、
 * router / データ取得 / Selection API に依存しない。title の有無を契約として公表し、
 * 「h3 の有無が hasTitle 契約と一致」「整形済み日付が DOM に出る」を契約↔DOM で検証する。
 * i18n（useTranslations）は使わないが、テンプレ統一のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { EntryCardContent } from './entry-card-content';

interface Content {
  title: string;
  body: string;
  createdAt: string;
}

interface Props {
  content: Content;
  editing?: boolean;
  editTitle?: string;
  editBody?: string;
  onEditTitleChange?: (next: string) => void;
  onEditBodyChange?: (next: string) => void;
}

registerUnit<Props>({
  id: 'EntryCardContent',
  title: 'EntryCardContent',
  description: 'ボードカードのエントリ表示内容（タイトル・プレビュー・日付）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryCardContent {...props} />),
  fixtures: [
    {
      id: 'with-title',
      description: 'タイトルあり（通常表示）',
      props: {
        content: {
          title: '朝のジャーナル',
          body: '今日は早起きして散歩に出かけた。空気が澄んでいて気持ちよかった。',
          createdAt: '2026-06-27',
        },
      },
    },
    {
      id: 'no-title',
      description: 'タイトルなし（見出しを描画しない）',
      props: {
        content: {
          title: '',
          body: 'タイトルを付けずに書き始めたメモ。',
          createdAt: '2026-05-01',
        },
      },
    },
    {
      id: 'editing',
      probe: true,
      description: 'Probe: 編集中も表示中と同じ中身・同じ配置（取り直しは無い）',
      props: {
        content: {
          title: '朝のジャーナル',
          body: '今日は早起きして散歩に出かけた。空気が澄んでいて気持ちよかった。',
          createdAt: '2026-06-27',
        },
        editing: true,
        editTitle: '朝のジャーナル',
        editBody: '今日は早起きして散歩に出かけた。空気が澄んでいて気持ちよかった。',
      },
    },
    {
      id: 'empty-content',
      probe: true,
      description: 'Probe: タイトル・本文が空でも日付は描画されレイアウトが崩れない',
      props: {
        content: { title: '', body: '', createdAt: '2026-01-15' },
      },
    },
  ],
  invariants: [
    {
      id: 'h3-iff-has-title',
      description: '表示中は、h3（タイトル見出し）の有無が hasTitle 契約と一致する',
      check: ({ root, contract }) => {
        // 編集中は見出しを出さない（カードの全面を編集欄に使う）ので対象外。
        if (contract.editing === 'true') return true;
        const hasHeading = root.querySelector('h3') !== null;
        const expectTitle = contract.hasTitle === 'true';
        return (
          hasHeading === expectTitle ||
          `h3 present=${hasHeading} だが contract.hasTitle="${contract.hasTitle}"`
        );
      },
    },
    {
      id: 'formatted-date-rendered',
      description: '整形済み日付（contract.formattedDate）が DOM テキストに描画される',
      check: ({ root, contract }) =>
        Boolean(contract.formattedDate && root.textContent?.includes(contract.formattedDate)) ||
        `整形済み日付 "${contract.formattedDate}" が描画されていない`,
    },
    {
      id: 'heading-survives-editing',
      description: '編集に入っても見出しは消えず、直せる入力欄になる',
      check: ({ root, props }) => {
        if (!props.editing) return true;
        const input = root.querySelector<HTMLInputElement>('[data-verify-entry-title-editor]');
        if (!input) return '編集中に見出しの入力欄が無い（消えている）';
        return (
          input.value === (props.editTitle ?? '') ||
          `見出しの入力欄が editTitle と違う: "${input.value}"`
        );
      },
    },
    {
      id: 'title-not-duplicated-while-editing',
      description: '編集中に見出しが二重に出ない（h3 と入力欄が並ばない）',
      // 見出しを h3 のまま出しつつ本文の全文を編集欄に入れていた頃、1行目が
      // 二度見えていた。見出しは入力欄に「置き換わる」のが正しい。
      check: ({ root, props }) => {
        if (!props.editing) return true;
        return root.querySelector('h3') === null || '編集中なのに h3 が残っている（二重表示）';
      },
    },
    {
      id: 'editor-iff-editing',
      description: '本文の編集欄は editing のときだけ出て、そのときは表示用の段落を出さない',
      check: ({ root, contract }) => {
        const editor = root.querySelector('textarea[data-verify-entry-editor]');
        const shown = root.querySelector('p');
        const editing = contract.editing === 'true';
        if (editing && !editor) return '編集中なのに編集欄が無い';
        if (!editing && editor) return '編集していないのに編集欄がある';
        if (editing && shown) return '編集中なのに表示用の段落も出ている';
        return true;
      },
    },
    {
      id: 'edit-shows-what-is-displayed',
      description: '編集欄の中身が、表示していた本文と同じ（取り直しで食い違わない）',
      check: ({ root, props }) => {
        if (!props.editing) return true;
        const editor = root.querySelector<HTMLTextAreaElement>(
          'textarea[data-verify-entry-editor]',
        );
        if (!editor) return '編集欄が無い';
        return (
          editor.value === (props.editBody ?? '') ||
          `編集欄の中身が editBody と違う: "${editor.value.slice(0, 40)}"`
        );
      },
    },
    {
      id: 'self-identifies',
      description: '契約が EntryCardContent として自己同定する',
      check: ({ contract }) =>
        contract.unit === 'EntryCardContent' || `unit 契約不一致: contract.unit="${contract.unit}"`,
    },
  ],
});
