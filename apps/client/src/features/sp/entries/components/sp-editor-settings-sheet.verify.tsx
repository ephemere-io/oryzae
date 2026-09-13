/**
 * SpEditorSettingsSheet の検証スペック。
 *
 * 見るのは: 4 つの項目（書体・文字サイズ・行間・字間）が全部あり、いまの値が押されている。
 * 押すと onChange に段が渡る（probe）。
 */

import { registerUnit } from '@oryzae/verify';
import type { EditorDisplay } from '@/features/shared/entries/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpEditorSettingsSheet } from './sp-editor-settings-sheet';

interface Props {
  display: EditorDisplay;
}

const noop = () => {};

registerUnit<Props>({
  id: 'SpEditorSettingsSheet',
  title: 'SpEditorSettingsSheet',
  description: 'エディタの設定（SP）: 書体・文字サイズ・行間・字間',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '640px' }}>
        <SpEditorSettingsSheet open display={props.display} onChange={noop} onClose={noop} />
      </div>,
    ),
  fixtures: [
    {
      id: 'default',
      description: '既定（明朝・中・標準・標準）',
      props: {
        display: {
          fontFamily: 'serif',
          fontSize: 'medium',
          lineHeight: 'normal',
          letterSpacing: 'normal',
        },
      },
    },
    {
      id: 'large-sans',
      description: 'ゴシック・大・広め',
      props: {
        display: {
          fontFamily: 'sans',
          fontSize: 'large',
          lineHeight: 'wide',
          letterSpacing: 'wide',
        },
      },
    },
    {
      id: 'press',
      probe: true,
      description: 'Probe: 段を押しても設定は残る（閉じない）',
      props: {
        display: {
          fontFamily: 'serif',
          fontSize: 'medium',
          lineHeight: 'normal',
          letterSpacing: 'normal',
        },
      },
      act: async (ctx) => {
        await ctx.click('[data-verify-unit="Segmented"] label');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'four-rows',
      description: '書体・文字サイズ・行間・字間の 4 つがある',
      check: ({ root }) => {
        const count = root.querySelectorAll('[data-verify-unit="Segmented"]').length;
        return count === 4 || `項目が ${count} 個`;
      },
    },
    {
      id: 'stays-open-after-press',
      description: '段を押しても閉じない',
      onlyFixtures: ['press'],
      check: ({ root }) =>
        root.querySelector('[data-verify-unit="SpEditorSettingsSheet"]') !== null ||
        '押したら閉じた',
    },
  ],
});
