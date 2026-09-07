/**
 * JarVessel の検証スペック（発酵瓶そのもの・issue #278）。
 *
 * 瓶は readiness を2軸（top = いちばん進んだ問い 0〜1 / total = 総和 0〜3）で受け取るだけの
 * 純表示部品で、fetch も router も持たない。i18n だけ withVerifyProviders で供給すれば
 * 孤立検証できる。top が段階を、total が賑やかさを決める（utils/jar-visuals.ts）。
 *
 * 公表する契約は「見た目のどこが動いたか」だけ:
 * fillPct（液面）/ microbes（微生物の数）/ bubbles（泡の数）/ words（文字粒子の数）。
 * **readiness の生の値は契約に出さない**。DOM に出ると devtools から逆算でき、
 * 「いつ来るか分からない」という issue #278 の狙いが崩れるため。
 *
 * fixture は 4 段階（空 → 液 → 微生物 → 泡）の境界値と、PR #559 のレビューで決まった
 * 「問い1つでも泡立つ」「問いが多い人の瓶のほうが賑やか」を並べて確かめる 2 件。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { JAR_VESSEL_SLOTS, JarVessel } from './jar-vessel';

interface Props {
  top?: number;
  total?: number;
  width?: number;
  height?: number;
}

registerUnit<Props>({
  id: 'JarVessel',
  title: 'JarVessel',
  description: '発酵瓶（液面・微生物・泡・文字粒子が readiness に追従する）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<JarVessel {...props} />),
  fixtures: [
    {
      id: 'empty',
      description: '空っぽ（液は瓶底へ沈み、微生物も泡も出ない）',
      props: { top: 0, total: 0 },
    },
    {
      id: 'filling',
      description: '液が半分まで満ちる（微生物・泡はまだ出ない）',
      props: { top: 1 / 6, total: 1 / 6 },
    },
    {
      id: 'matured',
      description: '液が満ちきる（微生物はここから増え始める）',
      props: { top: 1 / 3, total: 1 / 3 },
    },
    {
      id: 'active',
      description: '微生物が漂い動きが活性化（泡はまだ出始めない）',
      props: { top: 2 / 3, total: 2 / 3 },
    },
    {
      id: 'solo-bubbling',
      description: '問い1つが満タン — 泡は立つが量は控えめ（PR #559 レビューでの決定）',
      props: { top: 1, total: 1 },
    },
    {
      id: 'trio-bubbling',
      description: '問い3つが同時に満タン — 同じ段階でも微生物・泡が倍で上限に達する',
      props: { top: 1, total: 3 },
    },
    {
      id: 'out-of-range',
      probe: true,
      description: 'Probe: 上限を超える値でも満タンで頭打ちになる',
      props: { top: 99, total: 99 },
    },
    {
      id: 'negative',
      probe: true,
      description: 'Probe: 負の値は 0 と同じ扱い（空っぽ）',
      props: { top: -1, total: -1 },
    },
  ],
  invariants: [
    {
      id: 'microbe-count-matches-contract',
      description: '描画される微生物の数が contract.microbes と一致し、上限を超えない',
      check: ({ root, contract }) => {
        const rendered = root.querySelectorAll('[data-jar-microbe]').length;
        return (
          (String(rendered) === contract.microbes && rendered <= JAR_VESSEL_SLOTS.microbes) ||
          `微生物の描画数=${rendered} だが contract.microbes="${contract.microbes}"（上限 ${JAR_VESSEL_SLOTS.microbes}）`
        );
      },
    },
    {
      id: 'bubble-count-matches-contract',
      description: '描画される泡の数が contract.bubbles と一致する',
      check: ({ root, contract }) => {
        const bubbles = root.querySelectorAll('[data-jar-bubble]').length;
        return (
          String(bubbles) === contract.bubbles ||
          `泡の描画数=${bubbles} だが contract.bubbles="${contract.bubbles}"`
        );
      },
    },
    {
      id: 'fill-within-range',
      description: '液面は 0〜100% に収まる（範囲外の readiness でも頭打ち）',
      check: ({ contract }) => {
        const pct = Number(contract.fillPct);
        return (pct >= 0 && pct <= 100) || `fillPct が 0〜100 の範囲外: ${contract.fillPct}`;
      },
    },
    {
      id: 'no-numeric-readiness-exposed',
      description: 'readiness の数値も "%" 表記も画面に出さない（issue #278 受け入れ基準）',
      check: ({ root }) => {
        // <style> の中身は画面に出る文字ではない（keyframes の "0%, 100%" を拾ってしまう）。
        const clone = root.cloneNode(true);
        if (clone instanceof Element) {
          for (const style of clone.querySelectorAll('style')) style.remove();
        }
        const text = clone.textContent ?? '';
        return !/[%％]|\d/.test(text) || `瓶の中に数値らしき表示がある: "${text.slice(0, 80)}"`;
      },
    },
    {
      id: 'empty-jar-is-empty',
      description: '何も進んでいなければ液は空・微生物も泡も無い',
      onlyFixtures: ['empty', 'negative'],
      check: ({ contract }) =>
        (contract.fillPct === '0' && contract.microbes === '0' && contract.bubbles === '0') ||
        `expected empty jar, got fillPct=${contract.fillPct}, microbes=${contract.microbes}, bubbles=${contract.bubbles}`,
    },
    {
      id: 'matured-fills-liquid-only',
      description: '液が満ちきった時点では、微生物はまだ増え始めていない',
      onlyFixtures: ['matured'],
      check: ({ contract }) =>
        (contract.fillPct === '100' && contract.microbes === '0' && contract.bubbles === '0') ||
        `expected full liquid & no microbes, got fillPct=${contract.fillPct}, microbes=${contract.microbes}, bubbles=${contract.bubbles}`,
    },
    {
      id: 'active-has-microbes-but-no-bubbles',
      description: '微生物が漂う段階では、泡はまだ出ない（段階の境目）',
      onlyFixtures: ['active'],
      check: ({ contract }) =>
        (Number(contract.microbes) > 0 && contract.bubbles === '0') ||
        `expected some microbes & bubbles=0, got microbes=${contract.microbes}, bubbles=${contract.bubbles}`,
    },
    {
      id: 'bubbling-is-maxed',
      description: '問い3つが満タンなら液・微生物・泡・文字がすべて上限に達する',
      onlyFixtures: ['trio-bubbling'],
      check: ({ contract }) =>
        (contract.fillPct === '100' &&
          contract.microbes === String(JAR_VESSEL_SLOTS.microbes) &&
          contract.bubbles === String(JAR_VESSEL_SLOTS.bubbles) &&
          contract.words === String(JAR_VESSEL_SLOTS.words)) ||
        `expected everything maxed, got fillPct=${contract.fillPct}, microbes=${contract.microbes}, bubbles=${contract.bubbles}, words=${contract.words}`,
    },
    {
      id: 'solo-still-bubbles',
      description: '問いが1つでも泡は立つ（PR #559 レビューでの決定）',
      onlyFixtures: ['solo-bubbling'],
      check: ({ root, contract }) => {
        const bubbles = root.querySelectorAll('[data-jar-bubble]').length;
        return (
          (Number(contract.bubbles) > 0 && bubbles > 0) ||
          `問い1つでも泡立つはずが bubbles=${contract.bubbles} / 描画=${bubbles}`
        );
      },
    },
    {
      id: 'out-of-range-is-capped',
      description: '上限を超える値でも満タン（問い1つぶん）で頭打ちになる',
      onlyFixtures: ['out-of-range'],
      check: ({ contract }) =>
        (contract.fillPct === '100' &&
          Number(contract.microbes) <= JAR_VESSEL_SLOTS.microbes &&
          Number(contract.bubbles) <= JAR_VESSEL_SLOTS.bubbles) ||
        `expected capped, got fillPct=${contract.fillPct}, microbes=${contract.microbes}, bubbles=${contract.bubbles}`,
    },
  ],
});
