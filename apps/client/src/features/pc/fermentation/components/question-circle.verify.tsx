/**
 * QuestionCircle の検証スペック（A 移植）。
 * Jar ビューの問い円。props だけで孤立描画でき（data 取得・router・Selection に非依存）、
 * getBoundingClientRect は useJarDrag のポインタハンドラ内だけ（描画時には走らない）ので
 * jsdom でも安全に描画できる。zoomed / hasData / 描画済み要素数を DOM 契約として公表し、
 * 「zoomed と role=button/aria-label の整合」「契約↔描画(slice 上限)の一致」を検証する。
 * detail=null や非 completed でも円自体は描画される（null 返しの分岐は無い）ので、
 * その状態も fixture に含める。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionCircle } from './question-circle';

type Pos = { jarX: number; jarY: number };

interface Props {
  questionId: string;
  questionText: string;
  detail: FermentationDetail | null;
  zoomed: boolean;
  hidden?: boolean;
  innerOverrides: {
    keywords: Record<string, Pos>;
    snippets: Record<string, Pos>;
    letters: Record<string, Pos>;
  };
  onElementClick: (type: 'keyword' | 'snippet' | 'letter', data: Record<string, string>) => void;
  onInnerDragMove: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    x: number,
    y: number,
  ) => void;
  onInnerDragEnd: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    x: number,
    y: number,
  ) => void;
  circlePointerHandlers: {
    onPointerDown: () => void;
    onPointerMove: () => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onClick: () => void;
  };
  onActivate: () => void;
  isDraggingCircle: boolean;
  style?: React.CSSProperties;
}

const noop = () => {};
const noPointerHandlers = {
  onPointerDown: noop,
  onPointerMove: noop,
  onPointerUp: noop,
  onPointerCancel: noop,
  onClick: noop,
};
const emptyOverrides = { keywords: {}, snippets: {}, letters: {} };

function makeKeyword(i: number) {
  return {
    id: `kw-${i}`,
    keyword: `キーワード${i}`,
    description: `説明${i}`,
    jarX: null,
    jarY: null,
  };
}
function makeSnippet(i: number) {
  return {
    id: `sn-${i}`,
    snippetType: 'core' as const,
    originalText: `スニペット本文${i}`,
    sourceDate: '2026-06-01',
    selectionReason: `理由${i}`,
    jarX: null,
    jarY: null,
  };
}

function makeDetail(
  keywordCount: number,
  snippetCount: number,
  withLetter: boolean,
): FermentationDetail {
  return {
    id: 'ferm-1',
    questionId: 'q-1',
    targetPeriod: '2026-06',
    status: 'completed',
    worksheet: null,
    keywords: Array.from({ length: keywordCount }, (_, i) => makeKeyword(i)),
    snippets: Array.from({ length: snippetCount }, (_, i) => makeSnippet(i)),
    letter: withLetter ? { id: 'lt-1', bodyText: '手紙の本文', jarX: null, jarY: null } : null,
    // Issue #453: 瓶の円は「もとになった記録」を描画しないので、常に空でよい。
    scannedEntries: [],
  };
}

const baseProps: Omit<Props, 'detail' | 'zoomed' | 'hidden'> = {
  questionId: 'q-1',
  questionText: 'この一年で大切にしたいことは？',
  innerOverrides: emptyOverrides,
  onElementClick: noop,
  onInnerDragMove: noop,
  onInnerDragEnd: noop,
  circlePointerHandlers: noPointerHandlers,
  onActivate: noop,
  isDraggingCircle: false,
};

registerUnit<Props>({
  id: 'QuestionCircle',
  title: 'QuestionCircle',
  description: 'Jar ビューの問い円（zoomed / hasData / 描画済み要素数を契約として公表）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<QuestionCircle {...props} />),
  fixtures: [
    {
      id: 'empty',
      description: 'データ未生成（detail=null）。円は描画され、空状態の微生物が浮かぶ',
      props: { ...baseProps, detail: null, zoomed: false },
    },
    {
      id: 'pending',
      description: '生成中（status!=completed）。hasData=false で空状態扱い',
      props: {
        ...baseProps,
        detail: { ...makeDetail(3, 2, true), status: 'processing' },
        zoomed: false,
      },
    },
    {
      id: 'completed',
      description: '生成済み（keyword3 / snippet2 / letter あり・未ズーム）',
      props: { ...baseProps, detail: makeDetail(3, 2, true), zoomed: false },
    },
    {
      id: 'zoomed',
      description: 'ズーム表示（操作可能・role=button にはならない）',
      props: { ...baseProps, detail: makeDetail(3, 2, true), zoomed: true },
    },
    {
      id: 'overflow',
      probe: true,
      description: 'Probe: keyword8 / snippet6 でも描画は slice 上限（kw5 / sn3）で頭打ち',
      props: { ...baseProps, detail: makeDetail(8, 6, true), zoomed: true },
    },
  ],
  invariants: [
    {
      id: 'role-matches-zoomed',
      description:
        '未ズーム時のみ role=button + tabIndex=0 + 非空 aria-label を持ち、ズーム時は role なし',
      check: ({ root, contract }) => {
        const el = root.querySelector('[data-verify-unit="QuestionCircle"]');
        if (!el) return 'QuestionCircle のルート要素が見つからない';
        const isZoomed = contract.zoomed === 'true';
        if (isZoomed) {
          return (
            el.getAttribute('role') === null ||
            `ズーム時は role を外すべき: role=${el.getAttribute('role')}`
          );
        }
        const role = el.getAttribute('role');
        const tabIndex = el.getAttribute('tabindex');
        const label = el.getAttribute('aria-label')?.trim() ?? '';
        return (
          (role === 'button' && tabIndex === '0' && label.length > 0) ||
          `未ズーム時の操作要素契約が不一致: role=${role}, tabindex=${tabIndex}, aria-label="${label}"`
        );
      },
    },
    {
      id: 'keyword-count-matches-rendered',
      description: 'data-verify-keyword-count が実際に描画された keyword チップ数と一致する',
      check: ({ root, contract }) => {
        const rendered = root.querySelectorAll('.j2-float-1, .j2-float-2, .j2-float-3').length;
        // 空状態でも EMPTY_MICROBE_POSITIONS が同じ float クラスを使うため、
        // hasData の時だけ厳密一致を要求する。
        if (contract.hasData !== 'true') return true;
        const expected =
          Number(contract.keywordCount) +
          Number(contract.snippetCount) +
          (contract.hasLetter === 'true' ? 1 : 0);
        return (
          rendered === expected ||
          `描画要素数=${rendered} が契約合計=${expected}（kw${contract.keywordCount}+sn${contract.snippetCount}+letter${contract.hasLetter}）と不一致`
        );
      },
    },
    {
      id: 'counts-capped',
      description: 'keywordCount<=5 かつ snippetCount<=3（slice 上限を超えない）',
      check: ({ contract }) => {
        const kw = Number(contract.keywordCount);
        const sn = Number(contract.snippetCount);
        return (
          (kw <= 5 && sn <= 3) ||
          `契約が slice 上限を超過: keywordCount=${contract.keywordCount}, snippetCount=${contract.snippetCount}`
        );
      },
    },
    {
      id: 'overflow-capped-at-limit',
      description: 'Probe: keyword8 / snippet6 入力でも契約は kw5 / sn3 で頭打ち',
      onlyFixtures: ['overflow'],
      check: ({ contract }) =>
        (contract.keywordCount === '5' && contract.snippetCount === '3') ||
        `上限頭打ちが効いていない: keywordCount=${contract.keywordCount}, snippetCount=${contract.snippetCount}`,
    },
  ],
});
