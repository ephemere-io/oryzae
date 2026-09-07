'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useEscapeKey } from '@/lib/use-escape-key';

/**
 * 種類ごとのウィンドウ幅（px）。
 *
 * 右から出る固定幅のペインをやめて中央のウィンドウにしたのは、**中身の長さがまるで違う**
 * のに同じ器に入れていたから。キーワードの説明（2〜3行）と L.A.B. の手紙（十数行）が、
 * どちらも幅 400px・全画面高のカラムに入っていた。前者はスカスカ、後者は窮屈になる。
 *
 * 手紙が広いのは行長のため。400px の器は左右の余白を引くと実質 336px しかなく、14px の
 * 和文で **1 行 24 文字**にしかならない。長文を読ませる行長ではない（和文は 30〜40 文字）。
 */
const WINDOW_WIDTH: Record<'keyword' | 'snippet' | 'letter', number> = {
  keyword: 420,
  snippet: 560,
  letter: 680,
};

interface DetailPaneProps {
  open: boolean;
  onClose: () => void;
  questionId: string;
  questionText: string;
  type: 'keyword' | 'snippet' | 'letter' | null;
  data: {
    keyword?: string;
    description?: string;
    originalText?: string;
    sourceDate?: string;
    selectionReason?: string;
    bodyText?: string;
  } | null;
}

/**
 * 発酵の中身（言葉・抜粋・手紙）を読むための面。瓶の中央にふわりと現れる。
 *
 * 瓶のキャンバスでも発酵履歴でも、押した要素はたいてい画面の中央付近にある。右から板が
 * 出てくる作りは、履歴の円盤（画面中央）や瓶（同じく中央）と構図で喧嘩していた。中央に
 * 置けば構図が崩れず、幅を中身に合わせられる。
 *
 * 背後のスクリムは半透明＋ぼかしにして、瓶や円盤をうっすら透かす。「瓶の中にいる」文脈を
 * 切らないためで、発酵履歴のスクリムと同じ考え方。
 *
 * ⚠️ エディタ側の発酵オーバーレイ（`pc/entries/fermentation-overlay-detail-pane`）は
 * **右ペインのまま**にしてある。あちらは本文を書いている最中に開くので、書く手元を
 * 覆ってはいけない。読むための面（中央）と、書きながら参照する面（右）で作りが違う。
 */
export function DetailPane({
  open,
  onClose,
  questionId,
  questionText,
  type,
  data,
}: DetailPaneProps) {
  const router = useRouter();
  const t = useTranslations('fermentation');

  // Escape で閉じる。window の capture で拾うので、発酵履歴側の Escape（document の
  // bubble）より先に走る。履歴側は開いている間だけ Escape を止めてある ── 1 回目で
  // このウィンドウ、2 回目で履歴、という順に閉じてほしいため。
  const handleEscape = useCallback(() => onClose(), [onClose]);
  useEscapeKey(open, handleEscape);

  function handleWriteEntry() {
    router.push(`/entries/new?questionId=${questionId}`);
  }

  const headers: Record<'keyword' | 'snippet' | 'letter', string> = {
    keyword: t('detail.header_keyword'),
    snippet: t('detail.header_snippet'),
    letter: t('detail.header_letter'),
  };

  const width = type ? WINDOW_WIDTH[type] : WINDOW_WIDTH.keyword;

  return (
    <div
      {...verifyAttrs({
        unit: 'DetailPane',
        open,
        type: type ?? 'none',
        hasData: Boolean(data),
        width,
      })}
      // z は発酵履歴のクローム（日付レール = z-70）より上、問いの追加/編集モーダル
      // （z-100）より下。60 のままだとレールが手紙の上に重なって読めなかった。
      className="absolute inset-0 z-[80] flex items-center justify-center"
      style={{
        // 閉じているときは触れない。要素そのものは残す（開閉を滑らせるため）。
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* スクリム。押すと閉じる。 */}
      <button
        type="button"
        data-verify-part="scrim"
        aria-label={t('detail.close_aria')}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0"
        style={{
          background: 'rgba(249,248,244,0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          // スクリムを先に、ウィンドウを少し遅れて出すと「奥から浮いてくる」感じになる。
          transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* ウィンドウ本体 */}
      <div
        data-verify-part="window"
        className="relative flex max-h-[78vh] w-[90vw] flex-col overflow-hidden rounded-2xl"
        style={{
          width: `min(${width}px, 90vw)`,
          background: '#faf8f5',
          border: '1px solid var(--ob-card-border)',
          boxShadow: 'var(--ob-shadow-card)',
          fontFamily: "'Noto Serif JP', serif",
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
          transition:
            'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.close_aria')}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6b5c4a] transition-colors hover:bg-[rgba(139,115,85,0.1)]"
        >
          ×
        </button>

        {/* どの問いの、どの回のものか */}
        <div className="shrink-0 px-8 pt-8 pb-3 pr-16 text-sm font-medium text-[#4a3f35]">
          {questionText}
        </div>

        {/* Header */}
        <div className="shrink-0 border-b border-[rgba(139,115,85,0.1)] px-8 pb-5 text-[22px] font-medium text-[#4a3f35]">
          {type ? headers[type] : ''}
        </div>

        {/* Body — scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 text-sm leading-[2.0] text-[#4a3f35]">
          {type === 'keyword' && data && (
            <>
              <h3 className="mb-3 text-lg font-medium text-[var(--accent)]">{data.keyword}</h3>
              <p>{data.description}</p>
            </>
          )}
          {type === 'snippet' && data && (
            <>
              <blockquote className="mb-4 text-base font-medium leading-relaxed">
                「{data.originalText}」
              </blockquote>
              <p className="mb-4 text-xs text-[var(--date-color)]">
                <span>{t('detail.snippet_source_prefix')}</span> {data.sourceDate}
              </p>
              <p>{data.selectionReason}</p>
            </>
          )}
          {/* 手紙だけ行長を絞る。器を広げたのは読みやすさのためなので、
              広げたぶん 1 行が伸びきってしまっては意味がない。 */}
          {type === 'letter' && data && (
            <div className="mx-auto max-w-[34em] whitespace-pre-wrap">{data.bodyText}</div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[rgba(139,115,85,0.1)] px-8 py-6">
          <button
            type="button"
            onClick={handleWriteEntry}
            className="w-full rounded-lg border border-[var(--accent)] px-4 py-3 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
          >
            {t('detail.write_entry')}
          </button>
        </div>
      </div>
    </div>
  );
}
