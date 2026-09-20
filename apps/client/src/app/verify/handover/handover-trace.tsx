'use client';

import { useEffect, useState } from 'react';
import { clearTrace, readTrace, startTrace, type TraceRecord } from '@/lib/trace';

/**
 * 入室（ログイン → 扉 → 書斎）の実測を、実機で取って読む画面（プレビュー限定）。
 *
 * **手元では再現しない現象を、その端末の数字で受け取るためのもの。** 使い方は 3 手:
 *
 * 1. 「計測を始める」を押す（ログイン画面へ移る）
 * 2. いつもどおりログインして、書斎が出るまで待つ
 * 3. この画面に戻る（`/verify/handover`）。並んだ時刻を見る／コピーして渡す
 *
 * 読み方:
 * - **「地が描かれた」→「書斎の 1 フレーム目」が長い** = 書斎の読み込み待ち。絵は出たままなので
 *   白くはならないが、その間ずっと静止画で、動きが止まって見える
 * - **コマ落ちが並ぶ** = 描画が詰まっている。静止画ではなく、動きの側の問題
 */
export function HandoverTrace() {
  const [record, setRecord] = useState<TraceRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRecord(readTrace());
  }, []);

  return (
    <div className="min-h-[min(100svh,100dvh)] bg-[#f9f8f4] p-5 text-[13px] text-[#2d2d2d]">
      <h1 className="mb-1 text-[15px] font-medium">入室の実測</h1>
      <p className="mb-4 leading-relaxed text-[#8c857e]">
        ①「計測を始める」→ ② ふつうにログイン → ③ 書斎が出たらこの画面（/verify/handover）に戻る。
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-[#2d2d2d] px-4 py-2 text-[12px] text-white"
          onClick={() => {
            startTrace();
            window.location.assign('/login');
          }}
        >
          計測を始める（ログインへ）
        </button>
        <button
          type="button"
          className="rounded-full border border-[rgba(0,0,0,0.2)] px-4 py-2 text-[12px]"
          onClick={() => {
            clearTrace();
            setRecord(null);
          }}
        >
          消す
        </button>
        {record !== null && (
          <button
            type="button"
            className="rounded-full border border-[rgba(0,0,0,0.2)] px-4 py-2 text-[12px]"
            onClick={() => {
              void navigator.clipboard?.writeText(asText(record)).then(() => setCopied(true));
            }}
          >
            {copied ? 'コピーしました' : '全部コピー'}
          </button>
        )}
      </div>

      {record === null ? (
        <p className="text-[#8c857e]">まだ記録がありません。</p>
      ) : (
        <>
          <table className="mb-5 w-full border-collapse">
            <tbody>
              {record.marks.map((mark, index) => {
                const previous = index === 0 ? 0 : record.marks[index - 1].at;
                const delta = mark.at - previous;
                return (
                  <tr
                    key={`${mark.name}-${mark.at}`}
                    className="border-[rgba(0,0,0,0.08)] border-b"
                  >
                    <th className="py-1 text-left font-normal">{mark.name}</th>
                    <td className="py-1 text-right font-mono">{mark.at}ms</td>
                    <td
                      className="w-16 py-1 text-right font-mono"
                      style={{ color: delta >= 400 ? '#a33' : '#8c857e' }}
                    >
                      +{delta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2 className="mb-1 text-[14px] font-medium">
            コマ落ち（40ms 以上のフレーム）: {record.janks.length}
          </h2>
          <p className="mb-2 font-mono text-[12px] text-[#5a5a5a]">
            {record.janks.length === 0
              ? 'なし'
              : record.janks.map((jank) => `${jank.at}ms で ${jank.gapMs}ms`).join(' / ')}
          </p>

          <h2 className="mt-4 mb-1 text-[14px] font-medium">端末</h2>
          <p className="break-all font-mono text-[11px] text-[#5a5a5a]">{record.device}</p>
        </>
      )}
    </div>
  );
}

/** 渡しやすいひと塊の文字にする（スクショが撮りにくい端末のため）。 */
function asText(record: TraceRecord): string {
  const marks = record.marks.map((mark) => `${mark.at}ms\t${mark.name}`).join('\n');
  const janks =
    record.janks.length === 0
      ? 'なし'
      : record.janks.map((jank) => `${jank.at}ms で ${jank.gapMs}ms`).join(', ');
  return `入室の実測\n${record.device}\n\n${marks}\n\nコマ落ち(${record.janks.length}): ${janks}`;
}
