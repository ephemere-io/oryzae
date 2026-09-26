import type { AiUsage, AiUsageRecorder } from '../domain/gateways/ai-usage-recorder.gateway.js';

/**
 * 記録に失敗しても、ユーザーの操作は失敗させない。
 *
 * 記録はレポートのためのもので、AI の結果そのものには関わらない。記録の表が
 * 未作成・一時的な DB エラーのときに発酵や OCR まで失敗させるのは本末転倒。
 *
 * **await すること。** fire-and-forget にすると、Vercel は応答を返した時点で関数を
 * 止めるので、書き込みが途中で切られて件数が黙って欠ける。
 *
 * ログには本文を載せない（載せられる値をそもそも持っていない）。
 */
export async function recordAiUsage(recorder: AiUsageRecorder, usage: AiUsage): Promise<void> {
  try {
    await recorder.record(usage);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ai-usage] record failed', { feature: usage.feature, error: message });
  }
}
