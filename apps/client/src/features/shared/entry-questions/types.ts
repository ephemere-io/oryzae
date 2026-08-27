/** エントリと問いの紐付けドメインの共有型（端末非依存）。 */

/** エントリに紐付く／紐付けられる問い1件。 */
export interface LinkedQuestion {
  id: string;
  currentText: string | null;
}
