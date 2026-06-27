/**
 * 発酵失敗の理由を Discord 通知向けに集約する純粋関数。
 *
 * 同一メッセージは件数にまとめる (例: モデル retire 時は全ユーザーが同一の
 * not_found エラーになるため `N× <理由>` の 1 行に畳む)。これがないと
 * `result.errors` がそのまま N 行並び、Discord の embed field 上限 (1024 字) /
 * embed 全体上限 (6000 字) を超えて 400 になり、`notifyDiscord` の握り潰し
 * (`catch {}`) で通知自体が黙って消える。= 障害がまた無通知になる。
 * そのため必ず maxChars 以内に収め、溢れる分は「…他 N 種類」で打ち切る。
 */
export function summarizeFailureReasons(
  errors: ReadonlyArray<{ error: string }>,
  maxChars = 1000, // Discord field 上限 1024 に対しマージンを取る
): string {
  if (errors.length === 0) return '';

  const counts = new Map<string, number>();
  for (const { error } of errors) {
    // 改行・連続空白を 1 スペースに正規化 (Discord で 1 行に畳まれて読みやすい)。
    const key = error.replace(/\s+/g, ' ').trim() || '(理由不明)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // 件数の多い順 (支配的な原因を上に出す)。
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const PER_MSG_MAX = 300; // 1 メッセージが長すぎて予算を食い潰すのを防ぐ
  const lines: string[] = [];
  let used = 0;

  for (let i = 0; i < sorted.length; i++) {
    const [msg, count] = sorted[i];
    const shown = msg.length > PER_MSG_MAX ? `${msg.slice(0, PER_MSG_MAX)}…` : msg;
    const line = count > 1 ? `${count}× ${shown}` : shown;

    // この行を足すと溢れる場合は打ち切り (ただし 1 行も出ていないなら先頭は必ず出す)。
    if (lines.length > 0 && used + line.length + 1 > maxChars) {
      lines.push(`…他 ${sorted.length - i} 種類`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }

  let result = lines.join('\n');
  // 先頭 1 行が極端に長いケースへの最終ガード。
  if (result.length > maxChars) result = `${result.slice(0, maxChars - 1)}…`;
  return result;
}
