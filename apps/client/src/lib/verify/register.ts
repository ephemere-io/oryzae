/**
 * 検証ユニットの登録バレル。
 *
 * ビルトイン verifier を登録し、各 feature の `*.verify` を import（自己登録）する。
 * 横展開時はここに `import './<feature>/<x>.verify';` を1行ずつ足すだけ。
 *
 * このバレルは「CIマトリクス（test）」「dashboard ルート」「window.__verify」の3経路から
 * import され、同じレジストリを共有する。
 */

import { registerBuiltinVerifiers } from '@oryzae/verify';
import './example-progress.verify';

registerBuiltinVerifiers();
