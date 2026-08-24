/** エントリドメインの共有型（端末非依存）。 */

/** 一覧の並び順。PC 一覧・SP 一覧の両方が使う。 */
export type EntryListOrder = 'newest' | 'oldest';

/** 写真取り込みの進行状態。通信中は操作を止めるのに使う。 */
type PhotoImportStatus = 'idle' | 'uploading' | 'transcribing';

/**
 * 写真取り込みモーダル/シートに映す状態（usePhotoImport が持つ）。
 * PC・SP の表示部品はこれを props で受け取るだけの純表示にしてある。
 */
export interface PhotoImportState {
  open: boolean;
  fileName: string;
  /** プレビュー用の object URL。閉じるときに revoke する。 */
  previewUrl: string | null;
  status: PhotoImportStatus;
  error: string;
  /** 文字起こし結果。null なら未実行。空文字は「文字が写っていなかった」。 */
  transcript: string | null;
}

/** 書きかけの退避データ（localStorage に置き、再開時に復元する）。 */
export interface EntryDraft {
  /** 自動保存で既にエントリが作成済みならその id（再開時は同じエントリを更新＝重複作成を防ぐ）。 */
  entryId?: string;
  title: string;
  body: string;
  questionId: string | null;
  /** 最終編集時刻（epoch ms）。 */
  updatedAt: number;
  /** 最終編集時のローカル暦日（YYYY-MM-DD）。日付境界の判定に使う。 */
  dateKey: string;
}
