'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';
import { isObject, readJson } from '@/lib/json';
import { buildCorpus, isDecisive, rankTopics } from '../search';
import { isHelpTopicId } from '../topics';
import type {
  HelpMatch,
  HelpRemoteState,
  HelpResolution,
  HelpResolverInput,
  HelpRouteResult,
  HelpTopicId,
} from '../types';

/** Jev の答えを採る下限。これ未満は「分からない」と同じに扱う。 */
const CONFIDENCE_MIN = 0.5;
/** 打っている最中に送らない。 */
const QUERY_DEBOUNCE_MS = 350;
/** ポインタが止まってから訊く。通り過ぎるだけの部品では訊かない。 */
const LABEL_DEBOUNCE_MS = 300;
/** これより短い問いは手元だけで見る。 */
const REMOTE_MIN_LENGTH = 2;

function readRouteResult(json: unknown): HelpRouteResult | null {
  if (!isObject(json) || typeof json.configured !== 'boolean') return null;
  const topicId = isHelpTopicId(json.topicId) ? json.topicId : null;
  const confidence = typeof json.confidence === 'number' ? json.confidence : 0;
  return { configured: json.configured, topicId, confidence };
}

/**
 * 「したいこと」と「触れているもの」を話題に変える。
 *
 * **手元の照合が先。** 決めきれたら Jev には訊かない（速いし、外に出す文も減る）。
 * 並んでいるときだけサーバー（`POST /api/v1/help/search`）へ回し、確からしさが
 * `CONFIDENCE_MIN` 以上なら先頭に置く。サーバーが「Jev は未設定」と言えば、以後は
 * 訊かない（`remote: 'off'`）。同じ問いは憶えておく。
 */
export function useHelpResolver(api: ApiClient | null, input: HelpResolverInput): HelpResolution {
  const { locale, screen, texts, query, label, labelFallback } = input;
  const corpus = useMemo(() => buildCorpus(texts), [texts]);
  const local = useMemo(() => rankTopics(query, corpus), [query, corpus]);

  const [remote, setRemote] = useState<HelpRemoteState>(api ? 'idle' : 'off');
  const [queryPick, setQueryPick] = useState<{ query: string; topic: HelpTopicId } | null>(null);
  const [labelPick, setLabelPick] = useState<{ label: string; topic: HelpTopicId } | null>(null);
  const cache = useRef(new Map<string, HelpRouteResult>());
  const configured = useRef<boolean | null>(null);

  const topicsPayload = useMemo(
    () => texts.map((t) => ({ id: t.id, label: `${t.title} — ${t.lead}` })),
    [texts],
  );

  // api が無ければ手元だけ。
  useEffect(() => {
    if (!api) setRemote('off');
  }, [api]);

  /** サーバーに訊く。憶えていればそれを返す。null は「答え無し」。 */
  const ask = useCallback(
    async (text: string): Promise<HelpTopicId | null> => {
      if (!api || configured.current === false) return null;
      const key = `${locale}|${screen}|${text}`;
      let result = cache.current.get(key) ?? null;
      if (result === null) {
        setRemote('asking');
        try {
          const res = await api.fetch('/api/v1/help/search', {
            method: 'POST',
            body: JSON.stringify({ query: text, screen, locale, topics: topicsPayload }),
          });
          result = res.ok ? readRouteResult(await readJson(res)) : null;
        } catch {
          result = null;
        }
        if (result) cache.current.set(key, result);
      }
      // 一度「未設定」と分かれば、以後の問いはすべて手元だけ。
      if (result?.configured === false) {
        configured.current = false;
        setRemote('off');
        return null;
      }
      setRemote('answered');
      if (!result || result.topicId === null || result.confidence < CONFIDENCE_MIN) return null;
      return result.topicId;
    },
    [api, locale, screen, topicsPayload],
  );

  // 検索欄: 手元で決めきれないときだけ、少し待ってから訊く。
  // `remote` を依存に入れない — 訊いた瞬間に 'asking' へ変わり、effect が回り直して
  // 待っていた答えを取り消してしまう。「未設定」は ask の中で見る。
  const trimmed = query.trim();
  const decisive = isDecisive(local);
  useEffect(() => {
    if (trimmed.length < REMOTE_MIN_LENGTH || decisive) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const topic = await ask(trimmed);
      if (!cancelled && topic) setQueryPick({ query: trimmed, topic });
    }, QUERY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, decisive, ask]);

  // 触れている部品の名前: 名乗りが無く、手元でも決まらないときだけ訊く。
  const labelLocal = useMemo(
    () => (label === null ? [] : rankTopics(label, corpus)),
    [label, corpus],
  );
  const labelDecisive = isDecisive(labelLocal);
  useEffect(() => {
    if (label === null || labelDecisive || labelFallback !== null) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const topic = await ask(label);
      if (!cancelled && topic) setLabelPick({ label, topic });
    }, LABEL_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [label, labelDecisive, labelFallback, ask]);

  const matches = useMemo<HelpMatch[]>(() => {
    const pick = queryPick && queryPick.query === trimmed ? queryPick.topic : null;
    if (pick === null) return local;
    return [
      { id: pick, score: Number.POSITIVE_INFINITY, source: 'jev' },
      ...local.filter((m) => m.id !== pick),
    ];
  }, [local, queryPick, trimmed]);

  let labelTopic: HelpTopicId | null = null;
  if (label !== null && labelDecisive) labelTopic = labelLocal[0]?.id ?? null;
  else if (labelFallback !== null) labelTopic = labelFallback;
  else if (label !== null && labelPick && labelPick.label === label) labelTopic = labelPick.topic;

  return { matches, remote, labelTopic };
}
