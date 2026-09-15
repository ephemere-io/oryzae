'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { docsHref } from '@/lib/docs-site';
import {
  MEMO_LINKS,
  MEMO_TORN_EDGE,
  MEMO_WIDTH,
  type MemoSurface,
  memoPose,
  memoScale,
  showsCaptions,
} from '../help-memo';
import { LABEL_STYLE } from '../scene/labels';

export interface StudyHelpMemoProps {
  /**
   * 毎フレーム更新される画面座標と、その場所の尺（1 world unit の px）。
   * null はメモを置かない構図、またはサブ画面・遷移中。
   */
  point: { x: number; y: number; visible: boolean; pxPerUnit: number } | null;
  /** 壁に貼る（テープ・正対・一言つき）か、机に置く（寝かせる・名前だけ）か。 */
  surface: MemoSurface;
}

/**
 * ヘルプへの導線のメモ（`docs/oryzae-study/00-overview.md`「壁のメモ」）。
 * PC は壁にセロハンテープで貼り、SP は机の手前に置く。
 *
 * 書斎から公開サイト（ヘルプ・お問い合わせ・Docs）へ出ていく導線。机の上の物が
 * 「書く・読む・眺める」を語るのに対して、これは部屋の外への案内なので、物ではなく
 * **紙**にした。ボタンを浮かべると「机の上の物で語る」前提が崩れる。
 *
 * ラベルと同じ「3D 座標に貼り付く HTML」だが、こちらは注釈ではなく紙そのものなので
 * 遠近で大きさが変わる（`memoScale`）。行き先は 3 つとも別ドメインなので新しいタブで開く
 * — 書斎を閉じずに済む。
 */
export function StudyHelpMemo({ point, surface }: StudyHelpMemoProps) {
  const shown = point?.visible === true;

  // 層そのものは常に置く（契約を読めるように）。紙は位置があるときだけ。
  return (
    <div
      {...verifyAttrs({
        unit: 'StudyHelpMemo',
        visible: shown,
        surface,
        links: MEMO_LINKS.length,
      })}
      className="pointer-events-none absolute inset-0"
    >
      {shown && <Paper point={point} surface={surface} />}
    </div>
  );
}

function Paper({
  point,
  surface,
}: {
  point: NonNullable<StudyHelpMemoProps['point']>;
  surface: MemoSurface;
}) {
  const t = useTranslations('study');
  const scale = memoScale(point.pxPerUnit);
  const captions = showsCaptions(surface);

  return (
    <div
      className="absolute"
      style={{
        left: point.x,
        top: point.y,
        width: MEMO_WIDTH[surface],
        transform: memoPose(surface, scale),
        // 影は clip-path に切られるので、紙ではなく外側に drop-shadow で落とす。
        filter: 'drop-shadow(0 3px 10px rgba(140,133,126,0.22))',
      }}
    >
      {/* セロハンテープ。紙の上辺をまたいで壁に留まる（置いた紙には要らない）。 */}
      {surface === 'wall' && (
        <span
          aria-hidden="true"
          data-memo-tape
          className="absolute left-1/2 z-10 block"
          style={{
            top: -7,
            width: 46,
            height: 15,
            transform: 'translateX(-50%) rotate(3deg)',
            background: 'rgba(236, 231, 214, 0.62)',
            border: '1px solid rgba(122,116,64,0.10)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
          }}
        />
      )}

      <div
        data-memo-paper
        className={
          captions ? 'pointer-events-auto px-3 pt-4 pb-5' : 'pointer-events-auto px-2.5 pt-3 pb-4'
        }
        style={{
          background: '#fdfbf7',
          border: '1px solid rgba(122,116,64,0.18)',
          clipPath: MEMO_TORN_EDGE,
          fontFamily: 'Inter, "Noto Sans JP", sans-serif',
        }}
      >
        {/* 見出しはラベルと同じ書き方（点 + 9px の機械ラベル）。同じ意味のものは同じ形で。 */}
        <div
          className="mb-2 flex items-center gap-1.5"
          style={{
            fontSize: LABEL_STYLE.fontSize,
            letterSpacing: LABEL_STYLE.letterSpacing,
            color: LABEL_STYLE.color,
          }}
        >
          <span
            style={{
              width: LABEL_STYLE.dotSize,
              height: LABEL_STYLE.dotSize,
              borderRadius: '50%',
              background: LABEL_STYLE.dotColor,
            }}
          />
          {t('memo_title')}
        </div>

        <ul className="m-0 list-none p-0">
          {MEMO_LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={docsHref(link.path)}
                target="_blank"
                rel="noopener noreferrer"
                data-memo-link={link.id}
                // 机の紙は指で押す。一言が無いぶん行が薄くなるので、上下の余白で厚みを足す。
                className={`-mx-1.5 block rounded px-1.5 no-underline transition-colors hover:bg-[rgba(122,116,64,0.06)] ${
                  captions ? 'py-1' : 'py-1.5'
                }`}
              >
                {captions && (
                  <span className="block text-[9px] leading-[1.3]" style={{ color: '#8C857E' }}>
                    {t(link.captionKey)}
                  </span>
                )}
                <span
                  className="flex items-baseline gap-1 text-[11px] leading-[1.4]"
                  style={{ color: LABEL_STYLE.color }}
                >
                  {t(link.labelKey)}
                  {/* 末尾の `›` で押せることを示す（SP のピルと同じ印）。 */}
                  <span style={{ color: LABEL_STYLE.dotColor }}>›</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
