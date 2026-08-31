/**
 * Segmented の検証スペック。
 *
 * 見張るのは「2択の切り替えが**1クリックで決まる**」こと。開いて選ぶ形に戻ると、
 * 縦書き/横書きの切り替えに操作が1つ増える（Segmented の doc を参照）。
 */
import { registerUnit } from '@oryzae/verify';
import { Segmented } from './segmented';

interface Props {
  value: string;
}

registerUnit<Props>({
  id: 'Segmented',
  title: 'Segmented',
  description: '選択肢が少ないときの切り替え（本物のラジオ群を隠して見た目を差し替える）。',
  kind: 'component',
  render: (props) => (
    <div className="p-6">
      <Segmented
        ariaLabel="書字方向"
        value={props.value}
        options={[
          { value: 'vertical', label: '縦書き' },
          { value: 'horizontal', label: '横書き' },
        ]}
        onChange={() => {}}
        className="w-40"
      />
    </div>
  ),
  fixtures: [
    { id: 'vertical', description: '縦書きが選ばれている', props: { value: 'vertical' } },
    { id: 'horizontal', description: '横書きが選ばれている', props: { value: 'horizontal' } },
    {
      id: 'unknown-value',
      probe: true,
      description: '保存値が壊れていて、どちらでもない — 印は付かないが選択肢は消えない',
      props: { value: 'diagonal' },
    },
  ],
  invariants: [
    {
      id: 'all-options-visible',
      description: '選択肢はすべて見えている（畳まれていない）',
      check: ({ root }) => {
        const radios = root.querySelectorAll('input[type="radio"]');
        return radios.length === 2 || `expected 2 radios, got ${radios.length}`;
      },
    },
    {
      id: 'at-most-one-checked',
      description: '選ばれているのは多くても1つ（値が壊れていれば0）',
      check: ({ root }) => {
        const checked = root.querySelectorAll('input[type="radio"]:checked');
        return checked.length <= 1 || `expected at most 1 checked, got ${checked.length}`;
      },
    },
    {
      id: 'known-value-is-checked',
      description: '既知の値なら必ずどれかが選ばれている',
      onlyFixtures: ['vertical', 'horizontal'],
      check: ({ root }) => {
        const checked = root.querySelectorAll('input[type="radio"]:checked');
        return checked.length === 1 || `expected 1 checked, got ${checked.length}`;
      },
    },
    {
      id: 'no-popup-trigger',
      description: '開くためのボタンを持たない（1クリックで決まる）',
      check: ({ root }) => {
        const expanders = root.querySelectorAll('[aria-expanded],[aria-haspopup]');
        return expanders.length === 0 || `expected no popup trigger, got ${expanders.length}`;
      },
    },
  ],
});
