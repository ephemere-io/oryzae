/**
 * 手元の照合（`docs/help-mode-guide.md`「検索」）。
 *
 * 書いた「したいこと」と、触れている項目の名前を、話題の文面に当てる。**Jev が無くても
 * これだけで動く**のが前提で、Jev は「手元で決めきれない問い」を補うだけ。
 *
 * 日本語・中国語・韓国語は分かち書きが無いので、語ではなく **2 文字の並び（bigram）**で
 * 重ねる。英語は空白で切った語。両方を同じ土俵に乗せるために、照合の対象（題・一言・
 * 本文・鍵語）も同じ手順で刻む。
 */

import type { HelpMatch, HelpTopicText } from './types';

/** 鍵語に当たったときの重み。題は次点、一言と本文は薄く。 */
const WEIGHT = { keyword: 3, title: 2, lead: 1, body: 0.5 } as const;

/**
 * 問いがそのまま鍵語か題に一致したときの上乗せ。
 *
 * 「瓶」と書いたら瓶の話題が先に来てほしいが、単位の重なりだけでは「瓶に漬ける」
 * （鍵語にも題にも「瓶」を含む）と同点になる。丸ごと一致は別格に扱う。
 */
const EXACT_BONUS = 4;

/** これ未満は「当たっていない」。1 文字の偶然の一致を拾わない。 */
const MIN_SCORE = 2;

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** 1 文字でも意味を持つ文字（漢字・ハングル）。仮名 1 文字（「の」「を」）は拾わない。 */
const SOLID = /^[\p{Script=Han}\p{Script=Hangul}]$/u;

/**
 * 文字列を照合の単位に刻む。
 *
 * - 英数の語（空白・記号区切り、小文字）
 * - CJK の 2 文字並び。1 文字の語（「瓶」「板」）も拾えるよう、漢字・ハングルの 1 文字も足す
 *   （仮名 1 文字は助詞と重なるので足さない）
 */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const out = new Set<string>();
  for (const word of lower.split(/[^\p{L}\p{N}]+/u)) {
    if (word.length === 0) continue;
    if (!CJK.test(word)) {
      out.add(word);
      continue;
    }
    const chars = [...word];
    for (const ch of chars) if (SOLID.test(ch)) out.add(ch);
    for (let i = 0; i + 1 < chars.length; i++) out.add(chars[i] + chars[i + 1]);
  }
  return [...out];
}

/** 照合される側は一度刻んで持っておく（話題は 15 件、入力のたびに刻み直さない）。 */
export interface HelpCorpusEntry {
  id: HelpTopicText['id'];
  /** 鍵語と題そのもの（小文字）。丸ごと一致を見る。 */
  exact: Set<string>;
  keyword: Set<string>;
  title: Set<string>;
  lead: Set<string>;
  body: Set<string>;
}

export function buildCorpus(texts: readonly HelpTopicText[]): HelpCorpusEntry[] {
  return texts.map((t) => ({
    id: t.id,
    exact: new Set([t.title, ...t.keywords].map((s) => s.trim().toLowerCase())),
    keyword: new Set(t.keywords.flatMap(tokenize)),
    title: new Set(tokenize(t.title)),
    lead: new Set(tokenize(t.lead)),
    body: new Set(tokenize(t.body)),
  }));
}

/**
 * 問いに近い話題を、近い順に。
 *
 * 1 文字の単位は重ねやすい（「の」「を」が本文に必ずある）ので、**1 文字は鍵語と題にだけ
 * 効かせる**。一言・本文は 2 文字以上の単位だけで見る。
 */
export function rankTopics(query: string, corpus: readonly HelpCorpusEntry[]): HelpMatch[] {
  const units = tokenize(query);
  if (units.length === 0) return [];
  const whole = query.trim().toLowerCase();
  const matches: HelpMatch[] = [];
  for (const entry of corpus) {
    let score = entry.exact.has(whole) ? EXACT_BONUS : 0;
    for (const unit of units) {
      if (entry.keyword.has(unit)) score += WEIGHT.keyword;
      if (entry.title.has(unit)) score += WEIGHT.title;
      if (unit.length < 2) continue;
      if (entry.lead.has(unit)) score += WEIGHT.lead;
      if (entry.body.has(unit)) score += WEIGHT.body;
    }
    if (score >= MIN_SCORE) matches.push({ id: entry.id, score, source: 'local' });
  }
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * 手元の照合だけで決めてよいか。
 *
 * 1 位が 2 位を十分に引き離していれば、Jev に訊く必要は無い。並んでいるとき
 * （「書く」と「一覧」が同点、など）だけ外へ出す。
 */
export function isDecisive(matches: readonly HelpMatch[]): boolean {
  const [first, second] = matches;
  if (!first) return false;
  if (!second) return first.score >= MIN_SCORE * 2;
  return first.score >= second.score * 1.5 && first.score >= MIN_SCORE * 2;
}
