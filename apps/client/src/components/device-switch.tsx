'use client';

// verify-exempt: cookie の書き換えとページ再読み込みだけを行うレビュー用の一時部品。
// 孤立検証にかけても cookie と location への副作用しか見るものが無い。

import { DEVICE_PREF_COOKIE, type Device } from '@/lib/device';
import { useDevice } from '@/lib/use-device';

/**
 * ⚠️ **レビュー用の一時的な部品。マージ前に外すこと。**
 *
 * 端末は middleware がサーバー側で `device-pref` cookie（無ければ UA）から確定し、
 * `x-device` ヘッダで渡す。そのため切り替えには **cookie の書き換えとリロードの両方**が
 * 要り、DevTools の Console を開いて手で打つしかなかった。プレビューで PC / SP を
 * 何度も見比べる間だけ、それを右下のスイッチで済ませる。
 *
 * **外し方（3 箇所）:**
 *  1. このファイルを消す
 *  2. `app/(protected)/layout.tsx` の `<DeviceSwitch />` を消す
 *  3. `docs/oryzae-study/60-implementation-notes.md` §10 を消す
 */
export function DeviceSwitch() {
  const device = useDevice();
  if (device === null) return null;

  function switchTo(next: Device): void {
    // 1 年保持。middleware は毎リクエストこれを読み、UA 判定より優先する。
    document.cookie = `${DEVICE_PREF_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // cookie はレスポンスにしか乗らないので、読み直させるにはリロードが要る。
    window.location.reload();
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex items-center gap-1 rounded-full p-1"
      style={{
        background: 'rgba(253, 251, 247, 0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px dashed rgba(212, 113, 78, 0.55)',
        boxShadow: '0 2px 12px rgba(140, 133, 126, 0.18)',
      }}
      // 一時的な部品であることが見た目でも分かるように、破線の枠にしてある。
      title="レビュー用の端末切替（マージ前に外す）"
    >
      {(['pc', 'sp'] as const).map((candidate) => (
        <button
          key={candidate}
          type="button"
          onClick={() => switchTo(candidate)}
          aria-pressed={device === candidate}
          className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors"
          style={{
            fontFamily: 'Inter, sans-serif',
            color: device === candidate ? '#fdfbf7' : '#8C857E',
            background: device === candidate ? '#8EA89C' : 'transparent',
          }}
        >
          {candidate}
        </button>
      ))}
    </div>
  );
}
