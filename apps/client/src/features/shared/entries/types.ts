/** エントリドメインの共有型（端末非依存）。 */

/** 一覧の並び順。PC 一覧・SP 一覧の両方が使う。 */
export type EntryListOrder = 'newest' | 'oldest';

/** 写真取り込みの進行状態。通信中は操作を止めるのに使う。 */
type PhotoImportStatus = 'idle' | 'uploading' | 'transcribing';

/**
 * エントリに添えた写真 1 枚。
 *
 * バケットが private なので公開 URL は無い（#504 と同じ判断。00023 参照）。
 * エントリに保存するのは `storagePath` で、`signedUrl` は表示専用・1 時間で失効する。
 * 署名 URL を保存すると翌日には壊れるので、取り違えないこと。
 */
export interface AttachedPhoto {
  storagePath: string;
  signedUrl: string;
}

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

/**
 * ある月に書かれた記録の件数。`month` は `YYYY-MM`（利用者のローカル暦月であって
 * UTC の月ではない）。書斎の手帳の厚みと、棚に並ぶ冊数を決める。
 */
export interface MonthlyEntryCount {
  month: string;
  count: number;
  /**
   * その月の最初と最後の記録の日（ローカル暦日 `YYYY-MM-DD`）。サーバーが返さなければ
   * null（ホバーは件数だけを出す）。
   */
  first: string | null;
  last: string | null;
}

/** 一覧の行に紐づく問いの最小形（Issue #323 でサーバーが埋め込んで返す）。 */
export interface EntryLinkedQuestion {
  id: string;
  currentText: string | null;
}

/** 一覧が返す記録 1 件。本文まで含む（一覧は冒頭しか見せないが、行の描画側が決める）。 */
export interface EntryListItem {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  linkedQuestions: EntryLinkedQuestion[];
}
