'use client';

import { StudyFallback } from '@/features/shared/study/components/study-fallback';

/**
 * `/study` のロード表示。
 *
 * 書斎は 3D の一枚絵で、並ぶコンテンツが無い。スケルトンで枠を予告しても意味が無いので、
 * **書斎の静止表現をそのまま出す**（WebGL 非対応のときと同じもの）。読み込みが終われば
 * 同じ位置に本物の書斎が来るので、絵が入れ替わって見えない。
 *
 * `loading` を立てて失敗の理由文は出さない。ここは読み込み中であって、失敗ではない。
 */
export function StudyRouteLoading() {
  return (
    <div className="absolute inset-0">
      <StudyFallback loading />
    </div>
  );
}
