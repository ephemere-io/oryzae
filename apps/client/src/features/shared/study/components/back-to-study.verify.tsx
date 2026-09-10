/**
 * BackToStudy の検証スペック。
 *
 * 「サブ画面から書斎へ戻れる」（40-acceptance.md「ナビゲーション」）。
 *
 * 見るのは**置き場と見え方の約束**。左上（3 巡ぶん「既存の操作に被る」）→ 下端（操作
 * パレットの真下）→ 上端に浮かせた 9px の名前（問いのチップと重なる）→ 画面を下げる帯
 * （地がページと同じ色で「帯になっていない・目立たない」）と移してきた。いまは
 * **上端の細い帯と、中央から垂れるタブ**。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BackToStudy, STUDY_EXIT_TAB } from './back-to-study';

registerUnit<Record<string, never>>({
  id: 'BackToStudy',
  title: 'BackToStudy',
  description: 'サブ画面の上端に掛かる「書斎へ戻る」（細い帯 + 垂れるタブ）',
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
      id: 'hangs-from-the-top-edge',
      description: '上端に掛ける（隅と下端は画面側が使っている）',
      check: ({ root }) => {
        const band = root.querySelector('[data-verify-unit="BackToStudy"]');
        if (!(band instanceof HTMLElement)) return '帯が無い';
        const className = band.className;
        const missing = ['fixed', 'inset-x-0', 'top-0'].filter((c) => !className.includes(c));
        if (missing.length > 0) return `上端に掛かっていない: ${missing.join(', ')}`;
        if (/\bbottom-/.test(className))
          return '下端に置き直されている（操作パレットの真下になる）';
        return true;
      },
    },
    {
      id: 'tab-uses-the-palette-surface',
      description: 'タブはアクションパレットと同じ面（地・影）で描く',
      check: ({ root }) => {
        const tab = root.querySelector('a');
        if (!(tab instanceof HTMLElement)) return 'タブが無い';
        if (!tab.className.includes('bg-[var(--surface-raised)]'))
          return 'タブの地がパレットと違う';
        return tab.style.boxShadow !== '' || 'タブに影が無い（パレットと同じ影を持つ）';
      },
    },
    {
      id: 'name-is-readable',
      description: '名前は 12px 以上（9px は「小さすぎる」と報告された）',
      check: ({ root }) => {
        const label = root.querySelector('a span');
        const className = label?.className ?? '';
        const match = /text-\[(\d+(?:\.\d+)?)px\]/.exec(className);
        if (!match) return '文字の大きさが指定されていない';
        return Number(match[1]) >= 12 || `名前が小さい: ${match[1]}px`;
      },
    },
    {
      id: 'publishes-its-width',
      description: 'タブの幅を公表する（PC の画面はこの幅だけ中央を空ける）',
      check: ({ root, contract }) => {
        if (contract.tabWidth !== String(STUDY_EXIT_TAB.width)) {
          return `公表している幅が違う: ${String(contract.tabWidth)}`;
        }
        const tab = root.querySelector('a');
        if (!(tab instanceof HTMLElement)) return 'タブが無い';
        return (
          tab.style.width === `${STUDY_EXIT_TAB.width}px` ||
          `タブの幅が公表と違う: ${tab.style.width}`
        );
      },
    },
    {
      id: 'only-the-tab-is-clickable',
      description: '帯は押せず、タブだけが押せる（下の画面の操作を奪わない）',
      check: ({ root }) => {
        const band = root.querySelector('[data-verify-unit="BackToStudy"]');
        const bandClass = band instanceof HTMLElement ? band.className : '';
        if (!bandClass.includes('pointer-events-none')) return '帯全体が当たりを持っている';
        const tab = root.querySelector('a')?.className ?? '';
        return tab.includes('pointer-events-auto') || 'タブが押せなくなっている';
      },
    },
    {
      id: 'has-accessible-name',
      description: '名前が読める',
      check: ({ root }) => {
        const link = root.querySelector('a');
        return Boolean(link?.getAttribute('aria-label')) || 'aria-label が無い';
      },
    },
  ],
});
