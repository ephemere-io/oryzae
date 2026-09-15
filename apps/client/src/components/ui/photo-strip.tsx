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
  /**
   * `thumbnails`（既定）は小さな正方形の並び（PC の下端）。`blocks` は本文の下に全幅で積む
   * （SP。左下の小さなプレビューは「貼った」と分からない、と実機レビュー。紙の続きとして
   * 上下に挟まる置き方に揃える）。
   */
  variant?: 'thumbnails' | 'blocks';
}

/**
 * エントリに添えた写真を横並びで見せる。PC / SP どちらの編集画面からも使う。
 *
 * 本文の途中に食い込ませる表示ではなく、本文の下にまとめて並べる段階のもの
 * （経緯と今後は docs/entry-photo-guide.md「いまやっていないこと」を参照）。
 */
export function PhotoStrip({ urls, onRemove, variant = 'thumbnails' }: PhotoStripProps) {
  const t = useTranslations('photo');

  if (urls.length === 0) return null;
  const blocks = variant === 'blocks';

  return (
    <ul
      data-photo-strip={variant}
      className={blocks ? 'flex flex-col gap-4 px-6 pb-6' : 'flex flex-wrap gap-2 px-4 py-3'}
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
              className={
                blocks
                  ? 'block w-full rounded-2xl object-cover'
                  : 'h-20 w-20 rounded-md object-cover'
              }
              style={{
                border: '1px solid var(--border-subtle)',
                ...(blocks ? { maxHeight: '70vw' } : {}),
              }}
            />
          ) : (
            // 署名できなかった写真。枠だけ残して並びを保つ（消すと index がずれる）。
            <div
              role="img"
              aria-label={t('unavailable', { index: index + 1 })}
              className={`flex items-center justify-center rounded-md text-[10px] leading-tight ${
                blocks ? 'h-32 w-full rounded-2xl' : 'h-20 w-20'
              }`}
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
              className={`absolute flex items-center justify-center rounded-full text-white ${
                blocks ? 'top-2 right-2 h-8 w-8' : '-right-1.5 -top-1.5 h-5 w-5'
              }`}
              style={{ background: blocks ? 'rgba(26,25,24,0.55)' : 'var(--date-color)' }}
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
