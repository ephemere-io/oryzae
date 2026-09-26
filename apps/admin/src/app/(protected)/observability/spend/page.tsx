import { redirect } from 'next/navigation';

/** 旧 AI Spend ページ。コストは /costs に 1 つにまとめた（ブックマーク・古い通知のリンク用）。 */
export default function SpendPage() {
  redirect('/costs');
}
