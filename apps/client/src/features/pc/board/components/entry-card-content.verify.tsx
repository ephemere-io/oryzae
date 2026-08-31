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
  preview: string;
  createdAt: string;
}

interface Props {
  content: Content;
  editing?: boolean;
  editValue?: string;
  onEditChange?: (next: string) => void;
  editLoading?: boolean;
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
          preview: '今日は早起きして散歩に出かけた。空気が澄んでいて気持ちよかった。',
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
          preview: 'タイトルを付けずに書き始めたメモ。',
          createdAt: '2026-05-01',
        },
      },
    },
    {
      id: 'editing',
      probe: true,
      description: 'Probe: カード上の編集中は、抜粋ではなく全文が編集欄に出る',
      props: {
        content: {
          title: '朝のジャーナル',
          preview: '今日は早起きして散歩に出かけた。',
          createdAt: '2026-06-27',
        },
        editing: true,
        // 抜粋（preview）より長い＝カードが持っている文字列ではないことを示す
        editValue: `今日は早起きして散歩に出かけた。${'続きの本文。'.repeat(30)}`,
      },
    },
    {
      id: 'editing-loading',
      probe: true,
      description: 'Probe: 全文が届くまでは編集欄を触らせない',
      props: {
        content: {
          title: '朝のジャーナル',
          preview: '今日は早起きして散歩に出かけた。',
          createdAt: '2026-06-27',
        },
        editing: true,
        editValue: '',
        editLoading: true,
      },
    },
    {
      id: 'empty-content',
      probe: true,
      description: 'Probe: タイトル・本文が空でも日付は描画されレイアウトが崩れない',
      props: {
        content: { title: '', preview: '', createdAt: '2026-01-15' },
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
      description: '編集に入っても見出しは消えず、打っている1行目に追従する',
      // 消えるとカードがどれだか分からなくなる、という指摘への回帰止め。
      check: ({ root, props }) => {
        if (!props.editing || props.editLoading) return true;
        const heading = root.querySelector('h3')?.textContent?.trim() ?? '';
        const expected = (props.editValue ?? '').split('\n').find((l) => l.trim().length > 0) ?? '';
        if (!expected) return true;
        return (
          heading === expected.trim() ||
          `編集中の見出しが本文の1行目と違う: heading="${heading}" expected="${expected.trim()}"`
        );
      },
    },
    {
      id: 'editor-iff-editing',
      description: '編集欄は editing のときだけ出て、そのときは抜粋を出さない',
      check: ({ root, contract }) => {
        const editor = root.querySelector('textarea[data-verify-entry-editor]');
        const editing = contract.editing === 'true';
        if (editing && !editor) return '編集中なのに編集欄が無い';
        if (!editing && editor) return '編集していないのに編集欄がある';
        return true;
      },
    },
    {
      id: 'editor-shows-full-text-not-preview',
      description: '編集欄に入るのは渡された全文（カードの抜粋ではない）',
      // 抜粋を編集させて保存すると、日記が先頭 200 文字へ切り詰められる。
      // 「編集欄の中身 = editValue」を契約として固定しておく。
      check: ({ root, props }) => {
        if (!props.editing || props.editLoading) return true;
        const editor = root.querySelector<HTMLTextAreaElement>(
          'textarea[data-verify-entry-editor]',
        );
        if (!editor) return '編集欄が無い';
        return (
          editor.value === (props.editValue ?? '') ||
          `編集欄の中身が editValue と違う（抜粋が入っている可能性）: "${editor.value.slice(0, 40)}"`
        );
      },
    },
    {
      id: 'editor-disabled-until-loaded',
      description: '全文が届くまで編集欄は触れない（抜粋のまま保存させない）',
      check: ({ root, contract }) => {
        if (contract.editLoading !== 'true') return true;
        const editor = root.querySelector<HTMLTextAreaElement>(
          'textarea[data-verify-entry-editor]',
        );
        return editor?.disabled === true || '読み込み中なのに編集欄が触れる';
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
