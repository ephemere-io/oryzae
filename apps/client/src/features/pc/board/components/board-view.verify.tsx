/**
 * BoardView の検証スペック（A 移植・PC 版ボード合成）。
 *
 * BoardView は viewType・各ダイアログ開閉を自前 state で持ち、子（BoardDateNav /
 * BoardControls / SnippetDialog / PhotoDialog / BoardCard）を束ねる feature。
 * データ取得は useBoard(api) / useBoardSave(api) に閉じており、いずれも api 越しの
 * fetch でしか cards を増やさない。よって「解決しない fetch を持つ ApiClient」を渡せば
 * ネットワーク0・cards は常に空のまま孤立検証できる（board は常に「0 CARDS」表示）。
 * router は useRouter を使うが withVerifyProviders の no-op mock で供給される。
 *
 * 公表する契約は実際に変化する状態のみ: viewType（daily/weekly トグル）と、
 * snippetOpen / photoOpen（コントロールの追加ボタンで開くダイアログ）。cards は seam が
 * 無く常に空なのでカード内容は契約に載せない。loading は never-resolve では true で固定・
 * showLoader は 250ms タイマー依存のため、どちらも契約・invariant に載せない
 * （sp-entry-editor の「定数・タイマー揺れは契約に載せない」と同方針）。
 *
 * i18n（board）依存のため withVerifyProviders（NextIntlClientProvider）で包む。
 * BoardControls のボタンは [data-verify-unit="BoardControls"] の直下 <button> 群で、
 * 1=Daily / 2=Weekly / 3=Snippet / 4=Photo の順なので nth-of-type で一意に押せる。
 */

import { registerUnit } from '@oryzae/verify';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BoardView } from './board-view';

interface Props {
  api: ApiClient;
}

// 解決しない fetch を持つ ApiClient（fetch を発火させても永遠に pending＝ネットワーク0・
// cards 空のまま。as 不要で ApiClient を満たす）。
const neverResolveApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: () => new Promise<Response>(() => {}),
};

const SNIPPET_BTN = '[data-verify-unit="BoardControls"] button:nth-of-type(3)';
const PHOTO_BTN = '[data-verify-unit="BoardControls"] button:nth-of-type(4)';
const WEEKLY_BTN = '[data-verify-unit="BoardControls"] button:nth-of-type(2)';

registerUnit<Props>({
  id: 'BoardView',
  title: 'BoardView',
  description:
    'PC 版ボード合成（日付ナビ＋コントロール＋カードキャンバス＋スニペット/写真ダイアログ）。',
  kind: 'feature',
  render: (props) => withVerifyProviders(<BoardView {...props} />),
  fixtures: [
    {
      id: 'default',
      description: '初期表示（daily・ダイアログ閉・カード0枚）',
      props: { api: neverResolveApi },
    },
    {
      id: 'snippet-open',
      description: 'コントロールの ✦ Snippet を押すとスニペット作成ダイアログが開く',
      props: { api: neverResolveApi },
      act: async (ctx) => {
        await ctx.click(SNIPPET_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'photo-open',
      description: 'コントロールの Photo を押すと写真追加ダイアログが開く',
      props: { api: neverResolveApi },
      act: async (ctx) => {
        await ctx.click(PHOTO_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'weekly',
      probe: true,
      description:
        'Probe: Weekly トグルを押しても契約が viewType=weekly に追従しダイアログは閉のまま',
      props: { api: neverResolveApi },
      act: async (ctx) => {
        await ctx.click(WEEKLY_BTN);
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'snippet-dialog-iff-snippet-open',
      description: 'スニペットダイアログ（role=dialog）は snippetOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasSnippet = Boolean(
          root.querySelector('[data-verify-unit="SnippetDialog"][role="dialog"]'),
        );
        const expectOpen = contract.snippetOpen === 'true';
        return (
          hasSnippet === expectOpen ||
          `SnippetDialog present=${hasSnippet} だが contract.snippetOpen="${contract.snippetOpen}"`
        );
      },
    },
    {
      id: 'photo-dialog-iff-photo-open',
      description: '写真ダイアログ（role=dialog）は photoOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasPhoto = Boolean(
          root.querySelector('[data-verify-unit="PhotoDialog"][role="dialog"]'),
        );
        const expectOpen = contract.photoOpen === 'true';
        return (
          hasPhoto === expectOpen ||
          `PhotoDialog present=${hasPhoto} だが contract.photoOpen="${contract.photoOpen}"`
        );
      },
    },
    {
      id: 'viewtype-contract-matches-controls',
      description: 'BoardView の viewType 契約と BoardControls の viewType 契約が一致する',
      check: ({ root, contract }) => {
        const controls = root.querySelector('[data-verify-unit="BoardControls"]');
        const controlsViewType = controls?.getAttribute('data-verify-view-type');
        return (
          contract.viewType === controlsViewType ||
          `viewType 不一致: BoardView="${contract.viewType}" / BoardControls="${controlsViewType}"`
        );
      },
    },
    {
      id: 'default-collapsed',
      description: '初期表示は daily・両ダイアログ閉',
      onlyFixtures: ['default'],
      check: ({ contract }) =>
        (contract.viewType === 'daily' &&
          contract.snippetOpen === 'false' &&
          contract.photoOpen === 'false') ||
        `expected daily/collapsed, got viewType=${contract.viewType}, snippetOpen=${contract.snippetOpen}, photoOpen=${contract.photoOpen}`,
    },
    {
      id: 'weekly-after-toggle',
      description: 'Weekly トグル後は viewType=weekly でダイアログは閉のまま',
      onlyFixtures: ['weekly'],
      check: ({ contract }) =>
        (contract.viewType === 'weekly' &&
          contract.snippetOpen === 'false' &&
          contract.photoOpen === 'false') ||
        `expected weekly/collapsed, got viewType=${contract.viewType}, snippetOpen=${contract.snippetOpen}, photoOpen=${contract.photoOpen}`,
    },
  ],
});
