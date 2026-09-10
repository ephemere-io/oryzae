/**
 * StudyDoorway の検証スペック。
 *
 * 出口は 4 度置き直している（左上のマーク → 下端のピル → 下端の細い印 → 上端の矢印）。
 * 毎回の指摘は「既存の操作に被る」「見にくい」「どこにも出てこないデザイン言語」の
 * 3 つに集約されるので、その 3 つが崩れていないことをここで見る。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { saveStudyBackdrop } from '../backdrop';
import { DOORWAY } from '../constants';
import { StudyDoorway } from './study-doorway';

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
  return <StudyDoorway />;
}

registerUnit<Props>({
  id: 'StudyDoorway',
  title: 'StudyDoorway',
  description: 'サブ画面の下端に覗く部屋。押すと戻り、引くと育って戻る',
  kind: 'component',
  render: (props) => withVerifyProviders(<Harness {...props} />),
  fixtures: [
    {
      id: 'remembered',
      probe: true,
      description: 'Probe: 憶えた部屋を帯として覗かせる',
      props: { remembered: true },
    },
    {
      id: 'not-remembered',
      description: '憶えていない（初回・別タブ）。帯は地の色だけで、押せることは変わらない',
      props: { remembered: false },
    },
  ],
  invariants: [
    {
      id: 'links-to-study',
      description: 'どの状態でも /study へ行ける',
      check: ({ root }) =>
        Boolean(root.querySelector('a[href="/study"]')) || '/study へのリンクが無い',
    },
    {
      /**
       * 隅を空ける。ボードと瓶は左下に倍率、右下にミニマップを置いていて、全幅の帯は
       * その上に乗る。中央だけを使えば、どの画面の操作とも取り合わない。
       */
      id: 'keeps-the-corners-free',
      description: '中央だけを使う（左右の下隅は画面側が使っている）',
      check: ({ root }) => {
        const layer = root.querySelector('[data-verify-unit="StudyDoorway"]');
        if (!(layer instanceof HTMLElement)) return '層が描かれていない';
        if (!layer.classList.contains('justify-center')) return '中央に寄せていない';
        const link = root.querySelector('a');
        if (!(link instanceof HTMLElement)) return 'リンクが無い';
        // 幅は既定値そのもの（全幅にしない）。
        return link.style.width.includes(DOORWAY.restWidth) || `幅が ${link.style.width}`;
      },
    },
    {
      /**
       * 9px でホバーしないと名前が出ない形にしていたころ、下端で見落とされた。
       * 名前は常時、読める大きさで出す。
       */
      id: 'names-itself',
      description: '名前を常時、読める大きさで出す',
      check: ({ root, props }) => {
        const text = (root.textContent ?? '').trim();
        if (text.length === 0) return '名前が出ていない';
        const label = [...root.querySelectorAll('span')].find(
          (el) => (el.textContent ?? '').trim() === text,
        );
        const size = Number.parseFloat(label?.style.fontSize ?? '0');
        if (!(size >= 11)) return `名前が ${size}px（小さすぎる）`;
        // 憶えていなくても名前は出る（押せることは変わらない）。
        return props.remembered || text.length > 0 || '地が無いと名前まで消えている';
      },
    },
    {
      id: 'closed-at-rest',
      description: '触っていないときは帯のまま（画面を覆わない）',
      check: ({ root }) => {
        const link = root.querySelector('a');
        if (!(link instanceof HTMLElement)) return 'リンクが無い';
        const height = Number.parseFloat(link.style.height);
        return height === DOORWAY.restHeight || `高さが ${link.style.height}`;
      },
    },
  ],
});
