import type { Metadata } from 'next';
import { DeviceView } from '@/components/device-view';
import { PcAuthEntrance } from '@/features/pc/auth/components/pc-auth-entrance';
import { SpAuthEntrance } from '@/features/sp/auth/components/sp-auth-entrance';

// 認証系ページはインデックスさせない（middleware の X-Robots-Tag と二重担保）。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * 認証画面（ログイン・登録・パスワード再設定・認証中）の地は**書斎の手前の扉**。
 *
 * 書斎と同じく端末で構図を出し分ける（URL は変えない）。レイアウトに置くので、
 * 認証画面どうしを行き来しても扉は作り直さない。
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <DeviceView
      pc={<PcAuthEntrance>{children}</PcAuthEntrance>}
      sp={<SpAuthEntrance>{children}</SpAuthEntrance>}
    />
  );
}
