'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { StudyLayout } from '../layout';
import {
  clampPillToScreen,
  jarPillStateKey,
  LABEL_STYLE,
  PILL_MIN_HEIGHT,
  type PillSize,
} from '../scene/labels';
import type { StudyFermentationStatus, StudyTarget } from '../types';

/** どの対象のラベルか。 */
export type LabelKind = 'jar' | 'journal' | 'board' | 'archive' | 'pen';

/** SP のピルになる対象。鉛筆は入らない（SP は ENTRIES のピルがそのまま新規執筆）。 */
type PillKind = Exclude<LabelKind, 'pen'>;

export interface LabelPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface StudyLabelsProps {
  layout: StudyLayout;
  /** 毎フレーム更新される画面座標。null はその対象が今フレームで出ない。 */
  positions: Partial<Record<LabelKind, LabelPoint | null>>;
  /** ホバー中の対象（PC）。SP は常に null。 */
  hovered: LabelKind | null;
  /** ピルに添える状態。 */
  status: StudyFermentationStatus;
  readiness: number;
  entryCount: number;
  volumeCount: number;
  cardCount: number;
  /** canvas の実寸。ピルの押し戻しに使う。 */
  screen: { width: number; height: number };
  onPick: (target: StudyTarget) => void;
}

/**
 * 実測できるまでの暫定の寸法。
 *
 * **押し戻しには実測値を使う。** 固定値で代用すると、状態語の長い言語や大きい件数で
 * ピルが想定より広くなり、画面の端からはみ出す（実測 155px に対し 132px で計算していて
 * 右端が 1px 切れていた）。
 */
const FALLBACK_PILL_SIZE = { width: 132, height: PILL_MIN_HEIGHT };

/**
 * 対象ラベル（`docs/oryzae-study/00-overview.md`「対象ラベルとホバー」）。
 *
 * PC は「押せる」ことだけを伝える最小の注釈。SP はホバーが無いので、
 * **注釈そのものを押せるピルに変える**ことで「押せる」提示と「中身の予告」を 1 つにまとめる
 * （ツールチップは出す契機が無いので使わない）。
 *
 * 3D 座標に貼り付く HTML なので、位置は毎フレーム外から与えられる。
 * 透視スケールはかけない — 注釈は UI の側であって、遠近で小さくならない。
 */
export function StudyLabels(props: StudyLabelsProps) {
  const isSp = props.layout.pillOffsets !== null;
  return isSp ? <SpPills {...props} /> : <PcLabels {...props} />;
}

/**
 * PC の対象ラベル。**注釈であって、的ではない。**
 *
 * 押せるのは物のほう（瓶・手帳・棚の背表紙・鉛筆・板）で、ラベルはその名前を言うだけ。
 * 一時期ラベル自体も押せるようにしていたが、「文字にホバー効果があるが、文字自体は
 * クリックさせる必要はない」と報告された（実機レビュー）。
 *
 * 押せるものと押せないものが同じ見た目で並ぶと、どれが的なのかを毎回試すことになる。
 * ラベルは `pointer-events-none` のまま置き、濃さだけが物のホバーに従う。
 */
function PcLabels({ layout, positions, hovered }: StudyLabelsProps) {
  const t = useTranslations('study');
  // 棚（ARCHIVE）を外していた時期がある。ホバーで背表紙のツールチップが出るから、
  // という理由だったが、**ホバーはそこに何かがあると知っている人にしか効かない**。
  // 過去の記録を全部持っている的だけが黙っている状態になっていた（実機レビュー）。
  // 鉛筆は「NEW」（オーナーの依頼）。積みの ENTRIES と同じ書体で、鉛筆の真下に出す。
  const kinds: LabelKind[] = ['jar', 'journal', 'board', 'archive', 'pen'];

  return (
    <div
      {...verifyAttrs({ unit: 'StudyLabels', mode: 'pc', hovered: hovered ?? 'none' })}
      className="pointer-events-none absolute inset-0"
    >
      {kinds.map((kind) => {
        const point = positions[kind];
        if (!point || !point.visible) return null;
        if (kind === 'archive' && layout.labelAnchors.archive === null) return null;
        if (kind === 'pen' && layout.labelAnchors.pen === null) return null;

        return (
          <div
            key={kind}
            aria-hidden="true"
            className="absolute flex items-center gap-1.5 whitespace-nowrap"
            style={{
              left: point.x,
              top: point.y,
              transform: 'translate(-50%, -50%)',
              fontSize: LABEL_STYLE.fontSize,
              letterSpacing: LABEL_STYLE.letterSpacing,
              color: LABEL_STYLE.color,
              fontFamily: 'Inter, sans-serif',
              // 既定は控えめ。その対象をホバーしたときだけ濃くなる。
              opacity: hovered === kind ? LABEL_STYLE.hoverOpacity : LABEL_STYLE.restOpacity,
              transition: `opacity ${LABEL_STYLE.fadeMs}ms ease`,
            }}
          >
            <span
              style={{
                width: LABEL_STYLE.dotSize,
                height: LABEL_STYLE.dotSize,
                borderRadius: '50%',
                background: LABEL_STYLE.dotColor,
              }}
            />
            {t(labelKey(kind))}
          </div>
        );
      })}
    </div>
  );
}

function SpPills(props: StudyLabelsProps) {
  const t = useTranslations('study');
  const { layout, positions, screen, onPick } = props;

  // ピルの実寸。文字量で変わるので、描画されたものを測って押し戻しに使う。
  const [sizes, setSizes] = useState<Partial<Record<LabelKind, PillSize>>>({});

  const measure = useCallback((kind: LabelKind, element: HTMLButtonElement | null) => {
    if (!element) return;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    setSizes((previous) => {
      const current = previous[kind];
      // 同じ寸法で setState し続けると再描画が止まらない。
      if (current && current.width === width && current.height === height) return previous;
      return { ...previous, [kind]: { width, height } };
    });
  }, []);

  const offsets = layout.pillOffsets;
  if (offsets === null) return null;

  const kinds: PillKind[] = ['jar', 'journal', 'board', 'archive'];

  return (
    <div
      {...verifyAttrs({ unit: 'StudyLabels', mode: 'sp', pillCount: kinds.length })}
      className="pointer-events-none absolute inset-0"
    >
      {kinds.map((kind) => {
        const point = positions[kind];
        if (!point) return null;

        const placed = clampPillToScreen(
          point,
          offsets[kind],
          sizes[kind] ?? FALLBACK_PILL_SIZE,
          screen,
        );

        return (
          <button
            key={kind}
            ref={(element) => measure(kind, element)}
            type="button"
            onClick={() => onPick(targetFor(kind))}
            className="pointer-events-auto absolute flex items-center gap-1.5 whitespace-nowrap rounded-full px-3"
            style={{
              left: placed.x,
              top: placed.y,
              transform: 'translate(-50%, -50%)',
              // パディングだけだと文字量で高さが変わり、下限を割る。明示する。
              minHeight: PILL_MIN_HEIGHT,
              background: 'rgba(253,251,247,0.9)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(122,116,64,0.22)',
              boxShadow: '0 2px 12px rgba(140,133,126,0.14)',
              // 常に 1.0。ホバーで濃くなるのは PC 限定。
              opacity: 1,
            }}
          >
            <span
              style={{
                width: LABEL_STYLE.dotSize,
                height: LABEL_STYLE.dotSize,
                borderRadius: '50%',
                background: LABEL_STYLE.dotColor,
              }}
            />
            <span
              style={{
                fontSize: LABEL_STYLE.fontSize,
                letterSpacing: LABEL_STYLE.letterSpacing,
                color: LABEL_STYLE.color,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {t(labelKey(kind))}
            </span>
            <span style={{ fontSize: 11, color: '#5C4F3F' }}>{stateWord(props, kind, t)}</span>
            {/* 末尾の `›` とピル形状の 2 つで押せることを示す。 */}
            <span style={{ fontSize: 12, color: '#A8A381' }}>›</span>
          </button>
        );
      })}
    </div>
  );
}

function stateWord(
  props: StudyLabelsProps,
  kind: PillKind,
  t: ReturnType<typeof useTranslations<'study'>>,
): string {
  switch (kind) {
    case 'jar':
      return t(jarPillStateKey(props.status, props.readiness));
    case 'journal':
      return t('pill_entries', { count: props.entryCount });
    case 'archive':
      return t('pill_volumes', { count: props.volumeCount });
    case 'board':
      return t('pill_cards', { count: props.cardCount });
  }
}

function labelKey(
  kind: LabelKind,
): 'label_jar' | 'label_journal' | 'label_board' | 'label_archive' | 'label_pen' {
  switch (kind) {
    case 'jar':
      return 'label_jar';
    case 'journal':
      return 'label_journal';
    case 'board':
      return 'label_board';
    case 'archive':
      return 'label_archive';
    case 'pen':
      return 'label_pen';
  }
}

/**
 * ラベルを押したときの行き先。
 *
 * **3D の物本体を押したときと同じ行き先**にする（40-acceptance.md「SP のタッチ提示」）。
 * ENTRIES は当月の手帳（積みのいちばん上）＝新規執筆、ARCHIVE は棚ごと＝全月の一覧。
 */
function targetFor(kind: PillKind): StudyTarget {
  switch (kind) {
    case 'jar':
      return { kind: 'jar' };
    case 'journal':
      return { kind: 'journal-new' };
    case 'board':
      return { kind: 'board' };
    case 'archive':
      return { kind: 'archive' };
  }
}
