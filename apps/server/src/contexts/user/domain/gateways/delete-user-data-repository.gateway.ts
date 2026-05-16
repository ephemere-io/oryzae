/**
 * Issue #326: 管理画面からテストアカウントを一括削除するためのポート。
 *
 * Supabase Dashboard の Auth → Users 削除が "Database error deleting user"
 * で失敗するケースに対応するため、auth.users を消す前に public.* の関連行と
 * storage の関連オブジェクトを明示的に削除する。
 */
export interface DeleteUserDataResult {
  /** 削除されたユーザー ID */
  userId: string;
  /** 削除されたメールアドレス (ログ用) */
  email: string | null;
}

export interface DeleteUserDataRepositoryGateway {
  /** 指定ユーザーが auth.users に存在するか確認し、email を返す。存在しなければ null */
  findAuthUserEmail(userId: string): Promise<string | null>;

  /**
   * public スキーマ配下の user_id を持つテーブル行を全て削除する。
   * FK は CASCADE 済みなので親テーブルだけ delete すれば良いが、
   * Dashboard 経由の削除が失敗するケースがあるため明示的に消す。
   */
  deletePublicData(userId: string): Promise<void>;

  /**
   * storage 上の関連オブジェクトを削除する (avatars/, board-photos/)。
   * storage は auth.users に FK が無く CASCADE しないため明示的に消す。
   */
  deleteStorageObjects(userId: string): Promise<void>;

  /** auth.users から行を削除する */
  deleteAuthUser(userId: string): Promise<void>;
}
