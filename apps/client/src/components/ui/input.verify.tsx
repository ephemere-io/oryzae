/**
 * Input の検証スペック。
 *
 * 見るのは面の契約だけ: 名前（読み上げ）がある、`md` は指の高さで 16px の字（iOS が拡大しない）、
 * `Select` と同じ面の class を使っている。
 */

import { registerUnit } from '@oryzae/verify';
import { Input } from './input';
import { FIELD_CLASS, type FieldSize } from './surface';

interface Props {
  value: string;
  size: FieldSize;
  placeholder: string;
}

registerUnit<Props>({
  id: 'Input',
  title: 'Input',
  description: '1 行の入力欄（Select と同じ面）',
  kind: 'component',
  render: (props) => (
    <div style={{ width: '320px' }}>
      <Input
        value={props.value}
        onChange={() => {}}
        ariaLabel="本文を検索"
        placeholder={props.placeholder}
        size={props.size}
      />
    </div>
  ),
  fixtures: [
    {
      id: 'md-empty',
      description: 'md・空（プレースホルダー）',
      props: { value: '', size: 'md', placeholder: '本文を検索' },
    },
    {
      id: 'md-filled',
      description: 'md・入力あり',
      props: { value: '朝の光', size: 'md', placeholder: '本文を検索' },
    },
    {
      id: 'sm',
      description: 'sm（PC の詰めた面）',
      props: { value: '', size: 'sm', placeholder: '検索' },
    },
    {
      id: 'focus',
      probe: true,
      description: 'Probe: 押すとフォーカスが入る',
      props: { value: '', size: 'md', placeholder: '本文を検索' },
      act: async (ctx) => {
        await ctx.click('input');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'labeled',
      description: '名前（aria-label）がある',
      check: ({ root }) =>
        Boolean(root.querySelector('input')?.getAttribute('aria-label')) || '名前が無い',
    },
    {
      id: 'shares-field-face',
      description: 'Select と同じ面の class（FIELD_CLASS）を使う',
      check: ({ root, contract }) => {
        const input = root.querySelector('input');
        const size: FieldSize = contract.size === 'sm' ? 'sm' : 'md';
        const expected = FIELD_CLASS[size].split(' ');
        const missing = expected.filter((cls) => !input?.classList.contains(cls));
        return missing.length === 0 || `面の class が足りない: ${missing.join(' ')}`;
      },
    },
    {
      id: 'md-is-16px',
      description: 'md は 16px の字（16px 未満だと iOS が画面ごと拡大する）',
      check: ({ root, contract }) => {
        if (contract.size !== 'md') return true;
        const input = root.querySelector('input');
        return input?.classList.contains('text-[16px]') || '16px の字でない';
      },
    },
  ],
});
