import { describe, expect, it } from 'vitest';
import {
  BLOCK_INSET,
  COVER_HINGE_X,
  COVER_LABEL,
  COVER_OPEN_ANGLE,
  COVER_THICKNESS,
  EDGE_LINE_JITTER,
  EDGE_LINE_OPACITIES,
  edgeLineCount,
  layoutNotebooks,
  NOTEBOOK_SIZE,
  notebookThickness,
  RULES,
  SPINE_LABEL,
  SPREAD_PAGES,
  STACK_GAP,
  shelfSpineOffsets,
  spineLabelText,
  stackTopY,
  withCurrentNotebook,
} from '@/features/shared/study/scene/books';
import type { Notebook } from '@/features/shared/study/types';

const NOW = '2026-09-02';

function notebook(month: string, entryCount: number): Notebook {
  return { month, entryCount, current: false };
}

describe('notebookThickness', () => {
  it('0 件でも表紙ぶんの厚みがある', () => {
    expect(notebookThickness(0)).toBeGreaterThan(0);
  });

  it('空の冊でも指で押せる厚みがある', () => {
    // 積みの中段・下段が押しにくい、と実機レビューで報告された。当たりの高さは
    // 厚みそのものなので、薄い冊は帯が数 px しか無く、天板の縁と見分けもつかない。
    // 冊 1 つぶんの世界の高さ 0.2 は、PC の構図でおよそ指 1 本ぶんに映る。
    expect(notebookThickness(0)).toBeGreaterThanOrEqual(0.2);
  });

  it('件数に比例して厚くなる', () => {
    expect(notebookThickness(10)).toBeGreaterThan(notebookThickness(0));
    expect(notebookThickness(20)).toBeGreaterThan(notebookThickness(10));
  });

  it('40 件で頭打ちになる（青天井に厚くしない）', () => {
    expect(notebookThickness(400)).toBe(notebookThickness(40));
    expect(notebookThickness(41)).toBe(notebookThickness(40));
  });

  it('積んでも机から溢れない（3 冊ぶんが手帳の奥行きを超えない）', () => {
    // 厚くしすぎると積みが塔になり、真上から寄るカメラの構図が崩れる。
    const tallest = notebookThickness(40) * 3 + STACK_GAP * 2;
    expect(tallest).toBeLessThan(NOTEBOOK_SIZE.depth);
  });

  it('負や小数でも壊れない', () => {
    expect(notebookThickness(-5)).toBe(notebookThickness(0));
    expect(notebookThickness(3.7)).toBe(notebookThickness(3));
  });
});

describe('edgeLineCount', () => {
  it('厚い本ほど罫が多い', () => {
    expect(edgeLineCount(notebookThickness(40))).toBeGreaterThan(
      edgeLineCount(notebookThickness(0)),
    );
  });

  it('薄くても 7 本は下回らない（1〜2 本だと紙束に見えない）', () => {
    expect(edgeLineCount(0)).toBe(7);
    // 空の手帳でも下限に張り付かず、束として読める本数になる。
    expect(edgeLineCount(notebookThickness(0))).toBeGreaterThan(7);
  });

  it('多すぎても 26 本で止める（潰れて黒帯になる）', () => {
    expect(edgeLineCount(10)).toBe(26);
  });

  it('濃度は 2 段で交互（均一だと機械的な縞になる）', () => {
    expect(EDGE_LINE_OPACITIES[0]).not.toBe(EDGE_LINE_OPACITIES[1]);
  });
});

describe('紙の束に見せるための寸法', () => {
  it('束は表紙より小さい（表紙がわずかに出ることで箱に見えない）', () => {
    expect(BLOCK_INSET).toBeGreaterThan(0);
    expect(BLOCK_INSET).toBeLessThan(NOTEBOOK_SIZE.width / 4);
  });

  it('表紙は最も薄い手帳の厚みより薄い（表紙だけの本にならない）', () => {
    expect(COVER_THICKNESS).toBeLessThan(notebookThickness(0));
  });

  it('蝶番が手帳の左端にある（背表紙側）', () => {
    expect(COVER_HINGE_X).toBeLessThan(0);
    expect(Math.abs(COVER_HINGE_X)).toBeLessThanOrEqual(NOTEBOOK_SIZE.width / 2);
  });

  it('表紙は π ちょうどまで開かない（完全に平らだと裏返って見える）', () => {
    expect(COVER_OPEN_ANGLE).toBeLessThan(Math.PI);
    expect(COVER_OPEN_ANGLE).toBeGreaterThan(Math.PI * 0.95);
  });

  it('ページは表紙より浅く開く（表紙を追い越さない）', () => {
    for (let i = 0; i < SPREAD_PAGES.count; i++) {
      expect(SPREAD_PAGES.angleAt(i)).toBeLessThan(COVER_OPEN_ANGLE);
    }
  });

  it('ページは奥ほど浅く開く（束として重なって見える）', () => {
    for (let i = 1; i < SPREAD_PAGES.count; i++) {
      expect(SPREAD_PAGES.angleAt(i)).toBeLessThan(SPREAD_PAGES.angleAt(i - 1));
    }
  });

  it('ページは表紙より薄い', () => {
    expect(SPREAD_PAGES.thickness).toBeLessThan(COVER_THICKNESS);
  });

  it('紙は上からめくる（下からだと上に載っている紙に隠れて 1 枚しか動いて見えない）', () => {
    const count = SPREAD_PAGES.count;
    // 積んだ順は下から 0。いちばん上（count-1）が最初（0 番目）にめくれる。
    expect(SPREAD_PAGES.turnOrderOf(count - 1, count)).toBe(0);
    expect(SPREAD_PAGES.turnOrderOf(0, count)).toBe(count - 1);
  });

  it('めくる順は全部の紙をちょうど 1 回ずつ使う（重なって 1 枚に見えない）', () => {
    const count = SPREAD_PAGES.count;
    const orders = Array.from({ length: count }, (_, i) => SPREAD_PAGES.turnOrderOf(i, count));
    expect([...orders].sort()).toEqual(Array.from({ length: count }, (_, i) => i));
  });

  it('上の紙ほど深く開く（下の紙が上の紙を追い越さない）', () => {
    const count = SPREAD_PAGES.count;
    for (let stackIndex = 1; stackIndex < count; stackIndex++) {
      const upper = SPREAD_PAGES.angleAt(SPREAD_PAGES.turnOrderOf(stackIndex, count));
      const lower = SPREAD_PAGES.angleAt(SPREAD_PAGES.turnOrderOf(stackIndex - 1, count));
      expect(upper).toBeGreaterThan(lower);
    }
  });

  it('紙は束の上に載り、表紙の下に収まる（閉じている間は見えない）', () => {
    const top = SPREAD_PAGES.liftBase + (SPREAD_PAGES.count - 1) * SPREAD_PAGES.gap;
    expect(SPREAD_PAGES.liftBase).toBeGreaterThan(0);
    expect(top + SPREAD_PAGES.thickness).toBeLessThan(COVER_THICKNESS);
  });

  it('紙は表紙より一回り小さい（表紙の下からはみ出さない）', () => {
    expect(SPREAD_PAGES.inset).toBeGreaterThan(0);
    expect(SPREAD_PAGES.inset).toBeLessThan(NOTEBOOK_SIZE.width / 2);
  });

  it('見開きは左右そろっている（片方だけだと開いた先が白紙に見える）', () => {
    // 右の頁＝束の上面、左の頁＝表紙の裏。どちらかが 0 本だと片側が白紙になる。
    expect(RULES.spreadCount).toBeGreaterThan(0);
    expect(RULES.coverInnerCount).toBeGreaterThan(0);
    // 表紙の裏は蝶番のぶん狭いので、右の頁より本数は多くしない。
    expect(RULES.coverInnerCount).toBeLessThanOrEqual(RULES.spreadCount);
  });

  it('表紙のラベルが表紙に収まる', () => {
    expect(COVER_LABEL.width).toBeLessThan(NOTEBOOK_SIZE.width);
    expect(COVER_LABEL.height).toBeLessThan(NOTEBOOK_SIZE.depth);
    expect(COVER_LABEL.opacity).toBeLessThan(1);
  });

  it('見開きの罫が手帳の奥行きに収まる', () => {
    expect(RULES.spreadCount * RULES.spreadSpacing).toBeLessThan(NOTEBOOK_SIZE.depth);
  });

  it('罫の端を不揃いにする（均一だと機械的な縞になる）', () => {
    expect(EDGE_LINE_JITTER).toBeGreaterThan(0);
    // ばらつきが束の厚みを超えると、紙がはみ出して見える。
    expect(EDGE_LINE_JITTER).toBeLessThan(notebookThickness(0));
  });

  it('罫はどれも薄い（線が主張しすぎると紙に見えない）', () => {
    for (const opacity of [
      RULES.foreEdgeOpacity,
      RULES.spreadOpacity,
      RULES.coverInnerOpacity,
      ...EDGE_LINE_OPACITIES,
    ]) {
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(0.4);
    }
  });

  it('背文字が背表紙の厚みに収まる比率になっている', () => {
    expect(SPINE_LABEL.fitRatio).toBeGreaterThan(0);
    expect(SPINE_LABEL.fitRatio).toBeLessThan(1);
    expect(SPINE_LABEL.fontPx).toBeLessThan(SPINE_LABEL.textureHeight);
  });
});

describe('withCurrentNotebook', () => {
  it('記録が 1 件も無くても当月の空の手帳を 1 冊置く', () => {
    // 机にペンだけが残ると新規執筆の入口が消える。
    const result = withCurrentNotebook([], NOW);
    expect(result).toEqual([{ month: '2026-09', entryCount: 0, current: true }]);
  });

  it('当月がすでにあれば足さない', () => {
    const result = withCurrentNotebook([notebook('2026-09', 11)], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].entryCount).toBe(11);
  });

  it('current フラグを月から決め直す（サーバーの値に依存しない）', () => {
    const result = withCurrentNotebook(
      [
        { month: '2026-09', entryCount: 3, current: false },
        { month: '2026-08', entryCount: 4, current: true },
      ],
      NOW,
    );
    expect(result.find((n) => n.month === '2026-09')?.current).toBe(true);
    expect(result.find((n) => n.month === '2026-08')?.current).toBe(false);
  });

  it('過去月しか無いときは当月を足したうえで過去月の current を落とす', () => {
    const result = withCurrentNotebook([{ month: '2026-08', entryCount: 4, current: true }], NOW);
    expect(result).toHaveLength(2);
    expect(result.filter((n) => n.current)).toHaveLength(1);
    expect(result.find((n) => n.current)?.month).toBe('2026-09');
  });
});

describe('layoutNotebooks', () => {
  const MONTHS = [
    notebook('2026-05', 8),
    notebook('2026-09', 11),
    notebook('2026-07', 20),
    notebook('2026-06', 5),
    notebook('2026-08', 14),
  ];

  it('机は当月＋直近 2 ヶ月、棚はそれ以前（直 3 ヶ月）', () => {
    const { desk, shelf } = layoutNotebooks(MONTHS, NOW);
    expect(desk.map((p) => p.notebook.month)).toEqual(['2026-09', '2026-08', '2026-07']);
    expect(shelf.map((n) => n.month)).toEqual(['2026-06', '2026-05']);
  });

  it('机の先頭が当月（一番上に積む）', () => {
    const { desk } = layoutNotebooks(MONTHS, NOW);
    expect(desk[0].notebook.month).toBe('2026-09');
    expect(desk[0].notebook.current).toBe(true);
  });

  it('渡す順序に依存しない', () => {
    const shuffled = layoutNotebooks([...MONTHS].reverse(), NOW);
    const straight = layoutNotebooks(MONTHS, NOW);
    expect(shuffled.desk.map((p) => p.notebook.month)).toEqual(
      straight.desk.map((p) => p.notebook.month),
    );
  });

  it('積みが下から順に高くなり、隙間が空く', () => {
    const { desk } = layoutNotebooks(MONTHS, NOW);
    // desk[0] が一番上なので、下から見ると baseY が増えていく。
    const bottomUp = [...desk].reverse();
    expect(bottomUp[0].baseY).toBe(0);
    for (let i = 1; i < bottomUp.length; i++) {
      const expected = bottomUp[i - 1].baseY + bottomUp[i - 1].thickness + STACK_GAP;
      expect(bottomUp[i].baseY).toBeCloseTo(expected, 10);
    }
  });

  it('厚い月ほど積みの中で高さを取る', () => {
    const { desk } = layoutNotebooks(MONTHS, NOW);
    const july = desk.find((p) => p.notebook.month === '2026-07');
    const september = desk.find((p) => p.notebook.month === '2026-09');
    expect(july?.thickness).toBeGreaterThan(september?.thickness ?? 0);
  });

  it('棚は直 3 ヶ月で打ち切る', () => {
    const many = [
      notebook('2026-09', 1),
      notebook('2026-08', 1),
      notebook('2026-07', 1),
      notebook('2026-06', 1),
      notebook('2026-05', 1),
      notebook('2026-04', 1),
      notebook('2026-03', 1),
    ];
    const { shelf } = layoutNotebooks(many, NOW);
    expect(shelf.map((n) => n.month)).toEqual(['2026-06', '2026-05', '2026-04']);
  });

  it('記録が 0 件でも机に 1 冊だけ置く（押せば新規執筆に入れる）', () => {
    const { desk, shelf } = layoutNotebooks([], NOW);
    expect(desk).toHaveLength(1);
    expect(desk[0].notebook).toEqual({ month: '2026-09', entryCount: 0, current: true });
    expect(shelf).toEqual([]);
  });

  it('月をまたぐと新しい手帳が一番上に積まれる', () => {
    const beforeRollover = layoutNotebooks(MONTHS, '2026-09-30');
    const afterRollover = layoutNotebooks(MONTHS, '2026-10-01');
    expect(beforeRollover.desk[0].notebook.month).toBe('2026-09');
    expect(afterRollover.desk[0].notebook.month).toBe('2026-10');
    expect(afterRollover.desk[0].notebook.entryCount).toBe(0);
    // 4 ヶ月以上前は棚へ移る。
    expect(afterRollover.shelf.map((n) => n.month)).toContain('2026-07');
  });
});

describe('stackTopY', () => {
  it('一番上の冊の上面を返す', () => {
    const { desk } = layoutNotebooks([notebook('2026-09', 0)], NOW);
    expect(stackTopY(desk)).toBeCloseTo(notebookThickness(0), 10);
  });

  it('空の積みでも落ちない', () => {
    expect(stackTopY([])).toBe(0);
  });

  it('積むほど上面が高くなる', () => {
    const one = layoutNotebooks([notebook('2026-09', 0)], NOW);
    const three = layoutNotebooks(
      [notebook('2026-09', 0), notebook('2026-08', 10), notebook('2026-07', 10)],
      NOW,
    );
    expect(stackTopY(three.desk)).toBeGreaterThan(stackTopY(one.desk));
  });
});

describe('shelfSpineOffsets', () => {
  it('冊数ぶんの位置を左右対称に返す', () => {
    const offsets = shelfSpineOffsets(3);
    expect(offsets).toHaveLength(3);
    expect(offsets[0] + offsets[2]).toBeCloseTo(0, 10);
    expect(offsets[1]).toBeCloseTo(0, 10);
  });

  it('冊数が増えても棚の幅に収まる', () => {
    for (const count of [1, 2, 3]) {
      for (const offset of shelfSpineOffsets(count)) {
        expect(Math.abs(offset)).toBeLessThan(2.6 / 2);
      }
    }
  });

  it('0 冊なら空', () => {
    expect(shelfSpineOffsets(0)).toEqual([]);
  });

  it('少ない冊数でも間隔を広げすぎない（上限本数を分母に使う）', () => {
    const two = shelfSpineOffsets(2);
    const three = shelfSpineOffsets(3);
    expect(two[1] - two[0]).toBeCloseTo(three[1] - three[0], 10);
  });
});

describe('spineLabelText', () => {
  it('YYYY-MM を 2026.06 の表記にする', () => {
    expect(spineLabelText('2026-06')).toBe('2026.06');
  });
});
