/**
 * FermentationOverlay の検証スペック。
 * detail を props で受け取りエディタ上にフローティング要素（キーワード/スニペット/手紙）を
 * 重ねる部品。データ取得は親（useFermentationForQuestion）が担い、本体は props だけで
 * 孤立レンダリングできる。ドラッグは useOverlayDrag（純粋なポインタ/state フック、router/
 * fetch 非依存）なので withVerifyProviders（i18n 供給）だけで検証できる。
 *
 * 注意:
 * - FermentationOverlayDetailPane は常時マウントされ閉ボタンも常に root に存在する。
 *   ボタン数の invariant は契約要素（data-verify-unit="FermentationOverlay"）配下に限定する。
 * - キーワードは 5 件、スニペットは 3 件で slice される。契約には描画済み（cap 後）の件数を
 *   公表しているので、cap 超過の probe でも DOM 件数と一致する。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { FermentationOverlay } from './fermentation-overlay';

interface Props {
  detail: FermentationDetail;
}

const OVERLAY_SELECTOR = '[data-verify-unit="FermentationOverlay"]';

/** 瓶ビュー用の座標。エディタのオーバーレイは自前で配置するので常に null でよい。 */
const NO_JAR_POS = { jarX: null, jarY: null };

function makeDetail(overrides: Partial<FermentationDetail>): FermentationDetail {
  return {
    id: 'ferm-1',
    questionId: 'q-1',
    targetPeriod: '2026-05',
    status: 'completed',
    worksheet: null,
    snippets: [],
    keywords: [],
    letter: null,
    ...overrides,
  };
}

const fullDetail: FermentationDetail = makeDetail({
  keywords: [
    {
      id: 'k1',
      keyword: '静けさ',
      description: '心が落ち着く瞬間についての気づき。',
      ...NO_JAR_POS,
    },
    { id: 'k2', keyword: '余白', description: '予定を詰め込まない時間の価値。', ...NO_JAR_POS },
  ],
  snippets: [
    {
      id: 's1',
      snippetType: 'core',
      originalText: '朝の光が差し込む台所で、ゆっくりとコーヒーを淹れる時間が好きだ。',
      sourceDate: '2026-05-01',
      selectionReason: '日常の中の幸福を捉えた一節。',
      ...NO_JAR_POS,
    },
  ],
  letter: { id: 'l1', bodyText: 'あなたの言葉から、静かな強さを感じました。', ...NO_JAR_POS },
});

registerUnit<Props>({
  id: 'FermentationOverlay',
  title: 'FermentationOverlay',
  description: 'エディタ上に発酵結果（キーワード/スニペット/手紙）を漂わせるオーバーレイ。',
  kind: 'component',
  render: (props) => withVerifyProviders(<FermentationOverlay {...props} />),
  fixtures: [
    {
      id: 'full',
      description: 'キーワード2・スニペット1・手紙ありの代表ケース',
      props: { detail: fullDetail },
    },
    {
      id: 'keywords-only',
      description: 'キーワードのみ（スニペット・手紙なし）',
      props: {
        detail: makeDetail({
          keywords: [
            { id: 'k1', keyword: '対話', description: '誰かと話すことの効用。', ...NO_JAR_POS },
          ],
        }),
      },
    },
    {
      id: 'open-keyword-detail',
      description: 'キーワードをクリックして詳細ペインを開く',
      props: { detail: fullDetail },
      act: async (ctx) => {
        await ctx.click(`${OVERLAY_SELECTOR} button`);
        await ctx.wait(16);
      },
    },
    {
      id: 'over-cap',
      probe: true,
      description: 'Probe: キーワード8件でも 5 件で頭打ち（slice cap が崩れない）',
      props: {
        detail: makeDetail({
          keywords: Array.from({ length: 8 }, (_, i) => ({
            id: `k${i}`,
            keyword: `語${i}`,
            description: `説明${i}`,
            ...NO_JAR_POS,
          })),
        }),
      },
    },
  ],
  invariants: [
    {
      id: 'floating-count-matches-buttons',
      description:
        '総フローティング要素数（keyword+snippet+letter、cap 後）がオーバーレイ内のボタン数と整合する',
      check: ({ root, contract }) => {
        const overlay = root.querySelector(OVERLAY_SELECTOR);
        const buttonCount = overlay ? overlay.querySelectorAll('button').length : 0;
        const expected =
          Number(contract.keywordCount) +
          Number(contract.snippetCount) +
          (contract.hasLetter === 'true' ? 1 : 0);
        return (
          buttonCount === expected ||
          `floating button 数=${buttonCount}, 契約から期待=${expected} (keyword=${contract.keywordCount}, snippet=${contract.snippetCount}, hasLetter=${contract.hasLetter})`
        );
      },
    },
    {
      id: 'keyword-count-capped',
      description: 'keywordCount は 0〜5 に収まる（slice cap）',
      check: ({ contract }) => {
        const n = Number(contract.keywordCount);
        return (n >= 0 && n <= 5) || `keywordCount が 0〜5 の範囲外: ${contract.keywordCount}`;
      },
    },
    {
      id: 'letter-badge-matches-contract',
      description: 'hasLetter=true のとき手紙バッジ文言が描画される',
      check: ({ root, contract }) => {
        const hasBadge = Boolean(root.textContent?.includes('発酵プロセスからの手紙'));
        const expected = contract.hasLetter === 'true';
        return (
          hasBadge === expected ||
          `letter_badge 描画=${hasBadge}, 契約 hasLetter=${contract.hasLetter}`
        );
      },
    },
    {
      id: 'detail-closed-by-default',
      description: '初期状態では詳細ペインは閉じている（detailOpen=false）',
      onlyFixtures: ['full', 'keywords-only', 'over-cap'],
      check: ({ contract }) =>
        contract.detailOpen === 'false' ||
        `expected detailOpen=false, got "${contract.detailOpen}"`,
    },
    {
      id: 'detail-opens-on-click',
      description: 'フローティング要素クリック後に詳細ペインが開く（detailOpen=true）',
      onlyFixtures: ['open-keyword-detail'],
      check: ({ contract }) =>
        contract.detailOpen === 'true' ||
        `expected detailOpen=true after click, got "${contract.detailOpen}"`,
    },
  ],
});
