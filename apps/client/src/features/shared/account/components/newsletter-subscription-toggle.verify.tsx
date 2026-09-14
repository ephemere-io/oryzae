/**
 * NewsletterSubscriptionToggle の検証スペック。
 *
 * このトグルが嘘をつくと「止めたつもりが届く」「受け取るつもりが届かない」に
 * 直結する。固定するのは:
 *   1. 現在値が読めていないときはトグルを出さない（仮の既定値を触らせない）
 *   2. 画面の ON は「受け取る」（保存は opt-out なので反転している）
 *   3. 保存中は触れない（連打で往復させない）
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import {
  NewsletterSubscriptionToggle,
  type NewsletterSubscriptionToggleProps,
} from './newsletter-subscription-toggle';

type Props = Omit<NewsletterSubscriptionToggleProps, 'onChange'>;

registerUnit<Props>({
  id: 'NewsletterSubscriptionToggle',
  title: 'NewsletterSubscriptionToggle',
  description: 'アカウント設定の「お知らせメールを受け取る」1 行',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(<NewsletterSubscriptionToggle {...props} onChange={() => {}} />),
  fixtures: [
    {
      id: 'subscribed',
      description: '受け取る（既定）',
      props: { subscribed: true, saving: false, failed: false },
    },
    {
      id: 'unsubscribed',
      description: '配信停止中',
      props: { subscribed: false, saving: false, failed: false },
    },
    {
      id: 'unavailable',
      probe: true,
      description: 'Probe: 現在値が読めていない — トグル自体を出さない',
      props: { subscribed: null, saving: false, failed: false },
    },
    {
      id: 'saving',
      probe: true,
      description: 'Probe: 保存中 — 触れない',
      props: { subscribed: true, saving: true, failed: false },
    },
    {
      id: 'failed',
      description: '保存に失敗（値は動かさず理由だけ出す）',
      props: { subscribed: true, saving: false, failed: true },
    },
  ],
  invariants: [
    {
      id: 'no-toggle-without-current-value',
      description: '現在値が読めていないときはトグルを出さない（仮の既定値を保存させない）',
      check: ({ root, props }) => {
        const input = root.querySelector('input[type="checkbox"]');
        if (props.subscribed === null) {
          return input === null || '現在値が不明なのにトグルを出している';
        }
        return input !== null || '現在値があるのにトグルが無い';
      },
    },
    {
      id: 'checked-means-receiving',
      description: 'チェックが入っている = 受け取る（保存値 opt-out の反転）',
      check: ({ root, props }) => {
        if (props.subscribed === null) return true;
        const input = root.querySelector('input[type="checkbox"]');
        const checked = input instanceof HTMLInputElement ? input.checked : null;
        return checked === props.subscribed || `checked が subscribed と一致しない: ${checked}`;
      },
    },
    {
      id: 'disabled-while-saving',
      description: '保存中は触れない（連打で往復させない）',
      check: ({ root, props }) => {
        if (props.subscribed === null) return true;
        const input = root.querySelector('input[type="checkbox"]');
        const disabled = input instanceof HTMLInputElement ? input.disabled : null;
        return disabled === props.saving || `disabled が saving と一致しない: ${disabled}`;
      },
    },
    {
      id: 'failure-is-visible',
      description: '保存に失敗したら黙らない',
      check: ({ root, props }) => {
        if (!props.failed) return true;
        return (
          root.querySelector('.text-red-500') !== null ||
          '保存に失敗したのに画面に何も出ていない（止めたつもりで届き続ける）'
        );
      },
    },
  ],
});
