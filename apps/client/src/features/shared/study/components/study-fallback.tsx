'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export interface StudyFallbackProps {
  /**
   * 読み込み中か。
   *
   * three.js を dynamic import している間はここが true。読み込みが終われば書斎に
   * 置き換わるので、行き先のリンクは出すが理由文は出さない。
   */
  loading?: boolean;
}

/**
 * 書斎が出せないときの静止表現（`docs/oryzae-study/50-rollout.md`「フォールバック」）。
 *
 * WebGL 非対応と、three.js の読み込み中の両方で使う。**3 つの行き先を `<a>` で出す**の
 * が肝で、白画面にしないだけでなく「ここから先へ行ける」ことを保つ。
 */
export function StudyFallback({ loading = false }: StudyFallbackProps) {
  const t = useTranslations('study');

  return (
    <div
      {...verifyAttrs({ unit: 'StudyFallback', loading, linkCount: 3 })}
      className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center"
    >
      <StudyGlyph />

      {!loading && (
        <div className="max-w-[420px]">
          <h1 className="text-[13px] tracking-[0.2em]" style={{ color: '#5C4F3F' }}>
            {t('fallback_heading')}
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: '#8C857E' }}>
            {t('fallback_body')}
          </p>
        </div>
      )}

      <nav className="flex flex-wrap items-center justify-center gap-3">
        <FallbackLink href="/jar" label={t('fallback_jar')} />
        <FallbackLink href="/entries/new" label={t('fallback_journal')} />
        <FallbackLink href="/board" label={t('fallback_board')} />
      </nav>
    </div>
  );
}

function FallbackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full px-4 py-2 text-[11px] tracking-[0.1em] transition-colors hover:bg-[rgba(140,133,126,0.1)]"
      style={{ color: '#5C4F3F', border: '1px solid rgba(122,116,64,0.22)' }}
    >
      {label}
    </Link>
  );
}

/** 書斎の静止表現。瓶・手帳・壁のボードを線だけで示す。 */
function StudyGlyph() {
  return (
    <svg
      width="132"
      height="88"
      viewBox="0 0 132 88"
      fill="none"
      stroke="#A8A381"
      strokeWidth="1"
      aria-hidden="true"
    >
      <title>study</title>
      {/* 壁のボード */}
      <rect x="52" y="8" width="46" height="30" rx="1" strokeOpacity="0.5" />
      <path d="M60 18h12M60 24h18M84 16h8v10h-8z" strokeOpacity="0.3" />
      {/* 机の天板 */}
      <path d="M8 62h116M14 62v14M118 62v14" strokeOpacity="0.45" />
      {/* 瓶 */}
      <path d="M26 62V50c0-4 3-5 3-9v-3h10v3c0 4 3 5 3 9v12z" strokeOpacity="0.7" />
      <path d="M28 38h12v-3H28z" strokeOpacity="0.7" />
      {/* 手帳 */}
      <path d="M78 62v-6h26v6zM78 56v-4h26v4z" strokeOpacity="0.6" />
    </svg>
  );
}
