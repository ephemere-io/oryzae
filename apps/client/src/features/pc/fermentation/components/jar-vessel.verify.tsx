/**
 * JarVessel の検証スペック（発酵瓶そのもの・issue #278）。
 *
 * 瓶は readiness（問いごとの readiness の総和 0〜3）を受け取るだけの純表示部品で、
 * fetch も router も持たない。i18n だけ withVerifyProviders で供給すれば孤立検証できる。
 *
 * 公表する契約は「見た目のどこが動いたか」だけ:
 * fillPct（液面）/ microbes（微生物の数）/ bubbles（泡の数）/ words（文字粒子の数）。
 * **readiness の生の値は契約に出さない**。DOM に出ると devtools から逆算でき、
 * 「いつ来るか分からない」という issue #278 の狙いが崩れるため。
 *
 * fixture は issue が定めた 4 段階（0 / 1.0 / 2.0 / 3.0）と、その狙いどおり
 * 「段階ごとに主役が入れ替わる」ことを確かめる境界値。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { JAR_VESSEL_SLOTS, JarVessel } from './jar-vessel';

interface Props {
  readiness?: number;
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
      description: 'readiness 0.0 — 空っぽ（液は瓶底へ沈み、微生物も泡も出ない）',
      props: { readiness: 0 },
    },
    {
      id: 'half',
      description: 'readiness 0.5 — 液が半分まで満ちる（微生物・泡はまだ出ない）',
      props: { readiness: 0.5 },
    },
    {
      id: 'matured',
      description: 'readiness 1.0 — かなり熟成（液が満ちきる。微生物はここから増え始める）',
      props: { readiness: 1 },
    },
    {
      id: 'active',
      description: 'readiness 2.0 — 微生物が出そろい動きが活性化（泡はまだ出始めない）',
      props: { readiness: 2 },
    },
    {
      id: 'bubbling',
      description: 'readiness 3.0 — ぶくぶくと激しく泡立つ（全要素が上限）',
      props: { readiness: 3 },
    },
    {
      id: 'out-of-range',
      probe: true,
      description: 'Probe: 上限を超える readiness（99）でも 3.0 と同じ上限で頭打ちになる',
      props: { readiness: 99 },
    },
    {
      id: 'negative',
      probe: true,
      description: 'Probe: 負の readiness は 0 と同じ扱い（空っぽ）',
      props: { readiness: -1 },
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
      description: 'readiness 0 では液が空・微生物も泡も無い',
      onlyFixtures: ['empty', 'negative'],
      check: ({ contract }) =>
        (contract.fillPct === '0' && contract.microbes === '0' && contract.bubbles === '0') ||
        `expected empty jar, got fillPct=${contract.fillPct}, microbes=${contract.microbes}, bubbles=${contract.bubbles}`,
    },
    {
      id: 'matured-fills-liquid-only',
      description: 'readiness 1.0 で液は満ちきるが、微生物はまだ増え始めていない',
      onlyFixtures: ['matured'],
      check: ({ contract }) =>
        (contract.fillPct === '100' && contract.microbes === '0' && contract.bubbles === '0') ||
        `expected full liquid & no microbes, got fillPct=${contract.fillPct}, microbes=${contract.microbes}, bubbles=${contract.bubbles}`,
    },
    {
      id: 'active-has-microbes-but-no-bubbles',
      description: 'readiness 2.0 で微生物が出そろい、泡はまだ出ない（段階の境目）',
      onlyFixtures: ['active'],
      check: ({ contract }) =>
        (contract.microbes === String(JAR_VESSEL_SLOTS.microbes) && contract.bubbles === '0') ||
        `expected microbes=${JAR_VESSEL_SLOTS.microbes} & bubbles=0, got microbes=${contract.microbes}, bubbles=${contract.bubbles}`,
    },
    {
      id: 'bubbling-is-maxed',
      description: 'readiness 3.0 で液・微生物・泡・文字がすべて上限に達する',
      onlyFixtures: ['bubbling', 'out-of-range'],
      check: ({ contract }) =>
        (contract.fillPct === '100' &&
          contract.microbes === String(JAR_VESSEL_SLOTS.microbes) &&
          contract.bubbles === String(JAR_VESSEL_SLOTS.bubbles) &&
          contract.words === String(JAR_VESSEL_SLOTS.words)) ||
        `expected everything maxed, got fillPct=${contract.fillPct}, microbes=${contract.microbes}, bubbles=${contract.bubbles}, words=${contract.words}`,
    },
  ],
});
