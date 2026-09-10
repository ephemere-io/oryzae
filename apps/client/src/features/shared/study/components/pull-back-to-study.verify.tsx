/**
 * PullBackToStudy の検証スペック。
 *
 * 見るのは**手応えの契約**の 2 つ。
 *
 *  - 引いていない間は何も邪魔しない（透明・当たり無し）。書斎へ戻る仕掛けが、
 *    板や瓶を触っている最中の操作を 1 つも奪ってはいけない
 *  - 憶えた部屋が無いときは仕掛けごと出さない。滲ませる絵が無いまま引けてしまうと、
 *    手応えの無いまま画面が変わる
 *
 * 引きの積み上げそのもの（イベント → 進み具合）は DOM ではなく時間の関数なので、
 * ここでは見ない。`constants.ts` の PULL_BACK に畳んである。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { saveStudyBackdrop } from '../backdrop';
import { PullBackToStudy } from './pull-back-to-study';

/** 1×1 の透明 GIF。憶えた部屋の代わりに敷く最小の絵。 */
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

interface Props {
  /** 憶えた部屋があるか。 */
  remembered: boolean;
}

function Harness({ remembered }: Props) {
  // 描く前に置き場を整える（この部品は sessionStorage を読んでから形が決まる）。
  if (typeof window !== 'undefined') {
    if (remembered) saveStudyBackdrop(PIXEL);
    else window.sessionStorage.removeItem('oryzae_study_backdrop');
  }
  return <PullBackToStudy />;
}

registerUnit<Props>({
  id: 'PullBackToStudy',
  title: 'PullBackToStudy',
  description: '引き切ったキャンバスからさらに引くと、部屋が滲み出て書斎へ戻る',
  kind: 'component',
  render: (props) => withVerifyProviders(<Harness {...props} />),
  fixtures: [
    {
      id: 'idle',
      probe: true,
      description: 'Probe: 引いていない間は透明で、下の操作を奪わない',
      props: { remembered: true },
    },
    {
      id: 'no-backdrop',
      description: '憶えた部屋が無い（初回・別タブ）',
      props: { remembered: false },
    },
  ],
  invariants: [
    {
      id: 'transparent-at-rest',
      description: '引いていない間は完全に透明（板や瓶の絵を曇らせない）',
      onlyFixtures: ['idle'],
      check: ({ root }) => {
        const layer = root.querySelector('[data-verify-unit="PullBackToStudy"]');
        if (!(layer instanceof HTMLElement)) return '層が描かれていない';
        return layer.style.opacity === '0' || `引いていないのに opacity=${layer.style.opacity}`;
      },
    },
    {
      id: 'never-steals-pointer',
      description: 'どの状態でもポインタを奪わない（戻る仕掛けが操作を止めない）',
      check: ({ root }) => {
        const layer = root.querySelector('[data-verify-unit="PullBackToStudy"]');
        if (!(layer instanceof HTMLElement)) return '層が描かれていない';
        return layer.classList.contains('pointer-events-none') || '層がポインタを受け取ってしまう';
      },
    },
    {
      id: 'disarmed-without-backdrop',
      description: '憶えた部屋が無ければ効かない（滲ませる絵が無いまま画面を変えない）',
      onlyFixtures: ['no-backdrop'],
      // 契約は DOM の属性なので、値は必ず文字列で届く（`false` ではなく `'false'`）。
      check: ({ root, contract }) => {
        if (contract.armed !== 'false') return `地が無いのに armed=${String(contract.armed)}`;
        const image = root.querySelector('img[data-study-backdrop]');
        return image === null || '地が無いのに絵が出ている';
      },
    },
  ],
});
