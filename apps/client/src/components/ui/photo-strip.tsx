'use client';

import { useTranslations } from 'next-intl';

interface PhotoStripProps {
  /**
   * 表示用の URL。private バケットなので署名付きで、失効しうる。
   * 署名できなかった写真は空文字で来る —— **その要素を間引かないこと。**
   * 間引くと index がずれ、削除時に別の写真を消してしまう。
   */
  urls: string[];
  /** 渡すと各写真に削除ボタンが出る。閲覧専用なら省略する。index は urls と対応する。 */
  onRemove?: (index: number) => void;
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
        // biome-ignore lint/suspicious/noArrayIndexKey: 署名失敗の写真は空文字で来るため url は一意にならない。この配列は保存側と 1:1 対応の追記のみで、途中挿入や並べ替えは起きない。
        <li key={`${index}-${url}`} className="relative">
          {url ? (
            // biome-ignore lint/performance/noImgElement: Storage の任意ドメインを next/image の loader 設定なしに扱うため。固定サイズの小さなサムネイルで影響も小さい。
            <img
              src={url}
              alt={t('attached_alt', { index: index + 1 })}
              className="h-20 w-20 rounded-md object-cover"
              style={{ border: '1px solid var(--border-subtle)' }}
            />
          ) : (
            // 署名できなかった写真。枠だけ残して並びを保つ（消すと index がずれる）。
            <div
              role="img"
              aria-label={t('unavailable', { index: index + 1 })}
              className="flex h-20 w-20 items-center justify-center rounded-md text-[10px] leading-tight"
              style={{
                border: '1px dashed var(--border-subtle)',
                color: 'var(--date-color)',
                background: 'var(--toolbar-hover)',
              }}
            >
              {t('unavailable_short')}
            </div>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(index)}
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
