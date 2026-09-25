/**
 * HelpIllustration の検証スペック。
 *
 * 見張るのは「**1 本の線で描く**」こと — 塗り（fill）を持たず、アプリの色（currentColor）
 * だけで、線幅はアイコンと同じ。旧オンボーディングの挿絵（別系統の塗り色）に戻る回帰を
 * 捕まえる。
 */

import { registerUnit } from '@oryzae/verify';
import { ICON_STROKE_WIDTH } from '@/components/ui/surface';
import type { HelpIllustrationKind } from '../types';
import { HelpIllustration } from './help-illustrations';

interface Props {
  kind: HelpIllustrationKind;
  size?: number;
}

const KINDS: HelpIllustrationKind[] = [
  'room',
  'question',
  'pen',
  'jar',
  'notebook',
  'board',
  'shelf',
  'letter',
  'snippet',
  'photo',
  'list',
  'timeline',
  'person',
  'memo',
  'search',
];

registerUnit<Props>({
  id: 'HelpIllustration',
  title: 'HelpIllustration',
  description: 'ヘルプの話題に添える線画。書斎の物と同じ 1 本の線で描く',
  kind: 'component',
  render: (props) => <HelpIllustration {...props} />,
  fixtures: [
    ...KINDS.map((kind) => ({
      id: kind,
      description: kind === 'room' ? '書斎 — 「‹ 書斎」のボタンと同じ記号' : `${kind} の線画`,
      props: { kind },
    })),
    {
      id: 'small',
      probe: true,
      description: 'Probe: 小さく出しても比（3:4）が崩れない',
      props: { kind: 'jar', size: 24 },
    },
  ],
  invariants: [
    {
      id: 'single-stroke',
      description: '塗らない。線は currentColor、線幅はアイコンと同じ',
      check: ({ root }) => {
        const svg = root.querySelector('svg');
        if (!svg) return 'svg が無い';
        return (
          (svg.getAttribute('fill') === 'none' &&
            svg.getAttribute('stroke') === 'currentColor' &&
            svg.getAttribute('stroke-width') === String(ICON_STROKE_WIDTH)) ||
          `fill=${svg.getAttribute('fill')} stroke=${svg.getAttribute('stroke')} width=${svg.getAttribute('stroke-width')}`
        );
      },
    },
    {
      id: 'has-path',
      description: '絵が空でない',
      check: ({ root }) => {
        const d = root.querySelector('path')?.getAttribute('d') ?? '';
        return d.length > 10 || '線が無い';
      },
    },
    {
      id: 'aspect',
      description: '高さは幅の 3/4（箱は 72 × 54）',
      check: ({ root, props }) => {
        const size = props.size ?? 72;
        // 書斎（room）は「‹ 書斎」と同じ正方形の記号を 3:4 の箱の中央に置く。箱で見る。
        if (props.kind === 'room') {
          const box = root.querySelector<HTMLElement>('[data-verify-unit="HelpIllustration"]');
          const height = Number.parseFloat(box?.style.height ?? '');
          return Math.abs(height - (size * 3) / 4) < 0.01 || `box height=${height}, size=${size}`;
        }
        const svg = root.querySelector('svg');
        const height = Number(svg?.getAttribute('height'));
        return Math.abs(height - (size * 54) / 72) < 0.01 || `height=${height}, size=${size}`;
      },
    },
    {
      id: 'decorative',
      description: '読み上げには出さない（隣の文が説明している）',
      check: ({ root }) =>
        root.querySelector('svg')?.getAttribute('aria-hidden') === 'true' || 'aria-hidden が無い',
    },
  ],
});
