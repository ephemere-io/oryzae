/**
 * EntryKebabMenu の検証スペック（A 移植）。
 * 開閉状態を持つケバブメニュー。状態を data-verify-open として公表し、
 * 「aria-expanded と契約の一致」「クリックで開く」「削除クリックで閉じる」を
 * invariant＋act で孤立検証する。i18n（entries.kebab）依存のため
 * withVerifyProviders（NextIntlClientProvider）で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { EntryKebabMenu } from './entry-kebab-menu';

interface Props {
  onDeleteClick: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'EntryKebabMenu',
  title: 'EntryKebabMenu',
  description: 'エントリ操作のケバブメニュー（開閉状態を持ち、削除を発火する）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryKebabMenu {...props} />),
  fixtures: [
    {
      id: 'closed',
      description: '初期状態（閉じている）',
      props: { onDeleteClick: noop },
    },
    {
      id: 'opened',
      description: 'ケバブをクリックしてメニューを開く',
      props: { onDeleteClick: noop },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
    {
      id: 'delete-closes',
      description: '開いた後に削除を押すとメニューが閉じる',
      props: { onDeleteClick: noop },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
        await ctx.click('[role="menuitem"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'double-toggle',
      probe: true,
      description: 'Probe: ケバブを2回押すと開いて閉じる（トグル対称性で open=false に戻る）',
      props: { onDeleteClick: noop },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'aria-expanded-matches-contract',
      description: 'ケバブ button[aria-expanded] が data-verify-open と一致する',
      check: ({ root, contract }) => {
        const btn = root.querySelector('button[aria-haspopup="menu"]');
        const expanded = btn?.getAttribute('aria-expanded');
        return (
          expanded === contract.open ||
          `aria-expanded="${expanded}", contract.open="${contract.open}"`
        );
      },
    },
    {
      id: 'menu-present-iff-open',
      description: 'role=menu は open=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasMenu = Boolean(root.querySelector('[role="menu"]'));
        const expectOpen = contract.open === 'true';
        return (
          hasMenu === expectOpen || `menu present=${hasMenu} だが contract.open="${contract.open}"`
        );
      },
    },
    {
      id: 'default-collapsed',
      description: '初期状態は閉じている（open=false）',
      onlyFixtures: ['closed'],
      check: ({ contract }) =>
        contract.open === 'false' || `expected open=false, got "${contract.open}"`,
    },
    {
      id: 'opens-on-click',
      description: 'ケバブクリック後は開いている（open=true）',
      onlyFixtures: ['opened'],
      check: ({ contract }) =>
        contract.open === 'true' || `expected open=true after click, got "${contract.open}"`,
    },
    {
      id: 'closes-on-delete',
      description: '削除クリック後はメニューが閉じる（open=false）',
      onlyFixtures: ['delete-closes'],
      check: ({ contract }) =>
        contract.open === 'false' ||
        `expected open=false after delete click, got "${contract.open}"`,
    },
  ],
});
