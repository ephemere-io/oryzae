/**
 * 漬け込みの演出（紙 → 瓶）の検証スペック。
 *
 * この演出はエディタの外側（body 直下の面）で走り、途中で紙の画面そのものが消える。
 * つまり**どの画面にも属さない**ので、そのままでは目でも自動でも確かめられなかった。
 * ここで「紙」と「瓶」を最小限だけ用意して、**本物の hook をそのまま**動かす。
 *
 * 見張るのは座標だけ。この演出の壊れ方は、いつも次の2つのどちらかだった:
 *   - 紙に無い場所から字が飛び立つ（字の位置を見積もっていた）
 *   - 瓶でないところへ吸い込まれる（吸い込み先を決め打ちしていた）
 *
 * jsdom には実寸が無いので、ここで確かめられるのは**組み立て**まで
 * （字が作られるか・面が片付くか・吸い込み先の変数が配られるか）。
 * 実際の px は、この画面をブラウザで開いて測る。
 */

import { registerUnit, verifyAttrs } from '@oryzae/verify';
import { useRef, useState } from 'react';
import { useSaveTransition } from '@/features/pc/entries/hooks/use-save-transition';

interface Props {
  text: string;
  /** 瓶の置き場所（画面座標）。実際の瓶は前回のパン・ズームでどこにでも来る。 */
  jar: { left: number; top: number; size: number } | null;
}

const OVERLAY = '#save-transition-overlay';

/**
 * 紙と瓶だけの舞台。**本物の hook を呼ぶ**ための最小限の器で、
 * ここでしか使わないので検証スペックの中に置く。
 */
function SaveTransitionStage({ text, jar }: Props) {
  const run = useSaveTransition();
  const paperRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  return (
    <div
      className="relative h-[600px] w-full overflow-hidden"
      style={{ background: 'var(--bg)' }}
      {...verifyAttrs({ unit: 'SaveTransition', started, hasJar: jar !== null })}
    >
      {/* 紙。字の位置は組版そのものから測られるので、折り返しも効く。 */}
      <div
        ref={paperRef}
        className="absolute text-[var(--fg)]"
        style={{
          left: 40,
          top: 40,
          width: 420,
          fontSize: 24,
          lineHeight: 1.8,
          fontFamily: "'Noto Serif JP', serif",
        }}
      >
        {text}
      </div>

      {/* 瓶。本物と同じ印を付ける——演出はこの印を探して吸い込み先を決める。
          縦横比も本物に合わせる（500 : 620）。狙うのは箱の中心ではなく**胴**なので、
          比率がずれると当たりどころも変わる。 */}
      {jar && (
        <div
          data-verify-unit="JarVessel"
          className="absolute border-2"
          style={{
            left: jar.left,
            top: jar.top,
            width: jar.size,
            height: Math.round((jar.size * 620) / 500),
            borderRadius: '40% 40% 45% 45% / 20% 20% 60% 60%',
            borderColor: 'var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
          }}
        />
      )}

      <button
        type="button"
        data-testid="start"
        className="absolute right-4 bottom-4 rounded-md border px-3 py-1.5 text-[12px]"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--fg)' }}
        onClick={() => {
          setStarted(true);
          void run(text, paperRef.current);
        }}
      >
        漬け込む
      </button>
    </div>
  );
}

const SHORT = '朝の光が差し込む台所で、ゆっくりとコーヒーを淹れる時間が好きだ。';
const LONG = SHORT.repeat(12);

registerUnit<Props>({
  id: 'SaveTransition',
  title: 'SaveTransition',
  description: '漬け込みの演出（紙の字が瓶へ飛ぶ）。紙と瓶だけを置いて本物の hook を動かす。',
  kind: 'component',
  render: (props) => <SaveTransitionStage {...props} />,
  fixtures: [
    {
      id: 'idle',
      probe: true,
      description: 'まだ始めていない — 面は作られていない',
      props: { text: SHORT, jar: { left: 620, top: 260, size: 200 } },
    },
    {
      id: 'started',
      description: '始めた直後',
      props: { text: SHORT, jar: { left: 620, top: 260, size: 200 } },
      act: async ({ root, wait }) => {
        root.querySelector<HTMLButtonElement>('[data-testid="start"]')?.click();
        await wait(80);
      },
    },
    {
      id: 'no-jar',
      probe: true,
      description: 'Probe: 瓶がまだ描かれていない — それでも壊れない',
      props: { text: SHORT, jar: null },
      act: async ({ root, wait }) => {
        root.querySelector<HTMLButtonElement>('[data-testid="start"]')?.click();
        await wait(80);
      },
    },
    {
      id: 'long-text',
      probe: true,
      description: 'Probe: 長い本文 — 字の数は頭打ちになる（演出が重くならない）',
      props: { text: LONG, jar: { left: 620, top: 260, size: 200 } },
      act: async ({ root, wait }) => {
        root.querySelector<HTMLButtonElement>('[data-testid="start"]')?.click();
        await wait(80);
      },
    },
    {
      id: 'empty-paper',
      probe: true,
      description: 'Probe: 紙が空 — 何も作らずに黙って終わる',
      props: { text: '', jar: { left: 620, top: 260, size: 200 } },
      act: async ({ root, wait }) => {
        root.querySelector<HTMLButtonElement>('[data-testid="start"]')?.click();
        await wait(80);
      },
    },
  ],
  invariants: [
    {
      id: 'idle-leaves-nothing-behind',
      description: '始めるまで、画面には何も足さない',
      onlyFixtures: ['idle'],
      check: () => document.querySelector(OVERLAY) === null || '始めていないのに面が作られている',
    },
    {
      id: 'empty-paper-adds-nothing',
      // 紙が空なら演出そのものが起きない。空の面だけ残すと、押したのに
      // 何も起きないまま画面が覆われる。
      description: '紙が空なら、面ごと作らない',
      onlyFixtures: ['empty-paper'],
      check: () => document.querySelector(OVERLAY) === null || '空の紙で面が作られている',
    },
    {
      id: 'never-half-built',
      /**
       * **測れない環境では、何も作らずに終わる。**
       *
       * jsdom には組版が無いので字の位置が測れない。そこで「面だけ作って字は無い」に
       * なると、押したのに何も起きないまま画面が覆われる。字があるなら面もある、
       * 面があるなら字もある、のどちらかに必ず倒れることを見張る。
       *
       * 実際の px（どこから飛び、どこへ吸い込まれるか）は、この画面をブラウザで
       * 開いて測る。座標そのものの規則は utils/save-transition-geometry のテストで固定。
       */
      description: '面と字は、そろって在るかそろって無いか（半端に作らない）',
      check: () => {
        const overlay = document.querySelector(OVERLAY);
        const chars = document.querySelectorAll(`${OVERLAY} .st-char`).length;
        if (!overlay) return chars === 0 || '面が無いのに字がある';
        return chars > 0 || '面はあるのに字が1つも無い';
      },
    },
    {
      id: 'char-count-is-capped',
      // 本文がいくら長くても、演出に載る字は頭打ちにする（重さは字の数に比例する）。
      description: '字の数には上限がある',
      check: () => {
        const chars = document.querySelectorAll(`${OVERLAY} .st-char`).length;
        return chars <= 200 || `字が ${chars} 個ある（200 が上限）`;
      },
    },
  ],
});
