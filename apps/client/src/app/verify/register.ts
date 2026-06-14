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
import '@/features/landing/components/landing-faq-item.verify';
// リファレンス用の自己完結サンプル（削除可）
import '@/lib/verify/example-progress.verify';

registerBuiltinVerifiers();
