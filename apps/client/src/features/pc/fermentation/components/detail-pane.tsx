'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useEscapeKey } from '@/lib/use-escape-key';

/**
 * 詳細列の幅（px）。
 *
 * **中身の種類で変えない。** 言葉・抜粋・手紙を渡り歩くのがこの面の主な使われ方なので、
 * 種類ごとに幅を変えると隣のキャンバス列が選ぶたびに伸び縮みして、円の位置が動く。
 * いちばん長い手紙が読める幅に固定しておく（左右の余白 64px を引いて実質 416px、
 * 14px の和文で 1 行 30 文字前後 ＝ 読める行長の下限あたり）。
 */
const COLUMN_WIDTH = 480;

interface DetailPaneProps {
  /** 詳細列そのものを出すか。円を開いている / 履歴を見ている間はずっと出しておく。 */
  visible: boolean;
  /** 中身が選ばれているか。false なら列は出たまま空状態を見せる。 */
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
 * 発酵の中身（言葉・抜粋・手紙）を読むための列。円の隣に並べる。
 *
 * 一度は画面中央のモーダルにしたが、**要素を渡り歩けなくなる**のでやめた。手紙を読んで
 * から抜粋が気になっても、いったんモーダルを閉じないと円に触れない ── 切り替えのたびに
 * クリックが 2 倍になっていた（レビューでの指摘）。読む面と選ぶ面は同時に見えていないと
 * いけない。
 *
 * かといって以前のように盤面へ**覆いかぶせる**のも違う。あれは右側の円盤や円を隠して
 * いた。列として並べれば、キャンバス側は覆われるのではなく **狭くなる** ので、円は
 * 隠れないまま隣で開き続けられる。
 *
 * ⚠️ エディタ側の発酵オーバーレイ（`pc/entries/fermentation-overlay-detail-pane`）とは
 * 別物のまま。あちらは本文を書いている最中に開くので、書く手元を覆ってはいけない。
 */
export function DetailPane({
  visible,
  open,
  onClose,
  questionId,
  questionText,
  type,
  data,
}: DetailPaneProps) {
  const router = useRouter();
  const t = useTranslations('fermentation');

  // Escape で選択を解く。列そのものは残る（円を閉じるまでが列の寿命）。
  // 発酵履歴側の Escape は、中身が選ばれている間だけ止めてある ── 1 回目でここ、
  // 2 回目で履歴、という順に閉じてほしいため。
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

  return (
    <div
      {...verifyAttrs({
        unit: 'DetailPane',
        visible,
        open,
        type: type ?? 'none',
        hasData: Boolean(data),
        width: COLUMN_WIDTH,
      })}
      className="relative z-[40] flex h-full shrink-0 flex-col overflow-hidden border-l border-[rgba(139,115,85,0.2)] bg-[#faf8f5]"
      style={{
        // 閉じるときは幅を 0 へ畳む。キャンバス列がそのぶん広がって円が中央へ戻る。
        width: visible ? COLUMN_WIDTH : 0,
        transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: "'Noto Serif JP', serif",
      }}
    >
      {/* 中身は幅が変わっても折り返さない。畳んでいる途中で文字が潰れるのを防ぐ。 */}
      <div className="flex h-full flex-col" style={{ width: COLUMN_WIDTH }}>
        {open ? (
          <>
            {/* Close（選択を解くだけ。列は残る） */}
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
              {type === 'letter' && data && (
                <div className="whitespace-pre-wrap">{data.bodyText}</div>
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
          </>
        ) : (
          /* 空状態。列は円を開いた時点で現れるので、選ぶ前のここに「何をすると何が出るか」
             を置いておく。列が空のまま無言だと、ただ狭くなっただけに見える。 */
          <div
            data-verify-part="empty"
            className="flex h-full flex-col items-center justify-center gap-3 px-10 text-center"
          >
            <span
              className="text-[9px] uppercase tracking-[0.3em] text-[var(--date-color)]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {t('detail.empty_label')}
            </span>
            <span className="text-[13px] leading-[2] text-[var(--date-color)]">
              {t('detail.empty_hint')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
