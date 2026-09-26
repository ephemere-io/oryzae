/**
 * HelpToggleButton の検証スペック。
 *
 * 見張るのは「**開いている間も居る**」こと（押された状態で、もう一度押せば閉じる）と、
 * 「居場所を教えるときだけ名前を出す」こと。ふだんは「?」だけで、言葉は添えない。
 */

import { registerUnit } from '@oryzae/verify';
import { HelpToggleButton } from './help-toggle-button';

interface Props {
  open: boolean;
  cue: boolean;
}

const BUTTON = '[data-verify-unit="HelpToggleButton"] button';

registerUnit<Props>({
  id: 'HelpToggleButton',
  title: 'HelpToggleButton',
  description: '画面の右上の「?」。ヘルプの面をここから開き、ここから閉じる',
  kind: 'component',
  render: (props) => (
    <div className="relative h-[120px] w-[400px]">
      <HelpToggleButton open={props.open} cue={props.cue} label="ヘルプ" onClick={() => {}} />
    </div>
  ),
  fixtures: [
    { id: 'closed', description: '面は閉じている', props: { open: false, cue: false } },
    {
      id: 'open',
      description: '面が開いている（押された状態）',
      props: { open: true, cue: false },
    },
    {
      id: 'cue',
      probe: true,
      description: 'Probe: 初めての人が閉じた直後 — 脈打って、隣に名前',
      props: { open: false, cue: true },
    },
  ],
  invariants: [
    {
      id: 'pressed-follows-open',
      description: 'aria-pressed が open と一致する（開いている間も消えない）',
      check: ({ root, props }) => {
        const button = root.querySelector(BUTTON);
        if (!button) return '「?」が無い';
        return (
          button.getAttribute('aria-pressed') === String(props.open) ||
          `aria-pressed=${button.getAttribute('aria-pressed')}`
        );
      },
    },
    {
      id: 'label-only-while-cueing',
      description: '名前の文字は居場所を教えるときだけ',
      check: ({ root, props }) => {
        const text = (root.textContent ?? '').trim();
        return text.length > 0 === props.cue || `文字=${JSON.stringify(text)}, cue=${props.cue}`;
      },
    },
    {
      id: 'has-accessible-name',
      description: '「?」だけでも読み上げの名前を持つ',
      check: ({ root }) =>
        (root.querySelector(BUTTON)?.getAttribute('aria-label') ?? '').length > 0 ||
        'aria-label が無い',
    },
    {
      id: 'keeps-clear-of-the-panel',
      description: '面の幅（--help-width）のぶん左へ寄る（面の下に潜らない）',
      check: ({ root }) => {
        const wrap = root.querySelector<HTMLElement>('[data-verify-unit="HelpToggleButton"]');
        return (wrap?.style.right ?? '').includes('--help-width') || `right="${wrap?.style.right}"`;
      },
    },
  ],
});
