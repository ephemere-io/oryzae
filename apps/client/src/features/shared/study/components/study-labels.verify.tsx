/**
 * StudyLabels の検証スペック。
 *
 * SP のピルは受け入れ基準が具体的（44px 以上・4 つ常時・状態語つき・数値の readiness を
 * 出さない）なので、そこを機械的に見る（40-acceptance.md「SP のタッチ提示」）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { PC_LAYOUT, SP_LAYOUT, type StudyLayout } from '../layout';
import { PILL_MIN_HEIGHT } from '../scene/labels';
import type { StudyFermentationStatus } from '../types';
import { type LabelKind, type LabelPoint, StudyLabels } from './study-labels';

interface Props {
  layout: StudyLayout;
  positions: Partial<Record<LabelKind, LabelPoint | null>>;
  hovered: LabelKind | null;
  status: StudyFermentationStatus;
  readiness: number;
  entryCount: number;
  volumeCount: number;
  cardCount: number;
  screen: { width: number; height: number };
  onPick: () => void;
}

const POSITIONS: Partial<Record<LabelKind, LabelPoint>> = {
  jar: { x: 120, y: 420, visible: true },
  journal: { x: 250, y: 600, visible: true },
  board: { x: 195, y: 180, visible: true },
  archive: { x: 320, y: 330, visible: true },
};

const BASE: Props = {
  layout: SP_LAYOUT,
  positions: POSITIONS,
  hovered: null,
  status: 'fermenting',
  readiness: 0.45,
  entryCount: 9,
  volumeCount: 3,
  cardCount: 10,
  screen: { width: 390, height: 844 },
  onPick: () => {},
};

registerUnit<Props>({
  id: 'StudyLabels',
  title: 'StudyLabels',
  description: '対象ラベル（PC）と押せるピル（SP）',
  kind: 'component',
  render: (props) => withVerifyProviders(<StudyLabels {...props} />),
  fixtures: [
    { id: 'sp-fermenting', description: 'SP・発酵中', props: BASE },
    {
      id: 'sp-completed',
      description: 'SP・手紙が届いている',
      props: { ...BASE, status: 'completed', readiness: 1 },
    },
    {
      id: 'sp-narrow',
      probe: true,
      description: 'Probe: 390×640 の狭い端末でもピルが端で切れない',
      props: { ...BASE, screen: { width: 390, height: 640 } },
    },
    {
      id: 'pc-rest',
      description: 'PC・ホバーなし（控えめ）',
      props: { ...BASE, layout: PC_LAYOUT },
    },
    {
      id: 'pc-hovered',
      probe: true,
      description: 'Probe: PC で対象をホバーするとそのラベルだけ濃くなる',
      props: { ...BASE, layout: PC_LAYOUT, hovered: 'jar' },
    },
  ],
  invariants: [
    {
      id: 'sp-four-pills',
      description: 'SP では 4 つのピルが常時見える',
      check: ({ root, contract }) => {
        if (contract.mode !== 'sp') return true;
        const count = root.querySelectorAll('button').length;
        return count === 4 || `ピルが ${count} 個（4 つであるべき）`;
      },
    },
    {
      id: 'pill-min-height',
      description: 'ピルの高さが 44px を下回らない',
      check: ({ root, contract }) => {
        if (contract.mode !== 'sp') return true;
        for (const button of root.querySelectorAll('button')) {
          const min = Number.parseFloat(button.style.minHeight);
          if (!(min >= PILL_MIN_HEIGHT)) return `min-height が ${button.style.minHeight}`;
        }
        return true;
      },
    },
    {
      id: 'no-numeric-readiness',
      description: 'SP でも readiness を数値（％）で出さない',
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        if (text.includes('%')) return '％表記が出ている';
        const percent = String(Math.round(props.readiness * 100));
        return !text.includes(percent) || `readiness の数値 "${percent}" が出ている`;
      },
    },
    {
      id: 'pills-inside-screen',
      description: 'ピルが画面の外に出ない',
      check: ({ root, props }) => {
        if (props.layout.pillOffsets === null) return true;
        for (const button of root.querySelectorAll('button')) {
          const left = Number.parseFloat(button.style.left);
          const top = Number.parseFloat(button.style.top);
          if (left < 0 || left > props.screen.width) return `left=${left} が画面外`;
          if (top < 0 || top > props.screen.height) return `top=${top} が画面外`;
        }
        return true;
      },
    },
    {
      id: 'pc-rest-opacity',
      description: 'PC の既定は控えめ（0.5）で、ホバー中の対象だけ 1.0',
      check: ({ root, props, contract }) => {
        if (contract.mode !== 'pc') return true;
        const opacities = [...root.querySelectorAll('button')].map((b) => b.style.opacity);
        if (props.hovered === null) {
          return opacities.every((o) => o === '0.5') || `ホバー無しなのに ${opacities.join(',')}`;
        }
        return opacities.includes('1') || 'ホバー中の対象が濃くなっていない';
      },
    },
    {
      id: 'every-target-announces-itself',
      description: '4 つの的すべてが名乗る（黙っている的を作らない）',
      check: ({ root }) => {
        // 棚だけラベルを出していなかった（ホバーで背表紙のツールチップが出るから、
        // という理由）。ホバーは**そこに何かがあると知っている人にしか効かない**ので、
        // 過去の記録を全部持っている棚へ辿り着けなくなっていた（実機レビュー）。
        const text = root.textContent ?? '';
        const missing = ['JAR', 'JOURNAL', 'BOARD', 'ARCHIVE'].filter(
          (label) => !text.includes(label),
        );
        return missing.length === 0 || `名乗っていない的: ${missing.join(', ')}`;
      },
    },
  ],
});
