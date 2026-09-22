/**
 * TypeSafe AI の System One モデル（Jev）に、ヘルプの話題を選ばせる。
 *
 * Jev は文章を生成しない。**状態（state）と型付きの問い（questions）を渡すと、選択肢から
 * 1 つ選んで確からしさを返す**モデル（https://typesafe.ai/blog/introducing-system-one-models-and-jev）。
 * ヘルプの検索欄に書かれた「したいこと」を、用意してある話題のどれかへ振り分ける
 * （intent routing）のに向いている。説明の文面はこちらが持つので、モデルが勝手な
 * 使い方を語ることは無い。
 *
 * - `TYPESAFE_API_KEY` が無ければ何もしない（`configured: false`）。手元の照合だけで動く
 * - 失敗しても投げない。ヘルプは本筋ではなく、落ちても手元の照合が残る
 * - **問いの本文をログに載せない。** 日記そのものではないが、人が書いた文である
 * - 話題の選択肢はクライアントが送る（文面の正は i18n にあり、ここで二重に持たない）
 */

import type { HelpSearchInput } from '@oryzae/shared';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
/** 返事が遅いなら手元の照合で済ませる。ヘルプの検索が 4 秒待つ価値は無い。 */
const TIMEOUT_MS = 4000;

const INSTRUCTIONS =
  'The user is inside Oryzae, a journaling app where you plant a question, write entries, ' +
  'pickle them in a jar and receive a letter after fermentation. They typed what they want ' +
  'to do or what they are confused about. Choose the single help topic that best explains ' +
  'how to do it in this app.';

export interface HelpRouteAnswer {
  configured: boolean;
  topicId: string | null;
  confidence: number;
}

const NOT_CONFIGURED: HelpRouteAnswer = { configured: false, topicId: null, confidence: 0 };
const NO_ANSWER: HelpRouteAnswer = { configured: true, topicId: null, confidence: 0 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 返事から選ばれた話題と確からしさを読む。形が違えば「答え無し」。
 *
 * `answers.topic.choice` が選択肢、`confidence` が 0〜1。`confidence` が無いときは
 * `probabilities` の最大値で代える。選択肢に無い id が返っても採らない。
 */
export function parseSystemOneAnswer(
  json: unknown,
  ids: ReadonlySet<string>,
): { topicId: string | null; confidence: number } {
  if (!isRecord(json) || !isRecord(json.answers) || !isRecord(json.answers.topic)) {
    return { topicId: null, confidence: 0 };
  }
  const answer = json.answers.topic;
  const choice = typeof answer.choice === 'string' && ids.has(answer.choice) ? answer.choice : null;
  if (choice === null) return { topicId: null, confidence: 0 };

  let confidence = typeof answer.confidence === 'number' ? answer.confidence : Number.NaN;
  if (!Number.isFinite(confidence) && isRecord(answer.probabilities)) {
    const chosen = answer.probabilities[choice];
    confidence = typeof chosen === 'number' ? chosen : Number.NaN;
  }
  if (!Number.isFinite(confidence)) confidence = 0;
  return { topicId: choice, confidence: Math.min(1, Math.max(0, confidence)) };
}

export async function routeHelpTopic(input: HelpSearchInput): Promise<HelpRouteAnswer> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return NOT_CONFIGURED;

  // 話題 id は `[a-z_]` なので `__proto__` や `constructor` も通る。素の `{}` に代入すると
  // `__proto__` は自前のキーにならず（setter に食われる）、選択肢から静かに消える。
  // 原型の無いオブジェクトなら、どの id もただのキーになる。
  const options: Record<string, string> = Object.create(null);
  for (const topic of input.topics) options[topic.id] = topic.label;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        state: { user_request: input.query, screen: input.screen, language: input.locale },
        questions: { topic: { type: 'choice', instructions: INSTRUCTIONS, options } },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[help-search] systemone responded with non-OK status', {
        status: res.status,
      });
      return NO_ANSWER;
    }
    return {
      configured: true,
      ...parseSystemOneAnswer(await res.json(), new Set(Object.keys(options))),
    };
  } catch (error) {
    // 例外の文言は載せない。fetch の実装や中間層が要求本文（問いの文）を文言に含めても、
    // ここから先へは種類だけを渡す。時間切れ（自分で abort した）は区別しておく。
    const reason = controller.signal.aborted
      ? 'timeout'
      : error instanceof Error
        ? error.name
        : 'unknown';
    console.error('[help-search] systemone request failed', { reason });
    return NO_ANSWER;
  } finally {
    clearTimeout(timer);
  }
}
