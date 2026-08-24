'use client';

import { useTranslations } from 'next-intl';

interface PhotoStripProps {
  urls: string[];
  /** 渡すと各写真に削除ボタンが出る。閲覧専用なら省略する。 */
  onRemove?: (url: string) => void;
}

/**
 * エントリに添えた写真を横並びで見せる。PC / SP どちらの編集画面からも使う。
 *
 * 本文の途中に食い込ませる表示ではなく、本文の下にまとめて並べる段階のもの
 * （経緯と今後は docs/entry-photo-guide.md「いまやっていないこと」を参照）。
 */
export function PhotoStrip({ urls, onRemove }: PhotoStripProps) {
  const t = useTranslations('photo');

  if (urls.length === 0) return null;

  return (
    <ul
      className="flex flex-wrap gap-2 px-4 py-3"
      aria-label={t('attached_label', { count: urls.length })}
    >
      {urls.map((url, index) => (
        <li key={url} className="relative">
          {/* biome-ignore lint/performance/noImgElement: Storage の任意ドメインを next/image の
              loader 設定なしに扱うため。表示サイズが固定の小さなサムネイルで影響も小さい。 */}
          <img
            src={url}
            alt={t('attached_alt', { index: index + 1 })}
            className="h-20 w-20 rounded-md object-cover"
            style={{ border: '1px solid var(--border-subtle)' }}
          />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label={t('remove', { index: index + 1 })}
              className="-right-1.5 -top-1.5 absolute flex h-5 w-5 items-center justify-center rounded-full text-white"
              style={{ background: 'var(--date-color)' }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
