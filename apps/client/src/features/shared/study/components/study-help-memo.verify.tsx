/**
 * StudyHelpMemo の検証スペック。
 *
 * 書斎から公開サイトへ出ていく唯一の導線なので、守るのは
 * 「**3 つの行き先がすべて本物のリンクとして並ぶ**」こと、「別ドメインへ新しいタブで
 * 出る」こと、「訳された言葉が出る」こと、そして「紙の外は指やカーソルを奪わない」こと。
 * 尺（寄り引きで大きくなる）は純関数 `memoScale` のテストが守る。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { MEMO_BASE_PX_PER_UNIT, MEMO_LINKS } from '../help-memo';
import { StudyHelpMemo } from './study-help-memo';

interface Props {
  point: { x: number; y: number; visible: boolean; pxPerUnit: number } | null;
  surface: 'wall' | 'desk';
}

const AT = { x: 180, y: 150, visible: true };

registerUnit<Props>({
  id: 'StudyHelpMemo',
  title: 'StudyHelpMemo',
  description: '壁にテープで貼ったメモ。ヘルプ・お問い合わせ・Docs への導線',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '360px', height: '300px' }}>
        <StudyHelpMemo {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'wall',
      description: '壁に貼った紙（PC・ホーム位置・等倍）',
      props: { point: { ...AT, pxPerUnit: MEMO_BASE_PX_PER_UNIT }, surface: 'wall' },
    },
    {
      id: 'wall-zoomed',
      description: '寄ったとき（紙が大きくなる）',
      props: { point: { ...AT, pxPerUnit: MEMO_BASE_PX_PER_UNIT * 1.8 }, surface: 'wall' },
    },
    {
      id: 'desk',
      description: '机に置いた紙（SP・名前だけ・寝かせる）',
      props: { point: { ...AT, pxPerUnit: MEMO_BASE_PX_PER_UNIT * 0.9 }, surface: 'desk' },
    },
    {
      id: 'hidden',
      probe: true,
      description: 'Probe: サブ画面・遷移中（null）では何も出ない',
      props: { point: null, surface: 'wall' },
    },
    {
      id: 'behind-camera',
      probe: true,
      description: 'Probe: カメラの後ろに回ったら出ない',
      props: {
        point: { ...AT, visible: false, pxPerUnit: MEMO_BASE_PX_PER_UNIT },
        surface: 'desk',
      },
    },
  ],
  invariants: [
    {
      id: 'hidden-when-absent',
      description: '位置が無い・見えないときは紙を描かない（層と契約だけ残す）',
      check: ({ root, props }) => {
        const layer = root.querySelector('[data-verify-unit="StudyHelpMemo"]');
        const paper = root.querySelector('[data-memo-paper]');
        const shouldShow = props.point?.visible === true;
        if (layer?.getAttribute('data-verify-visible') !== String(shouldShow)) {
          return '契約の visible が実際と食い違う';
        }
        if (shouldShow) return paper !== null || '紙が出ていない';
        return paper === null || '出すべきでないときに紙が出ている';
      },
    },
    {
      id: 'lists-every-destination',
      description: '3 つの行き先がすべて本物のリンクとして並ぶ',
      check: ({ root, props }) => {
        if (props.point === null || !props.point.visible) return true;
        const links = root.querySelectorAll('a[data-memo-link]');
        if (links.length !== MEMO_LINKS.length) {
          return `リンクが ${links.length} 本（${MEMO_LINKS.length} 本のはず）`;
        }
        for (const link of links) {
          if (!(link instanceof HTMLAnchorElement)) return 'a 要素ではない';
          if (!link.href.startsWith('http')) return `絶対 URL でない: ${link.href}`;
        }
        return true;
      },
    },
    {
      id: 'opens-in-new-tab',
      description: '別ドメインへは新しいタブで出る（書斎を閉じない）',
      check: ({ root, props }) => {
        if (props.point === null || !props.point.visible) return true;
        for (const link of root.querySelectorAll('a[data-memo-link]')) {
          if (link.getAttribute('target') !== '_blank') return 'target="_blank" が無い';
          if (!(link.getAttribute('rel') ?? '').includes('noopener')) return 'rel=noopener が無い';
        }
        return true;
      },
    },
    {
      id: 'shows-translated-text',
      description: '訳された言葉を出す（鍵がそのまま見えない）',
      check: ({ root, props }) => {
        if (props.point === null || !props.point.visible) return true;
        const text = root.textContent ?? '';
        if (text.trim().length === 0) return '何も出ていない';
        return !/memo_[a-z_]+/.test(text) || `i18n の鍵がそのまま出ている: ${text}`;
      },
    },
    {
      id: 'only-the-paper-takes-the-pointer',
      description: '紙の外は指やカーソルを奪わない（下の 3D を触り続けられる）',
      check: ({ root, props }) => {
        if (props.point === null || !props.point.visible) return true;
        const layer = root.querySelector('[data-verify-unit="StudyHelpMemo"]');
        const paper = root.querySelector('[data-memo-paper]');
        if (!(layer instanceof HTMLElement) || !(paper instanceof HTMLElement)) return '紙が無い';
        if (!layer.className.includes('pointer-events-none')) return '層が当たりを奪う';
        return paper.className.includes('pointer-events-auto') || '紙が押せない';
      },
    },
    {
      id: 'tape-only-on-the-wall',
      description: 'テープは壁の紙にだけ（置いた紙は留めない）。机の紙は寝かせる',
      check: ({ root, props }) => {
        if (props.point === null || !props.point.visible) return true;
        const tape = root.querySelector('[data-memo-tape]');
        const frame = root.querySelector('[data-memo-paper]')?.parentElement;
        if (!(frame instanceof HTMLElement)) return '紙の枠が無い';
        const lying = frame.style.transform.includes('rotateX(');
        if (props.surface === 'wall') {
          if (tape === null) return '壁の紙にテープが無い';
          return !lying || '壁の紙が寝ている';
        }
        if (tape !== null) return '置いた紙にテープが付いている';
        return lying || '机の紙が立っている（rotateX が無い）';
      },
    },
    {
      id: 'scales-with-distance',
      description: '寄ると紙が大きくなる（注釈ではなく壁の紙）',
      check: ({ root, props }) => {
        if (props.point === null || !props.point.visible) return true;
        const paper = root.querySelector('[data-memo-paper]');
        const frame = paper?.parentElement;
        if (!(frame instanceof HTMLElement)) return '紙の枠が無い';
        const match = frame.style.transform.match(/scale\(([\d.]+)\)/);
        if (!match) return `scale() が無い: ${frame.style.transform}`;
        const scale = Number(match[1]);
        const expectedAtLeastOne = props.point.pxPerUnit >= MEMO_BASE_PX_PER_UNIT;
        return expectedAtLeastOne ? scale >= 1 || `寄ったのに縮んでいる: ${scale}` : true;
      },
    },
  ],
});
