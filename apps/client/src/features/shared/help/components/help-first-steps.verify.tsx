/**
 * HelpFirstSteps の検証スペック。
 *
 * 見張るのは「三歩が順に並び、それぞれ押せる」こと、三歩目に最初の手紙が届く条件
 * （文字数）が添えてあること、そして進み具合が形に出ること — 済んだ歩は印、いまの歩は
 * 番号が脈打ち、まだの歩は薄い。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { HELP_STEPS } from '../tutorial';
import type { HelpProgress, HelpStepId } from '../types';
import { HelpFirstSteps } from './help-first-steps';

interface Props {
  progress: HelpProgress | null;
  current: HelpStepId | null;
}

registerUnit<Props>({
  id: 'HelpFirstSteps',
  title: 'HelpFirstSteps',
  description: '「まず試してみよう」— 問いを立てる → 書く → 漬けて待つ の三歩。一個ずつ済ませる',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div className="w-[336px] p-3" style={{ background: 'var(--bg)' }}>
        <HelpFirstSteps onOpenHref={() => {}} progress={props.progress} current={props.current} />
      </div>,
    ),
  fixtures: [
    {
      id: 'unknown',
      description: '進み具合が分からない（全部同じ濃さ）',
      props: { progress: null, current: null },
    },
    {
      id: 'first',
      probe: true,
      description: 'Probe: 何もしていない — ①が脈打ち、②③は薄い',
      props: { progress: { question: false, write: false, pickle: false }, current: 'question' },
    },
    {
      id: 'third',
      probe: true,
      description: 'Probe: ①②が済み — ③が脈打つ',
      props: { progress: { question: true, write: true, pickle: false }, current: 'pickle' },
    },
    {
      id: 'done',
      description: '全部済み — 印だけ。脈打つ歩は無い',
      props: { progress: { question: true, write: true, pickle: true }, current: null },
    },
  ],
  invariants: [
    {
      id: 'three-steps-in-order',
      description: '問い → 書く → 漬ける の順に 3 つ',
      check: ({ root, contract }) => {
        const items = [...root.querySelectorAll('li')].map((li) => li.textContent ?? '');
        if (items.length !== 3 || contract.stepCount !== '3') return `${items.length} 歩`;
        const s = jaMessages.help.steps;
        const ok =
          items[0]?.includes(s.question.title) &&
          items[1]?.includes(s.write.title) &&
          items[2]?.includes(s.pickle.title);
        return ok || `順が違う: ${items.map((x) => x.slice(0, 8)).join(' / ')}`;
      },
    },
    {
      id: 'each-step-is-pressable',
      description: 'それぞれの歩が押せる（読む物ではなく辿る物）',
      check: ({ root }) => root.querySelectorAll('li button').length === 3 || '押せない歩がある',
    },
    {
      id: 'pickle-step-tells-the-condition',
      description: '三歩目に最初の手紙が届く条件（文字数）が添えてある',
      check: ({ root }) => {
        const third = root.querySelectorAll('li')[2]?.textContent ?? '';
        return /\d/.test(third) || '三歩目に数字（文字数）が無い';
      },
    },
    {
      id: 'current-step-pulses-and-only-it',
      description: 'いまの歩の番号だけが脈打つ（aria-current="step" も同じ歩）',
      check: ({ root, props }) => {
        const pulsing = [...root.querySelectorAll('li')].filter((li) =>
          li.querySelector('.tutorial-pulse'),
        );
        const current = root.querySelector('[aria-current="step"]')?.closest('li') ?? null;
        if (props.current === null) {
          return (pulsing.length === 0 && current === null) || '脈打つ歩があるべきではない';
        }
        return (
          (pulsing.length === 1 &&
            pulsing[0]?.getAttribute('data-step') === props.current &&
            current === pulsing[0]) ||
          `脈打つ歩: ${pulsing.map((li) => li.getAttribute('data-step')).join(',')}`
        );
      },
    },
    {
      id: 'done-steps-show-a-check',
      description: '済んだ歩は番号の代わりに印。まだの歩は薄い',
      check: ({ root, props }) => {
        for (const step of HELP_STEPS) {
          const li = root.querySelector(`li[data-step="${step}"]`);
          if (!li) return `${step} の行が無い`;
          const done = props.progress !== null && props.progress[step];
          const hasCheck = li.querySelector('[data-done]') !== null;
          if (done !== hasCheck) return `${step}: 印が${hasCheck ? 'ある' : '無い'}`;
          const state = li.getAttribute('data-step-state');
          if (props.progress === null && state !== 'plain')
            return `${step}: 分からないのに ${state}`;
        }
        return true;
      },
    },
  ],
});
