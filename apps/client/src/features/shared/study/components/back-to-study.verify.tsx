/**
 * BackToStudy の検証スペック。
 *
 * 「サブ画面から書斎へ戻れる」（40-acceptance.md「ナビゲーション」）。
 *
 * 見るのは**置き場の約束**が中心。左上（3 巡ぶん「既存の操作に被る」）→ 下端（操作
 * パレットの真下で「被りそう・見にくい」）→ 上端に浮かせて重ねる（問いを 2 つ結ぶと
 * チップが中央まで伸びて重なる）と移してきた。いまは**上端の帯**で、画面の側が
 * そのぶん下がる。浮かせて重ねる形に戻すと、伸びる中身のある画面といつか必ずぶつかる。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BackToStudy, STUDY_EXIT_BAND } from './back-to-study';

registerUnit<Record<string, never>>({
  id: 'BackToStudy',
  title: 'BackToStudy',
  description: 'サブ画面の上端に敷く「書斎へ戻る」の帯',
  kind: 'component',
  render: () => withVerifyProviders(<BackToStudy />),
  fixtures: [
    {
      id: 'default',
      probe: true,
      description: 'Probe: /study へのリンクとして機能する',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'links-to-study',
      description: '/study へ行ける',
      check: ({ root }) =>
        Boolean(root.querySelector('a[href="/study"]')) || '/study へのリンクが無い',
    },
    {
      id: 'is-a-band-across-the-top',
      description: '上端いっぱいの帯として敷く（重ならないことが置き場の条件）',
      check: ({ root }) => {
        const band = root.querySelector('[data-verify-unit="BackToStudy"]');
        if (!(band instanceof HTMLElement)) return '帯が無い';
        const className = band.className;
        const missing: string[] = [];
        if (!className.includes('fixed')) missing.push('fixed');
        if (!className.includes('inset-x-0')) missing.push('inset-x-0');
        if (!className.includes('top-0')) missing.push('top-0');
        if (missing.length > 0) return `上端の帯になっていない: ${missing.join(', ')}`;
        // 隅と下端へ戻されていないこと。どちらも一度ぶつかって移した先。
        if (/\b(left-4|right-4|left-6|right-6)\b/.test(className)) {
          return '隅に置き直されている（画面側の操作と取り合いになる）';
        }
        if (/\bbottom-/.test(className)) {
          return '下端に置き直されている（操作パレットの真下になる）';
        }
        return true;
      },
    },
    {
      id: 'reserves-its-own-row',
      description: '帯は自分の高さを持ち、画面はそのぶん下がる',
      check: ({ root, contract }) => {
        const band = root.querySelector('[data-verify-unit="BackToStudy"]');
        if (!(band instanceof HTMLElement)) return '帯が無い';
        // 高さを公表していないと、シェルが下げる量と食い違っても誰も気づけない。
        if (contract.bandHeight !== String(STUDY_EXIT_BAND)) {
          return `公表している高さが違う: ${String(contract.bandHeight)}`;
        }
        return (
          band.style.height === `${STUDY_EXIT_BAND}px` ||
          `帯の高さが指定されていない: ${band.style.height}`
        );
      },
    },
    {
      id: 'only-the-name-is-clickable',
      description: '帯の余白は押せない（下の画面の操作を奪わない）',
      check: ({ root }) => {
        const band = root.querySelector('[data-verify-unit="BackToStudy"]');
        const bandClass = band instanceof HTMLElement ? band.className : '';
        if (!bandClass.includes('pointer-events-none')) return '帯全体が当たりを持っている';
        const link = root.querySelector('a')?.className ?? '';
        return link.includes('pointer-events-auto') || 'リンクが押せなくなっている';
      },
    },
    {
      id: 'quiet-until-touched',
      description: '常時は薄く、触れたときだけ濃くなる',
      check: ({ root }) => {
        const className = root.querySelector('a')?.className ?? '';
        if (!/\bopacity-\d+/.test(className)) return '常時の薄さが指定されていない';
        return className.includes('hover:opacity-100') || 'ホバーで濃くならない';
      },
    },
    {
      id: 'has-accessible-name',
      description: 'アイコンだけでも名前が読める',
      check: ({ root }) => {
        const link = root.querySelector('a');
        return Boolean(link?.getAttribute('aria-label')) || 'aria-label が無い';
      },
    },
  ],
});
