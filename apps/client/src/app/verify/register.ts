/**
 * 検証ユニットの登録バレル。
 *
 * ビルトイン verifier を登録し、各ユニットの `*.verify` を import（自己登録）する。
 * 横展開時はここに `import '...<x>.verify';` を1行ずつ足すだけ。
 *
 * 配置が app/ なのは、feature の spec を import するため（dep-cruise の lib-independence
 * により lib/ からは features/ を import できない。app/ は features/ を合成できる層）。
 * このバレルは「CIマトリクス（test）」「dashboard ルート」「window.__verify」の3経路から
 * import され、同じレジストリを共有する。
 */

import { registerBuiltinVerifiers } from '@oryzae/verify';
// 実 feature のユニット
import '@/features/auth/components/reset-password-form.verify';
import '@/features/pc/entries/components/delete-confirm-modal.verify';
import '@/features/pc/entries/components/editor-status-bar.verify';
import '@/features/pc/entries/components/entry-action-palette.verify';
import '@/features/pc/entries/components/entry-card.verify';
import '@/features/pc/entries/components/entry-kebab-menu.verify';
import '@/features/pc/entries/components/entry-list.verify';
import '@/features/pc/entries/components/fermentation-display-prompt-modal.verify';
import '@/features/pc/entries/components/fermentation-overlay-detail-pane.verify';
import '@/features/pc/entries/components/fermentation-sidebar.verify';
import '@/features/pc/entries/components/leave-confirm-modal.verify';
import '@/features/pc/entries/components/link-question-nudge-modal.verify';
import '@/features/pc/entries/components/pickle-confirm-modal.verify';
import '@/features/pc/entries/components/pickle-nudge-modal.verify';
import '@/features/pc/entries/components/question-chip.verify';
import '@/features/pc/entries/components/question-select-modal.verify';
import '@/features/pc/entries/components/save-title-modal.verify';
import '@/features/pc/entries/components/settings-drawer.verify';
import '@/features/pc/board/components/board-card.verify';
import '@/features/pc/board/components/board-controls.verify';
import '@/features/pc/board/components/board-date-nav.verify';
import '@/features/pc/board/components/entry-card-content.verify';
import '@/features/pc/board/components/photo-card-content.verify';
import '@/features/pc/board/components/photo-dialog.verify';
import '@/features/pc/board/components/snippet-card-content.verify';
import '@/features/pc/board/components/snippet-dialog.verify';
import '@/features/pc/fermentation/components/draggable-jar-element.verify';
import '@/features/pc/fermentation/components/pickle-success-modal.verify';
import '@/features/pc/fermentation/components/question-circle.verify';
import '@/features/pc/questions/components/question-create-form.verify';
import '@/features/pc/questions/components/question-timeline-event.verify';
import '@/features/pc/questions/components/question-timeline.verify';
import '@/features/sp/account/components/sp-account-page.verify';
import '@/features/sp/entries/components/sp-confirm-sheet.verify';
import '@/features/sp/entries/components/sp-entry-editor.verify';
import '@/features/sp/entries/components/sp-fermentation-drawer.verify';
import '@/features/sp/questions/components/sp-questions.verify';
import '@/features/onboarding/components/illustrations.verify';
import '@/features/onboarding/components/onboarding-flow.verify';
import '@/features/onboarding/components/steps.verify';
import '@/features/pc/entries/components/entry-editor.verify';
import '@/features/pc/board/components/board-view.verify';
import '@/features/pc/fermentation/components/detail-pane.verify';
import '@/features/pc/fermentation/components/jar-view.verify';
import '@/features/sp/entries/components/sp-entry-list.verify';
import '@/features/sp/fermentation/components/sp-jar.verify';
import '@/features/pc/account/components/account-page.verify';
import '@/features/auth/components/forgot-password-form.verify';
import '@/features/auth/components/login-form.verify';
import '@/features/pc/navigation/components/sidebar.verify';
import '@/features/auth/components/signup-form.verify';
// 画面ごとのロード枠（スケルトン）
import '@/features/pc/account/components/account-page-skeleton.verify';
import '@/features/pc/account/components/writing-stats-skeleton.verify';
import '@/features/pc/entries/components/entry-editor-skeleton.verify';
import '@/features/pc/entries/components/entry-list-skeleton.verify';
import '@/features/pc/questions/components/question-timeline-skeleton.verify';
import '@/features/sp/account/components/sp-account-page-skeleton.verify';
import '@/features/sp/entries/components/sp-entry-editor-skeleton.verify';
import '@/features/sp/entries/components/sp-entry-list-skeleton.verify';
import '@/features/sp/fermentation/components/sp-jar-skeleton.verify';
import '@/features/sp/questions/components/sp-questions-skeleton.verify';
// リファレンス用の自己完結サンプル（削除可）
import '@/lib/verify/example-progress.verify';

registerBuiltinVerifiers();
