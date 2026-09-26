const POSTHOG_PROJECT_URL = 'https://us.posthog.com/project/378500';

/**
 * 深掘りは PostHog で行う。admin に作り直さないもの（docs/observability-guide.md）。
 *
 * ファネル・リテンション・経路分析は問いごとに組み替えるもので、admin に固定の
 * 画面を作ると問いが変わるたびに作り直しになる。PostHog の Insight を保存して使う。
 */
const POSTHOG_DEEP_LINKS = [
  { label: 'Web analytics', note: '流入元・端末・ページごとの推移', path: '/web' },
  { label: 'Insights', note: 'ファネル・リテンション・経路', path: '/insights' },
  { label: 'Persons', note: 'ある人が何をしたかの時系列', path: '/persons' },
  { label: 'Feature flags', note: '機能の段階公開', path: '/feature_flags' },
];

export function PostHogLinks() {
  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        PostHog で見る
      </h3>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {POSTHOG_DEEP_LINKS.map((link) => (
          <a
            key={link.label}
            href={`${POSTHOG_PROJECT_URL}${link.path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-baseline gap-1.5 text-sm"
          >
            <span className="font-medium group-hover:underline">{link.label}</span>
            <span className="text-xs text-muted-foreground">{link.note}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
