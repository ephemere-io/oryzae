import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { placeBoardCards } from '@/features/shared/study/scene/board';
import { layoutNotebooks } from '@/features/shared/study/scene/books';
import { liquidLevel, placeWords } from '@/features/shared/study/scene/jar';
import type {
  StudyBoard,
  StudyEntry,
  StudyFermentation,
  StudyFermentationStatus,
  StudyState,
} from '@/features/shared/study/types';

/**
 * 仕様が持つ 6 状態のモック（docs/oryzae-study/mock/study-state.presets.json）を
 * StudyState として読めることを確かめる。
 *
 * 型と仕様書のズレは、実装が一巡してから画面で気づく類の齟齬になる。仕様書側の
 * フィクスチャをそのまま食わせておけば、契約が食い違った時点で落ちる。
 */
const PRESETS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../docs/oryzae-study/mock/study-state.presets.json',
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStudyStatus(value: unknown): value is StudyFermentationStatus {
  return value === 'idle' || value === 'fermenting' || value === 'completed';
}

function parseFermentation(raw: unknown): StudyFermentation {
  if (!isRecord(raw)) throw new Error('fermentation is not an object');
  const { readiness, status, letters } = raw;
  if (typeof readiness !== 'number' || readiness < 0 || readiness > 1) {
    throw new Error(`readiness must be 0..1 but got ${String(readiness)}`);
  }
  if (!isStudyStatus(status)) throw new Error(`unknown status ${String(status)}`);
  if (!Array.isArray(letters)) throw new Error('letters must be an array');
  return {
    readiness,
    status,
    letters: letters.filter(isRecord).map((letter) => ({
      questionId: String(letter.questionId ?? ''),
      questionText: typeof letter.questionText === 'string' ? letter.questionText : null,
      fermentationId: String(letter.fermentationId ?? ''),
      createdAt: String(letter.createdAt ?? ''),
    })),
  };
}

function parseEntries(raw: unknown): StudyEntry[] {
  if (!Array.isArray(raw)) throw new Error('entries must be an array');
  return raw.filter(isRecord).map((entry): StudyEntry => {
    const { id, createdAt, excerpt, chars, pickled, linkedQuestions } = entry;
    if (typeof id !== 'string' || typeof createdAt !== 'string') {
      throw new Error('entry.id / createdAt must be strings');
    }
    if (typeof chars !== 'number') throw new Error('entry.chars must be a number');
    return {
      id,
      createdAt,
      excerpt: typeof excerpt === 'string' ? excerpt : '',
      chars,
      pickled: pickled === true,
      linkedQuestions: (Array.isArray(linkedQuestions) ? linkedQuestions : [])
        .filter(isRecord)
        .map((question) => ({
          id: String(question.id ?? ''),
          currentText: typeof question.currentText === 'string' ? question.currentText : null,
        })),
    };
  });
}

function parseBoard(raw: unknown): StudyBoard {
  if (!isRecord(raw)) throw new Error('board is not an object');
  const { dateKey, viewType, cards } = raw;
  if (typeof dateKey !== 'string') throw new Error('board.dateKey must be a string');
  if (viewType !== 'daily' && viewType !== 'weekly') {
    throw new Error(`unknown viewType ${String(viewType)}`);
  }
  if (!Array.isArray(cards)) throw new Error('board.cards must be an array');
  return {
    dateKey,
    viewType,
    cards: cards.filter(isRecord).map((card) => {
      const cardType = card.cardType === 'photo' ? 'photo' : 'snippet';
      return {
        id: String(card.id ?? ''),
        cardType,
        x: Number(card.x ?? 0),
        y: Number(card.y ?? 0),
        rotation: Number(card.rotation ?? 0),
        width: Number(card.width ?? 0),
        height: Number(card.height ?? 0),
        zIndex: Number(card.zIndex ?? 0),
        lines: Number(card.lines ?? 1),
      };
    }),
  };
}

function parsePreset(raw: unknown): StudyState {
  if (!isRecord(raw)) throw new Error('preset is not an object');
  const { now, unreadCount, words, notebooks } = raw;
  if (typeof now !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(now)) {
    throw new Error(`now must be YYYY-MM-DD but got ${String(now)}`);
  }
  if (typeof unreadCount !== 'number') throw new Error('unreadCount must be a number');
  if (!Array.isArray(words)) throw new Error('words must be an array');
  if (!Array.isArray(notebooks)) throw new Error('notebooks must be an array');

  return {
    now,
    unreadCount,
    fermentation: parseFermentation(raw.fermentation),
    words: words.map((word) => String(word)),
    notebooks: notebooks.filter(isRecord).map((notebook) => ({
      month: String(notebook.month ?? ''),
      entryCount: Number(notebook.entryCount ?? 0),
      current: notebook.current === true,
    })),
    entries: parseEntries(raw.entries),
    board: parseBoard(raw.board),
  };
}

function loadPresets(): Map<string, StudyState> {
  const parsed: unknown = JSON.parse(readFileSync(PRESETS_PATH, 'utf8'));
  if (!isRecord(parsed)) throw new Error('presets file is not an object');
  const presets = new Map<string, StudyState>();
  for (const [name, raw] of Object.entries(parsed)) {
    presets.set(name, parsePreset(raw));
  }
  return presets;
}

const PRESETS = loadPresets();
const PRESET_NAMES = [...PRESETS.keys()];

describe('仕様のモック 6 状態', () => {
  it('6 つそろっている', () => {
    expect(PRESET_NAMES).toEqual([
      'empty',
      'starting',
      'fermenting',
      'almost',
      'completed',
      'accumulated',
    ]);
  });

  it.each(PRESET_NAMES)('%s が StudyState として読める', (name) => {
    expect(PRESETS.get(name)).toBeDefined();
  });

  it('readiness が状態の名前どおりに並ぶ', () => {
    const readinessOf = (name: string) => PRESETS.get(name)?.fermentation.readiness ?? -1;
    expect(readinessOf('empty')).toBe(0);
    expect(readinessOf('starting')).toBeLessThan(readinessOf('fermenting'));
    expect(readinessOf('fermenting')).toBeLessThan(readinessOf('almost'));
    expect(readinessOf('almost')).toBeGreaterThanOrEqual(0.9);
    expect(readinessOf('completed')).toBe(1);
  });

  it('completed だけが手紙を持つ', () => {
    for (const [name, state] of PRESETS) {
      const hasLetters = state.fermentation.letters.length > 0;
      expect(hasLetters, name).toBe(state.fermentation.status === 'completed');
    }
  });

  it('empty は何も持たない', () => {
    const empty = PRESETS.get('empty');
    expect(empty?.notebooks).toEqual([]);
    expect(empty?.entries).toEqual([]);
    expect(empty?.board.cards).toEqual([]);
  });
});

describe('モックをシーンの計算に通す', () => {
  it.each(PRESET_NAMES)('%s: 机に必ず 1 冊以上ある（ペンだけにならない）', (name) => {
    const state = PRESETS.get(name);
    if (!state) throw new Error(`missing preset ${name}`);
    const { desk } = layoutNotebooks(state.notebooks, state.now);
    expect(desk.length).toBeGreaterThanOrEqual(1);
  });

  it.each(PRESET_NAMES)('%s: 漂う言葉が重ならない', (name) => {
    const state = PRESETS.get(name);
    if (!state) throw new Error(`missing preset ${name}`);
    const placements = placeWords(state.words, liquidLevel(state.fermentation.readiness));
    for (let i = 1; i < placements.length; i++) {
      expect(placements[i].y).toBeGreaterThan(placements[i - 1].y);
    }
  });

  it.each(PRESET_NAMES)('%s: ボードのカードが板に収まる', (name) => {
    const state = PRESETS.get(name);
    if (!state) throw new Error(`missing preset ${name}`);
    for (const placed of placeBoardCards(state.board.cards)) {
      expect(Number.isFinite(placed.x)).toBe(true);
      expect(Math.abs(placed.x) + placed.width / 2).toBeLessThanOrEqual(4);
    }
  });

  it('accumulated は棚に背表紙が並ぶ', () => {
    const state = PRESETS.get('accumulated');
    if (!state) throw new Error('missing preset');
    const { shelf } = layoutNotebooks(state.notebooks, state.now);
    expect(shelf.length).toBeGreaterThan(0);
  });
});
