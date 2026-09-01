/**
 * ConceptIllo の検証スペック（A 移植）。
 * オンボーディングの装飾 SVG イラスト群（illustrations.tsx）の代表として ConceptIllo を登録する。
 * これらは props も i18n も router もデータ取得も持たない純粋な装飾 SVG（aria-hidden="true"）。
 *
 * 検証の主眼は「装飾のまま留まること」: a11y ツリーから外れている（aria-hidden="true"）かつ
 * role / <title> を持たない、という装飾コントラクトを invariant で守る。装飾アセットに
 * 良かれと思って role や <title> を足す／aria-hidden を外すのは退行なので、それを捕まえる。
 *
 * 1ファイル1ユニットの規約（同 feature の steps.verify.tsx も多コンポーネント源ファイルから
 * 代表1つだけ登録）に従い ConceptIllo を代表に据える。QuestionIllo/EditorIllo/JarIllo にも
 * verifyAttrs は付与済み（源ファイルの一貫した移植）。props が無いため fixture は1つで、
 * それを probe にする（matrix の「probe を最低1つ」を満たす）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { ConceptIllo } from './illustrations';

type Props = Record<string, never>;

registerUnit<Props>({
  id: 'ConceptIllo',
  title: 'ConceptIllo',
  description: 'オンボーディングの装飾 SVG イラスト（a11y ツリーから外れた純粋な装飾）。',
  kind: 'component',
  render: () => withVerifyProviders(<ConceptIllo />),
  fixtures: [
    {
      id: 'default',
      probe: true,
      description:
        'Probe: 装飾 SVG が a11y ツリーから外れたまま（aria-hidden 維持・role/title なし）描画される',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'svg-self-identifies',
      description: '契約付きの <svg> が描画され data-verify-unit="ConceptIllo" を名乗る',
      check: ({ root, contract }) => {
        const svg = root.querySelector('svg[data-verify-unit="ConceptIllo"]');
        return (
          (svg !== null && contract.unit === 'ConceptIllo') ||
          `契約付き svg が見つからない: svg=${svg !== null}, contract.unit=${contract.unit}`
        );
      },
    },
    {
      id: 'stays-decorative',
      description: '装飾のまま: aria-hidden="true" を維持し contract.decorative=true',
      check: ({ root, contract }) => {
        const svg = root.querySelector('svg[data-verify-unit="ConceptIllo"]');
        const ariaHidden = svg?.getAttribute('aria-hidden');
        return (
          (ariaHidden === 'true' && contract.decorative === 'true') ||
          `装飾コントラクト違反: aria-hidden=${ariaHidden}, contract.decorative=${contract.decorative}`
        );
      },
    },
    {
      id: 'not-in-a11y-tree',
      description: '装飾なので a11y ツリーに露出しない（role 属性も <title> 子も持たない）',
      check: ({ root }) => {
        const svg = root.querySelector('svg[data-verify-unit="ConceptIllo"]');
        const hasRole = svg?.hasAttribute('role') ?? false;
        const hasTitle = svg?.querySelector('title') != null;
        return (
          (!hasRole && !hasTitle) ||
          `装飾 SVG が a11y ツリーに露出している: role=${hasRole}, title=${hasTitle}`
        );
      },
    },
  ],
});
