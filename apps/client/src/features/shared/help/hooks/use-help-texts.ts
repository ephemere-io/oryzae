'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { HELP_TOPICS } from '../topics';
import type { HelpTopicText } from '../types';

/** 鍵語の区切り。日本語の読点でも英語のカンマでもよい。 */
const KEYWORD_SEPARATOR = /[,、，]/;

/** i18n の `help.topics.<id>` を、話題の文面の配列にする。 */
export function helpTextsFrom(t: (key: string) => string): HelpTopicText[] {
  return HELP_TOPICS.map(({ id }) => ({
    id,
    title: t(`${id}.title`),
    lead: t(`${id}.lead`),
    body: t(`${id}.body`),
    keywords: t(`${id}.keywords`)
      .split(KEYWORD_SEPARATOR)
      .map((word) => word.trim())
      .filter((word) => word.length > 0),
  }));
}

/** いまの言語の話題の文面。言語が変わったときだけ作り直す。 */
export function useHelpTexts(): HelpTopicText[] {
  const t = useTranslations('help.topics');
  return useMemo(() => helpTextsFrom(t), [t]);
}
