/**
 * HelpTutorial の検証スペック。
 *
 * 見張るのは「五歩が順に並び、それぞれ押せる」こと、四歩目に最初の手紙が届く条件
 * （文字数）が添えてあること、進み具合が形に出ること（済んだ歩は印、いまの歩は番号が
 * 脈打ち、まだの歩は薄い）、そして済んだらアコーディオンが閉じて見出しだけ残ること。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { HELP_STEPS } from '../tutorial';
import type { HelpProgress, HelpStepId } from '../types';
import { HelpTutorial } from './help-tutorial';

interface Props {
  progress: HelpProgress | null;
  current: HelpStepId | null;
}

const NONE: HelpProgress = {
  question: false,
  write: false,
  link: false,
  pickle: false,
  read: false,
};
const ALL: HelpProgress = { question: true, write: true, link: true, pickle: true, read: true };

registerUnit<Props>({
  id: 'HelpTutorial',
  title: 'HelpTutorial',
  description:
    '「チュートリアル」— 問いを立てる → 書く → 紐づける → 漬けて待つ → 手紙を読む。一個ずつ済ませる',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div className="w-[336px] p-3" style={{ background: 'var(--bg)' }}>
        <HelpTutorial onOpenHref={() => {}} progress={props.progress} current={props.current} />
      </div>,
    ),
  fixtures: [
    {
      id: 'unknown',
      description: '進み具合が分からない（全部同じ濃さ、開いている）',
      props: { progress: null, current: null },
    },
    {
      id: 'first',
      probe: true,
      description: 'Probe: 何もしていない — ①が脈打ち、②〜⑤は薄い',
      props: { progress: NONE, current: 'question' },
    },
    {
      id: 'fourth',
      probe: true,
      description: 'Probe: ①②③が済み — ④が脈打つ',
      props: { progress: { ...ALL, pickle: false, read: false }, current: 'pickle' },
    },
    {
      id: 'done',
      probe: true,
      description: 'Probe: 全部済み — 閉じて見出しだけ。開き直せる',
      props: { progress: ALL, current: null },
    },
  ],
  invariants: [
    {
      id: 'five-steps-in-order',
      description: '問い → 書く → 紐づける → 漬ける → 読む の順に 5 つ',
      check: ({ root, contract }) => {
        const items = [...root.querySelectorAll('li')].map((li) => li.textContent ?? '');
        if (items.length !== 5 || contract.stepCount !== '5') return `${items.length} 歩`;
        const s = jaMessages.help.steps;
        const titles = [
          s.question.title,
          s.write.title,
          s.link.title,
          s.pickle.title,
          s.read.title,
        ];
        const ok = titles.every((title, i) => items[i]?.includes(title));
        return ok || `順が違う: ${items.map((x) => x.slice(0, 8)).join(' / ')}`;
      },
    },
    {
      id: 'each-step-is-pressable',
      description: 'それぞれの歩が押せる（読む物ではなく辿る物）',
      check: ({ root }) => root.querySelectorAll('li button').length === 5 || '押せない歩がある',
    },
    {
      id: 'pickle-step-tells-the-condition',
      description: '四歩目に最初の手紙が届く条件（文字数）が添えてある',
      check: ({ root }) => {
        const fourth = root.querySelector('li[data-step="pickle"]')?.textContent ?? '';
        return /\d/.test(fourth) || '四歩目に数字（文字数）が無い';
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
      description: '済んだ歩は番号の代わりに印。分からなければ全部 plain',
      check: ({ root, props }) => {
        for (const step of HELP_STEPS) {
          const li = root.querySelector(`li[data-step="${step}"]`);
          if (!li) return `${step} の行が無い`;
          const done = props.progress?.[step] === true;
          const hasCheck = li.querySelector('[data-done]') !== null;
          if (done !== hasCheck) return `${step}: 印が${hasCheck ? 'ある' : '無い'}`;
          const state = li.getAttribute('data-step-state');
          if (props.progress === null && state !== 'plain')
            return `${step}: 分からないのに ${state}`;
        }
        return true;
      },
    },
    {
      id: 'closes-when-complete-and-stays-in-place',
      description: '五歩とも済めば閉じて見出しだけ（開き直せる）。済んでいなければ開いている',
      check: ({ root, props, contract }) => {
        const complete = props.progress !== null && HELP_STEPS.every((s) => props.progress?.[s]);
        if (contract.complete !== String(complete)) return `契約 complete=${contract.complete}`;
        const header = root.querySelector('button[aria-expanded]');
        if (!header) return '見出しのボタンが無い';
        const open = header.getAttribute('aria-expanded') === 'true';
        if (open !== !complete)
          return complete ? '済んだのに開いている' : '済んでいないのに閉じている';
        if (contract.open !== String(open)) return `契約 open=${contract.open}`;
        const body = root.querySelector('[data-tutorial-body]');
        return body?.getAttribute('aria-hidden') === String(!open) || '本文の隠し方が合わない';
      },
    },
  ],
});
