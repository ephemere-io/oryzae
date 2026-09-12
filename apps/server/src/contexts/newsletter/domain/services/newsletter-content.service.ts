/**
 * ニュースレター本文（Markdown サブセット）を HTML とプレーンテキストに起こす。
 *
 * ## なぜ Markdown ライブラリを入れないか
 *
 * メール HTML は「ブラウザの HTML」ではない。Gmail は `<style>` を落とし、
 * Outlook は CSS の大半を解釈しない。素の Markdown → HTML 変換器が吐く
 * `<h1>` / `<ul>` は、インラインスタイルが無いぶんクライアントごとに別物に見える。
 * どのみち出力側を全部書き直すことになるので、入力側も「運営が書く範囲」に
 * 絞った自前の変換にしてある。対応するのは以下だけ:
 *
 *   # / ## / ###      見出し
 *   -                 箇条書き
 *   ---               区切り線
 *   **太字**
 *   [テキスト](URL)   リンク（http/https のみ）
 *   空行              段落の区切り
 *
 * ## エスケープの順序
 *
 * **先に HTML をエスケープしてから** インライン記法を適用する。逆にすると
 * 本文に書かれた `<script>` がそのまま HTML に落ちる。エスケープ後に
 * `[text](url)` を拾うので、URL 中の `&` は `&amp;` になった状態で href に入る
 * （これは HTML 属性としては正しい形）。
 *
 * リンク先は http / https のみ通す。`javascript:` や `data:` をメール本文から
 * 作れないようにするため（受信側クライアントがどう扱うかに依存したくない）。
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** href に置いてよい URL か。エスケープ後の文字列を受け取る前提。 */
function isSafeUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url);
}

/** エスケープ済みテキストにインライン記法を適用する。 */
function renderInline(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) =>
      isSafeUrl(url)
        ? `<a href="${url}" style="color:#8a6d3b;text-decoration:underline;">${label}</a>`
        : match,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'rule' }
  | { type: 'paragraph'; lines: string[] };

/**
 * 本文を段落・見出し・箇条書き・区切り線に切り分ける。
 *
 * HTML 生成とテキスト生成の両方がこの結果を使う。別々に解析すると、
 * 片方だけ記法を足したときに HTML とテキストの中身がずれる。
 */
export function parseNewsletterBody(bodyMarkdown: string): Block[] {
  const blocks: Block[] = [];
  // \r\n / \r も段落判定で拾えるよう先に \n へ揃える。
  const lines = bodyMarkdown.replace(/\r\n?/g, '\n').split('\n');

  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ type: 'list', items: list });
      list = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: heading[1].length === 1 ? 1 : heading[1].length === 2 ? 2 : 3,
        text: heading[2].trim(),
      });
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushAll();
      blocks.push({ type: 'rule' });
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

// メール内リンクは常に本番ドメインを指す（preview 環境から送っても受信者に
// とって vercel.app の URL は意味が無い）。fermentation の digest と同じ方針。
const APP_URL = 'https://oryzae.ephemere.io';
const SUPPORT_URL = `${APP_URL}/support`;
const PRIVACY_URL = `${APP_URL}/privacy`;
const CONTACT_EMAIL = 'oryzae@ephemere.io';

const FOOTER_LINES = [
  'このメールは Oryzae に登録されている方へお送りしています。',
  `ヘルプ・FAQ: ${SUPPORT_URL}`,
  `プライバシーポリシー: ${PRIVACY_URL}`,
  `配信停止・お問い合わせ: ${CONTACT_EMAIL}`,
  '— Oryzae / Ferment Media Research',
];

/**
 * 受信箱の一覧に出るプレビュー文（preheader）。
 *
 * 指定しないと多くのクライアントが本文の先頭 —— つまりヘッダーのロゴ alt や
 * 空白 —— を拾って意味の無い文字列を出す。本文の最初の段落から作る。
 */
export function buildPreheader(bodyMarkdown: string, limit = 120): string {
  const blocks = parseNewsletterBody(bodyMarkdown);
  const first = blocks.find((b) => b.type === 'paragraph' || b.type === 'heading');
  if (!first) return '';
  const text = first.type === 'heading' ? first.text : first.lines.join(' ');
  const plain = text.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/\*\*/g, '');
  return plain.length > limit ? `${plain.slice(0, limit - 1)}…` : plain;
}

function renderBlockHtml(block: Block): string {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? 22 : block.level === 2 ? 18 : 15;
      const top = block.level === 1 ? 0 : 28;
      return `<h${block.level} style="margin:${top}px 0 12px;font-size:${size}px;font-weight:600;line-height:1.5;color:#2b2b2b;">${renderInline(escapeHtml(block.text))}</h${block.level}>`;
    }
    case 'list': {
      const items = block.items
        .map(
          (item) =>
            `<li style="margin:0 0 6px;line-height:1.8;">${renderInline(escapeHtml(item))}</li>`,
        )
        .join('');
      return `<ul style="margin:0 0 16px;padding-left:20px;color:#2b2b2b;font-size:15px;">${items}</ul>`;
    }
    case 'rule':
      return '<hr style="border:none;border-top:1px solid #e5e0d8;margin:28px 0;" />';
    case 'paragraph': {
      const text = block.lines.map((line) => renderInline(escapeHtml(line))).join('<br />');
      return `<p style="margin:0 0 16px;line-height:1.9;font-size:15px;color:#2b2b2b;">${text}</p>`;
    }
  }
}

/**
 * メール用 HTML。
 *
 * インラインスタイルのみ（`<style>` は Gmail に落とされる）。幅は 600px で
 * 固定し、それより狭い画面では `max-width` で縮む。
 */
export function renderNewsletterHtml(params: { subject: string; bodyMarkdown: string }): string {
  const blocks = parseNewsletterBody(params.bodyMarkdown);

  const body = blocks.map(renderBlockHtml).join('\n      ');

  const footer = FOOTER_LINES.map(
    (line) =>
      `<p style="margin:0 0 4px;font-size:12px;line-height:1.7;color:#8a8279;">${renderInline(escapeHtml(line))}</p>`,
  ).join('\n        ');

  const preheader = escapeHtml(buildPreheader(params.bodyMarkdown));

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(params.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f3ee;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <div style="padding:32px 16px;">
      <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e5e0d8;border-radius:8px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;">
      <p style="margin:0 0 24px;font-size:12px;letter-spacing:0.08em;color:#8a8279;">ORYZAE</p>
      ${body}
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e0d8;">
        ${footer}
      </div>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * プレーンテキスト版。
 *
 * HTML を読まない / 読めない受信環境のために必ず併送する。HTML だけのメールは
 * スパム判定の材料にもなる。
 */
/** テキスト版では href が読めないので、リンクは「文字 (URL)」に開く。 */
function stripInline(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)').replace(/\*\*([^*]+)\*\*/g, '$1');
}

function renderBlockText(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${stripInline(block.text)}`;
    case 'list':
      return block.items.map((item) => `・${stripInline(item)}`).join('\n');
    case 'rule':
      return '———';
    case 'paragraph':
      return block.lines.map(stripInline).join('\n');
  }
}

export function renderNewsletterText(params: { subject: string; bodyMarkdown: string }): string {
  const body = parseNewsletterBody(params.bodyMarkdown).map(renderBlockText).join('\n\n');

  return [params.subject, '', body, '', '———', ...FOOTER_LINES].join('\n');
}
