/** PC エディタ固有の型（端末別 UI の内部表現。ドメイン型は features/shared に置く）。 */

/** 音声入力が使えない理由。ステータスバーの文言出し分けに使う。 */
export type VoiceUnavailableReason =
  | 'unsupported' // SpeechRecognition コンストラクタが存在しない
  | 'network' // 認識バックエンド（Chrome は Google サーバー）に到達できない (Brave 等でブロック)
  | 'not-allowed' // マイク権限拒否
  | 'service-not-allowed'; // OS / ブラウザが認識サービスを無効化

/** 打鍵音の増幅が鳴らせない理由。設定パネルの文言出し分けに使う。 */
export type AmpUnavailableReason = 'denied' | 'unsupported' | null;

/** useAmpEffect が返す状態。 */
export interface AmpState {
  /** 鳴らせない理由。null なら鳴っている（か、そもそも切っている）。 */
  unavailable: AmpUnavailableReason;
}
