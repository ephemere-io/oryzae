/**
 * DraggableJarElement の検証スペック（A 移植）。
 *
 * ドラッグの計測・閾値・clamp は useJarDrag（フック）の責務。このコンポーネント自身の責務は
 * props → インラインスタイルへの写像（x/y → left/top%、enabled → cursor / ドラッグ操作の可否）。
 * その写像だけを契約↔DOM で検証する（フックのドラッグ自体は検証対象外）。
 *
 * ドラッグの act fixture は作らない: useJarDrag.onPointerDown は
 * getBoundingClientRect().width === 0 で早期 return するため、jsdom（rect 全0）では
 * ドラッグが no-op になり isDragging が常に false になる（観測不能）。静的 fixture のみ。
 *
 * children は非インタラクティブ（テキスト/div）に限定する。button/img/input を子に置くと
 * a11y verifier がアクセシブルネーム/alt を要求して落ちるため。
 */

import { registerUnit } from '@oryzae/verify';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { DraggableJarElement } from './draggable-jar-element';

interface Props {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  x: number;
  y: number;
  onClickWithoutDrag: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const noop = () => {};
const nullRef: RefObject<HTMLElement | null> = { current: null };

registerUnit<Props>({
  id: 'DraggableJarElement',
  title: 'DraggableJarElement',
  description:
    'Jar ビューの要素を絶対配置でドラッグ可能にするラッパー（位置/カーソルを props から写像）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<DraggableJarElement {...props} />),
  fixtures: [
    {
      id: 'enabled',
      description: 'ドラッグ可能（中央付近に配置・grab カーソル）',
      props: {
        containerRef: nullRef,
        enabled: true,
        x: 40,
        y: 60,
        onClickWithoutDrag: noop,
        onDragMove: noop,
        onDragEnd: noop,
        children: 'jar element',
      },
    },
    {
      id: 'disabled',
      description: 'ドラッグ不可（caller の curs:pointer が活き、grab にならない）',
      props: {
        containerRef: nullRef,
        enabled: false,
        x: 10,
        y: 20,
        onClickWithoutDrag: noop,
        onDragMove: noop,
        onDragEnd: noop,
        style: { cursor: 'pointer' },
        children: 'jar element',
      },
    },
    {
      id: 'out-of-range',
      probe: true,
      description:
        'Probe: 範囲外の x/y はそのまま left/top% に流れる（clamp はフックの責務でここではしない）',
      props: {
        containerRef: nullRef,
        enabled: true,
        x: 120,
        y: -10,
        onClickWithoutDrag: noop,
        onDragMove: noop,
        onDragEnd: noop,
        children: 'jar element',
      },
    },
  ],
  invariants: [
    {
      id: 'position-contract-matches-props',
      description: 'data-verify-x / data-verify-y が props.x / props.y と一致する',
      check: ({ contract, props }) =>
        (contract.x === String(props.x) && contract.y === String(props.y)) ||
        `position 契約不一致: props=(${props.x},${props.y}) → contract=(${contract.x},${contract.y})`,
    },
    {
      id: 'enabled-contract-matches-props',
      description: 'data-verify-enabled が props.enabled と一致する',
      check: ({ contract, props }) =>
        contract.enabled === String(props.enabled) ||
        `enabled 契約不一致: props.enabled=${props.enabled} → contract.enabled=${contract.enabled}`,
    },
    {
      id: 'inline-position-matches-contract',
      description: 'インライン style.left/top が x/y% として書き込まれる',
      check: ({ root, contract }) => {
        const el = root.querySelector<HTMLElement>('[data-verify-unit="DraggableJarElement"]');
        const left = el?.style.left;
        const top = el?.style.top;
        return (
          (left === `${contract.x}%` && top === `${contract.y}%`) ||
          `style 位置不一致: left=${left}, top=${top} だが contract=(${contract.x}%, ${contract.y}%)`
        );
      },
    },
    {
      id: 'cursor-affordance-follows-enabled',
      description:
        'enabled なら cursor=grab、disabled なら grab ではない（ドラッグ可否の見た目が一致）',
      check: ({ root, contract }) => {
        const el = root.querySelector<HTMLElement>('[data-verify-unit="DraggableJarElement"]');
        const cursor = el?.style.cursor;
        const isEnabled = contract.enabled === 'true';
        if (isEnabled) {
          return cursor === 'grab' || `enabled なのに cursor=${cursor}（grab であるべき）`;
        }
        return cursor !== 'grab' || `disabled なのに cursor=grab（grab であってはならない）`;
      },
    },
  ],
});
