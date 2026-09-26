import type {
  LlmUsageEvent,
  LlmUsageRecorder,
} from '../domain/gateways/llm-usage-recorder.gateway.js';

/**
 * 記録に失敗しても、ユーザーの操作は失敗させない。
 *
 * 記録はレポートのためのもので、OCR の結果そのものには関わらない。記録テーブルが
 * 未作成・一時的な DB エラーのときに「読み取れませんでした」と返すのは本末転倒。
 *
 * **await すること。** fire-and-forget にすると、Vercel は応答を返した時点で関数を
 * 止めるので、書き込みが途中で切られて件数が黙って欠ける。
 *
 * ログには本文を載せない（載せられる値をそもそも持っていない）。
 */
export async function recordLlmUsage(
  recorder: LlmUsageRecorder,
  event: LlmUsageEvent,
): Promise<void> {
  try {
    await recorder.record(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[llm-usage] record failed', { feature: event.feature, error: message });
  }
}
