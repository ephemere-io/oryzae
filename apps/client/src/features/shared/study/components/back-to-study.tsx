'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StudyMark } from './study-mark';

/**
 * サブ画面の左上に浮く「書斎へ戻る」マーク（`docs/oryzae-study/00-overview.md`）。
 *
 * 書斎ホームでは同じ位置にブランドマークが出る。サブ画面ではそれが戻る導線を兼ねる、
 * というのが仕様なので、**同じ大きさ・同じ位置**に置く。
 *
 * 中身は**書斎の縮図**（机・壜・手帳・奥の板）。行き先が「あの部屋」だと絵で分かる方が、
 * ブランドの一文字より戻り道として読める。
 *
 * ここに置くことで jar / board / entry の各画面そのものには一切触らずに済む
 * （今回変えるのはナビゲーションと入口だけ、という前提を守る）。
 *
 * **重なり順は 55。** エディタは `fixed inset z-50`（ゴースト層が 51）なので、40 のままだと
 * エディタの下に潜って**そもそも見えない**。一方でドロワーやモーダル（60 以上）より前に
 * 出てはいけない（開いている間はマークも一緒に伏せる）。
 * 席の確保は画面側の仕事で、`--study-back-inset`（(protected)/layout.tsx）を読む。
 *
 * **大きさは 32px。** 40px のときは jar / board / entry のどれでも既存の操作と近すぎ、
 * 「邪魔になる」と実機レビューで報告された。指の当たりの下限（44px）を割るが、
 * ここは常時出ている二次的な導線で、押し損ねても失うものが無い（もう一度押せばよい）。
 * 主要な操作をこの大きさにはしない。
 */
export function BackToStudy() {
  const t = useTranslations('study');

  return (
    <Link
      href="/study"
      {...verifyAttrs({ unit: 'BackToStudy' })}
      aria-label={t('back_to_study')}
      className="group fixed left-4 top-4 z-[55] flex h-8 items-center gap-1.5 rounded-full px-2.5 transition-all duration-300"
      style={{
        background: 'rgba(253, 251, 247, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(122, 116, 64, 0.18)',
        boxShadow: '0 2px 12px rgba(140, 133, 126, 0.14)',
      }}
    >
      {/* 書斎そのものを小さく描く: 机の上に壜と手帳、奥に板。行き先が「あの部屋」だと
          一目で分かるようにする（以前は "o" の一文字で、書斎を想起させなかった）。
          書斎側の左上マークと**同じ絵**を共有する（StudyMark）。 */}
      <StudyMark size={16} />
      {/* 文字はホバーで開く。常時出すと画面の左上を占め続ける。 */}
      <span
        className="max-w-0 overflow-hidden whitespace-nowrap text-[9px] uppercase tracking-[0.2em] opacity-0 transition-all duration-300 group-hover:max-w-[140px] group-hover:opacity-100"
        style={{ color: '#5C4F3F' }}
      >
        {t('back_to_study')}
      </span>
    </Link>
  );
}
