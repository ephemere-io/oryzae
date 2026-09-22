import { verifyAttrs } from '@oryzae/verify';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { HelpTopic, HelpTopicText } from '../types';
import { HelpIllustration } from './help-illustrations';

export interface HelpLiveCardProps {
  topic: HelpTopic;
  text: HelpTopicText;
  /** ポインタの下の物を映しているか（false なら、いま開いている画面）。契約に出すだけ。 */
  following: boolean;
}

/**
 * 面の頭にある「生きている 1 枚」。触れているものの説明が、ここで切り替わる。
 *
 * **見出しも、ボタンも、説明の説明も置かない。** 触れるたびに中身が変わる、それ自体が
 * 「ここは触れているものを映す面だ」と伝える（Ableton Live の Info View と同じ作り —
 * 名前と一段落だけ）。「カーソルを載せると説明が出ます」と書いた版は、書かなくても
 * 分かることを言葉にしていた。「開く」のボタンを置いた版は、ボタンへ向かう途中で別の
 * 物に触れて中身が変わるので、押せた試しが無かった。行き先へは下の一覧から行く。
 *
 * 切り替わるときは 1 枚がふっと入れ替わる（`help-fade`）。動きが「変わった」ことを言う。
 */
export function HelpLiveCard({ topic, text, following }: HelpLiveCardProps) {
  return (
    <section
      {...verifyAttrs({ unit: 'HelpLiveCard', topic: topic.id, following })}
      aria-live="polite"
      className="rounded-[14px] border px-5 pt-5 pb-6"
      style={{
        background: 'var(--surface-raised)',
        borderColor: 'var(--surface-raised-border)',
        ...CONTROL_FONT,
      }}
    >
      {/* key で 1 枚ごと作り直す。同じ箱の中で字だけ差し替わると、変わったことが見えない。 */}
      <div key={topic.id} className="help-fade">
        <HelpIllustration kind={topic.illustration} size={88} />
        <h2 className="mt-3 text-[15px] font-medium leading-snug text-[var(--fg)]">{text.title}</h2>
        <p className="mt-1 text-[12px] leading-[1.6] text-[var(--date-color)]">{text.lead}</p>
        <p className="mt-3 text-[13px] leading-[1.85] text-[var(--fg)] opacity-85">{text.body}</p>
      </div>
    </section>
  );
}
