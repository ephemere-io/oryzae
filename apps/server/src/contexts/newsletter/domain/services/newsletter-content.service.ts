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

import type { NewsletterLocale } from '../models/newsletter-locale.js';

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

/**
 * フッター頭に置くロゴ。PWA アイコンの PNG を流用する。
 *
 * **SVG は使えない。** Gmail は `<img src="*.svg">` を表示しない。データ URI も
 * 同様に落とされるので、公開 URL の PNG 以外に選択肢が無い。192px の実寸を
 * 40px で出すので、高 DPI でも粗くならない。
 */
const LOGO_URL = `${APP_URL}/icon-192`;

/** 配信停止ページ。`?token=` に本人証明を載せる（`UnsubscribeTokenGateway`）。 */
export function buildUnsubscribeUrl(token: string): string {
  return `${APP_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * プレビュー用の URL。
 *
 * 管理画面のプレビューにも配信停止リンクを**出す**（出さないと、実際に届く
 * メールと見えているものがずれる）。ただし署名の無い token を載せるので、
 * 押しても誰も配信停止にならない。
 */
export const PREVIEW_UNSUBSCRIBE_URL = buildUnsubscribeUrl('preview');

/**
 * テスト配信の件名に付ける印。
 *
 * 受信箱で本番配信と見分けられないと、「届いた」のがテストなのか本番なのか
 * 分からなくなる（そして本番を二度撃つ）。本文は本番と同一にして、件名だけ
 * 印を付ける。言語も入れるのは、運営者が言語ごとに 1 通ずつ受け取るため
 * （どれがどれか分からないと確認にならない）。
 */
export function withTestSubjectPrefix(subject: string, locale: NewsletterLocale): string {
  return `[テスト配信/${locale}] ${subject}`;
}

/**
 * フッターと配信停止の案内は **本文と同じ言語で出す**。
 *
 * 本文だけ訳してここを日本語のままにすると、英語話者にとって「止め方が読めない
 * メール」になる。止める口が読めないのは、止める口が無いのとほぼ同じで、
 * 迷惑メール報告のほうが早くなる。
 *
 * この 4 言語ぶんは運営が書いた固定文で、**LLM には訳させない**。毎回訳すと
 * 配信ごとに言い回しが揺れるし、配信停止の文言が翻訳事故で意味を変えると
 * そのまま害になる（「停止する」が「再開する」になる類）。
 *
 * 配信停止の案内をフッターの他の行に混ぜず独立させているのは、止めたい人に
 * 探させないため。探させると迷惑メール報告のほうが早くなり、送信ドメイン全体の
 * 到達率が落ちる。
 */
interface FooterCopy {
  /** `<html lang>` に入れる値。読み上げと受信側の自動翻訳の判定に効く。 */
  htmlLang: string;
  lines: string[];
  unsubscribeLabel: string;
  unsubscribeNote: string;
}

const FOOTER_COPY: Record<NewsletterLocale, FooterCopy> = {
  ja: {
    htmlLang: 'ja',
    lines: [
      'このメールは Oryzae に登録されている方へお送りしています。',
      `ヘルプ・FAQ: ${SUPPORT_URL}`,
      `プライバシーポリシー: ${PRIVACY_URL}`,
      `お問い合わせ: ${CONTACT_EMAIL}`,
      '— Oryzae / Ferment Media Research',
    ],
    unsubscribeLabel: 'このお知らせの配信を停止する',
    unsubscribeNote: '（停止してもアカウントと日記はそのまま残ります）',
  },
  en: {
    htmlLang: 'en',
    lines: [
      'You are receiving this because you have an Oryzae account.',
      `Help & FAQ: ${SUPPORT_URL}`,
      `Privacy: ${PRIVACY_URL}`,
      `Contact: ${CONTACT_EMAIL}`,
      '— Oryzae / Ferment Media Research',
    ],
    unsubscribeLabel: 'Unsubscribe from these announcements',
    unsubscribeNote: '(Your account and journal entries stay exactly as they are.)',
  },
  zh: {
    htmlLang: 'zh',
    lines: [
      '您收到这封邮件，是因为您注册了 Oryzae。',
      `帮助与常见问题: ${SUPPORT_URL}`,
      `隐私政策: ${PRIVACY_URL}`,
      `联系我们: ${CONTACT_EMAIL}`,
      '— Oryzae / Ferment Media Research',
    ],
    unsubscribeLabel: '停止接收此类通知邮件',
    unsubscribeNote: '（停止后，您的账户和日记将原样保留。）',
  },
  ko: {
    htmlLang: 'ko',
    lines: [
      'Oryzae에 가입하신 분께 보내 드리는 메일입니다.',
      `도움말 및 FAQ: ${SUPPORT_URL}`,
      `개인정보 보호정책: ${PRIVACY_URL}`,
      `문의: ${CONTACT_EMAIL}`,
      '— Oryzae / Ferment Media Research',
    ],
    unsubscribeLabel: '이 안내 메일 수신 중지',
    unsubscribeNote: '(중지해도 계정과 일기는 그대로 남아 있습니다.)',
  },
};

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
export function renderNewsletterHtml(params: {
  subject: string;
  bodyMarkdown: string;
  /** 受信者ごとの配信停止 URL。`buildUnsubscribeUrl` で作る。 */
  unsubscribeUrl: string;
  /** 本文の言語。フッターと配信停止の案内をこの言語で出す。 */
  locale: NewsletterLocale;
}): string {
  const copy = FOOTER_COPY[params.locale];
  const blocks = parseNewsletterBody(params.bodyMarkdown);

  const body = blocks.map(renderBlockHtml).join('\n      ');

  // フッターの頭のロゴ。押すとトップページへ。
  //
  // メール向けの作法をいくつか踏んでいる:
  //   - width / height を **属性でも** 指定する（Outlook は CSS の寸法を無視する）
  //   - `border:0` — リンクした画像に枠線を描くクライアントがある
  //   - `display:block` — 画像下のベースライン分の隙間を消す
  //   - `alt` を入れる。**画像は既定でブロックされることが多く**、そのとき
  //     ここだけが手がかりになる
  const logo =
    `<div style="text-align:center;margin:0 0 16px;">` +
    `<a href="${APP_URL}" style="display:inline-block;text-decoration:none;">` +
    `<img src="${LOGO_URL}" alt="Oryzae" width="40" height="40" ` +
    `style="display:block;width:40px;height:40px;border:0;outline:none;border-radius:8px;" />` +
    `</a></div>`;

  const unsubscribe =
    `<p style="margin:0 0 10px;font-size:12px;line-height:1.7;color:#8a8279;">` +
    `<a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#8a6d3b;text-decoration:underline;">${escapeHtml(copy.unsubscribeLabel)}</a>` +
    `<br />${escapeHtml(copy.unsubscribeNote)}</p>`;

  const footer = copy.lines
    .map(
      (line) =>
        `<p style="margin:0 0 4px;font-size:12px;line-height:1.7;color:#8a8279;">${renderInline(escapeHtml(line))}</p>`,
    )
    .join('\n        ');

  const preheader = escapeHtml(buildPreheader(params.bodyMarkdown));

  return `<!doctype html>
<html lang="${copy.htmlLang}">
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
        ${logo}
        ${unsubscribe}
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

export function renderNewsletterText(params: {
  subject: string;
  bodyMarkdown: string;
  unsubscribeUrl: string;
  locale: NewsletterLocale;
}): string {
  const copy = FOOTER_COPY[params.locale];
  const body = parseNewsletterBody(params.bodyMarkdown).map(renderBlockText).join('\n\n');

  return [
    params.subject,
    '',
    body,
    '',
    '———',
    `${copy.unsubscribeLabel}: ${params.unsubscribeUrl}`,
    copy.unsubscribeNote,
    '',
    ...copy.lines,
  ].join('\n');
}
