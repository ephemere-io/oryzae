'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useEffect } from 'react';
import { useEntrance } from '../entrance/context';
import {
  BRAND_CLASS,
  ERROR_CLASS,
  PAPER_STACK_CLASS,
  SECONDARY_BUTTON_CLASS,
  SERIF_FONT,
} from '../entrance/paper';

export interface AuthStatusProps {
  /** `pending`: 確かめている最中 / `error`: 通らなかった。 */
  state: 'pending' | 'error';
  message: string;
  /** `error` のときの戻り道の文言。 */
  backLabel?: string;
}

/**
 * 通り道の画面（`/callback`・`/auth/confirm`）の紙。
 *
 * 確かめている間は、扉が少し大きく開いて待つ（`setWaiting`）。以前は同じ場所に
 * 小さな灰色の「認証中...」と、言語の選択欄だけが浮いていた。
 *
 * 通らなかったときは扉を閉じ直し、理由と戻り道を出す。戻り道は `<a>` の全画面遷移 —
 * 失敗した認証の状態を持ち越さずにログイン画面を読み込み直す。
 */
export function AuthStatus({ state, message, backLabel }: AuthStatusProps) {
  const { setWaiting } = useEntrance();

  useEffect(() => {
    setWaiting(state === 'pending');
    return () => setWaiting(false);
  }, [state, setWaiting]);

  return (
    <div
      className={PAPER_STACK_CLASS}
      {...verifyAttrs({ unit: 'AuthStatus', state, hasBackLink: state === 'error' })}
    >
      <h1 className={BRAND_CLASS} style={SERIF_FONT}>
        Oryzae
      </h1>

      {state === 'pending' ? (
        <p role="status" className="flex items-center gap-3 text-[14px] text-[#5c4f3f]">
          {/* 書斎の注釈と同じ点。息をするように明滅して、止まっていないことだけを伝える。 */}
          <span
            aria-hidden="true"
            className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#a8a381] motion-safe:animate-pulse"
          />
          {message}
        </p>
      ) : (
        <>
          <p role="alert" className={ERROR_CLASS}>
            {message}
          </p>
          <a href="/login" className={SECONDARY_BUTTON_CLASS}>
            {backLabel}
          </a>
        </>
      )}
    </div>
  );
}
