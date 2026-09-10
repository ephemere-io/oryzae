import { Hono } from 'hono';
import {
  type ActualCostResult,
  ANTHROPIC_COST_CONSOLE_URL,
  fetchActualCost,
  type ModelActualCost,
} from '../../infrastructure/anthropic-cost-api.js';
import {
  FERMENTATION_MODEL_ID,
  FERMENTATION_MODEL_RATE,
  featureOfModel,
} from '../../infrastructure/claude-pricing.js';
import { type ActualCostTrend, summarizeActualCostTrend } from '../../infrastructure/cost-trend.js';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';
import {
  aggregateCost,
  type CostAggregate,
  fetchFermentationCostRows,
  type UserCostAggregate,
} from '../../infrastructure/fermentation-cost-query.js';
import {
  jstTimeRangeOfUtcDay,
  previousUtcDateKey,
  toUtcDateKey,
  utcDayBounds,
  utcDayRangeIso,
  utcMonthBounds,
} from '../../infrastructure/jst-day.js';
import { getSupabaseClient } from '../../infrastructure/supabase-client.js';
import { createCronAuthMiddleware } from '../middleware/cron-auth.js';

const DAILY_COST_THRESHOLD_USD = 1.0;
/** Discord の1フィールドに詰め込みすぎないための上限。 */
const TOP_USER_COUNT = 5;
/**
 * 推定と実額の乖離を「要確認」と計算根拠の表示に回す閾値。
 *
 * 推定は前提（単一モデル・キャッシュ無し）が崩れると静かにズレる。ズレたときだけ
 * 計算の中身を出せば、平常時のレポートを短く保ったまま切り分けができる。
 */
const DIVERGENCE_NOTICE_RATIO = 0.05;
/**
 * 「この金額は何から発生したか」を確かめに行く先。
 *
 * 管理画面 (Observability → AI Spend) は用途別の実額と発酵の推定を並べて出す。
 * Anthropic Console は原本で、モデル別に加えて API キー別にも割れる。
 * 本番 URL の直書きは send-fermentation-digest.usecase.ts と同じ扱い。
 */
const ADMIN_SPEND_URL = 'https://oryzae-admin.vercel.app/observability/spend';

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

type ActualCostOk = Extract<ActualCostResult, { kind: 'ok' }>;

/**
 * 金額表記。発酵 1 件は $0.06 規模なので $1 未満は 4 桁で出す。$1 以上は 2 桁——
 * 月末の見込みを `$9.4275` と書いても、下 2 桁は読む人にとって意味を持たない。
 */
function usd(value: number): string {
  return Math.abs(value) >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

function tokens(value: number): string {
  return value.toLocaleString('en-US');
}

/** JSON レスポンス用。マイクロドル単位で丸める。 */
function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** M/D 表記。タイトルに YYYY-MM-DD を置くと幅を食う。 */
function shortDate(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;
}

function percent(ratio: number): string {
  const sign = ratio >= 0 ? '+' : '-';
  return `${sign}${Math.abs(ratio * 100).toFixed(0)}%`;
}

function fermentationActualUsd(byModel: ModelActualCost[]): number {
  return byModel.find((m) => m.model === FERMENTATION_MODEL_ID)?.costUsd ?? 0;
}

/** 推定と実額のズレ。実額が 0 のときは比率にならないので null。 */
function divergenceRatio(estimatedUsd: number, actualUsd: number): number | null {
  if (actualUsd <= 0) return null;
  return (estimatedUsd - actualUsd) / actualUsd;
}

/**
 * 実額の内訳 1 行。読む人が知りたいのは「何に」であってモデル名ではないので、用途を前に出す。
 *
 * 用途に読み替えられないモデルにはその旨を添える。アプリの機能のモデルはすべて
 * featureOfModel に登録されているはずだが、#529 のように登録漏れで落ちてくることも
 * あるので「アプリ外」と言い切らない。`(web_search)` `(内訳なし)` のような括弧付きは
 * モデルではなく cost_type の受け皿（anthropic-cost-api.ts の modelKeyOf）なのでそのまま。
 */
function formatModelLine(m: ModelActualCost): string {
  const feature = featureOfModel(m.model);
  if (feature) return `${feature} (${m.model})  ${usd(m.costUsd)}`;
  if (m.model.startsWith('(')) return `${m.model}  ${usd(m.costUsd)}`;
  return `${m.model}  ${usd(m.costUsd)}  ← 用途不明（アプリ外の利用か登録漏れ）`;
}

/**
 * 金額と前日。単日の金額だけでは多いのか少ないのか判断できない。
 * ページング打ち切りは過少集計なので、黙って完全な実額のように見せない。
 */
function formatHeadline(actual: ActualCostOk, trend: ActualCostTrend | null): string {
  const amount = actual.truncated
    ? `${usd(actual.totalCostUsd)} ※集計打ち切り・過少`
    : usd(actual.totalCostUsd);
  if (!trend) return amount;
  if (trend.previousUsd === null) return `${amount}（前日 データなし）`;
  const change = trend.changeRatio === null ? '' : ` ${percent(trend.changeRatio)}`;
  return `${amount}（前日 ${usd(trend.previousUsd)}${change}）`;
}

function formatBreakdownLines(actual: ActualCostOk): string[] {
  // grouping が効いていないと総額は正しいまま内訳だけ消えるので、その旨を出す。
  if (actual.groupingUnavailable) {
    return ['内訳が取れませんでした（group_by が効いていない可能性）。総額は正しい値です'];
  }
  if (actual.byModel.length === 0) return ['この日の課金なし'];
  return actual.byModel.map(formatModelLine);
}

/**
 * 請求額の欄。金額・前日・内訳・確認先を 1 つの欄に縦に並べる。
 *
 * 旧版は「実請求額」「今月の累計」「月末の見込み」を inline の 3 カラムに並べていたが、
 * Discord の inline は幅に応じて折り返し、スマホでは列が崩れて読めない。
 * 「$0.6043 が何から発生したか」は金額の直下に書く。別欄に離すと探すことになる。
 * 取得できないときに $0 を出さない方針は変えていない。
 */
function buildActualField(actual: ActualCostResult, trend: ActualCostTrend | null): DiscordField {
  const lines: string[] = [];
  if (actual.kind === 'not-configured') {
    lines.push('取得できません（ANTHROPIC_ADMIN_KEY 未設定）');
  } else if (actual.kind === 'error') {
    lines.push(`取得失敗: ${actual.message.slice(0, 80)}`);
  } else {
    lines.push(formatHeadline(actual, trend));
    lines.push(...formatBreakdownLines(actual));
    // 実請求は org 全体の額。Oryzae のアプリ以外（CI のセキュリティレビュー・
    // 手元の検証など）も含むので、用途の行にそれらが混ざりうる。
    lines.push('※ Anthropic の org 全体の実額。同じモデルを CI などが使えば同じ行に混ざる');
  }
  lines.push(
    `[管理画面で確認](${ADMIN_SPEND_URL})・[Anthropic Console](${ANTHROPIC_COST_CONSOLE_URL})`,
  );
  return { name: '請求額', value: lines.join('\n'), inline: false };
}

/**
 * 今月の累計と月末の見込み。
 * 見込みは平均の単純延長であって予測モデルではない。式をそのまま添えて、
 * どう出した数字かをレポート内で読み切れるようにする。
 */
function buildTrendField(trend: ActualCostTrend): DiscordField {
  return {
    name: '今月の累計と見込み',
    value: [
      `${trend.elapsedDays} 日分の累計 ${usd(trend.monthToDateUsd)}`,
      `このペースだと月末に ${usd(trend.projectedMonthEndUsd)}（1 日平均 ${usd(trend.dailyAverageUsd)} × ${trend.daysInMonth} 日）`,
    ].join('\n'),
    inline: false,
  };
}

/**
 * 発酵の中身（何件・何人に・1 件いくら）。金額だけでは使われ方の変化が読めない。
 * 0 件の日は「0 人」「1 件あたり -」を並べても読むものが無いので 1 行にする。
 */
function buildFermentationField(aggregate: CostAggregate): DiscordField {
  const count = aggregate.fermentationCount;
  if (count === 0) return { name: '発酵', value: '0 件', inline: false };

  const perRun = usd(aggregate.estimatedCostUsd / count);
  const inPerRun = tokens(Math.round(aggregate.inputTokens / count));
  const outPerRun = tokens(Math.round(aggregate.outputTokens / count));
  return {
    name: '発酵',
    value: [
      `${count} 件（成功 ${aggregate.completedCount} / 失敗 ${aggregate.failedCount}）・${aggregate.byUser.length} 人`,
      `1 件あたり 推定 ${perRun}（入 ${inPerRun} / 出 ${outPerRun} tok）`,
    ].join('\n'),
    inline: false,
  };
}

/**
 * ユーザー別内訳。Discord は内部運用チャンネルだが、既存の発酵 cron 通知が
 * userId.slice(0, 8) 表記なのに合わせ、メールアドレスは送らない。
 * メール付きの内訳は admin の /costs 画面で見られる。
 *
 * 末尾の注記は「なぜここだけ推定なのか」の説明。実額と並んだときに、注記の無い
 * 推定値は「意味の分からない2つ目の金額」にしか見えない。
 */
function formatUserBreakdown(byUser: UserCostAggregate[]): string {
  if (byUser.length === 0) return 'この日の発酵は 0 件';
  const top = byUser.slice(0, TOP_USER_COUNT);
  const lines = top.map(
    (u) => `${u.userId.slice(0, 8)}  ${usd(u.estimatedCostUsd)}  ${u.fermentationCount} 件`,
  );
  const rest = byUser.length - top.length;
  if (rest > 0) lines.push(`…他 ${rest} 名`);
  lines.push('※ 実額はユーザー別に取れないため、ここだけトークン×単価の推定');
  return lines.join('\n');
}

/**
 * 推定コストの計算式をそのまま出す。
 *
 * 平常時は出さない。**実額とズレたとき**と**実額が取れないとき**——
 * つまり計算そのものを疑う場面でだけ出す。
 */
function formatBasis(inputTokens: number, outputTokens: number): string {
  const rate = FERMENTATION_MODEL_RATE;
  const inUsd = (inputTokens * rate.inputUsdPerMTok) / 1_000_000;
  const outUsd = (outputTokens * rate.outputUsdPerMTok) / 1_000_000;
  return [
    `発酵 (${FERMENTATION_MODEL_ID})`,
    `  in  ${tokens(inputTokens)} × $${rate.inputUsdPerMTok.toFixed(2)}/MTok = $${inUsd.toFixed(6)}`,
    `  out ${tokens(outputTokens)} × $${rate.outputUsdPerMTok.toFixed(2)}/MTok = $${outUsd.toFixed(6)}`,
    `  → $${(inUsd + outUsd).toFixed(6)}`,
  ].join('\n');
}

/**
 * 平常時は出さず、確認が要るときだけ出す。毎日「未計上 0 件」を出していると、
 * 本当に 1 件出た日に読み飛ばす。
 */
function buildNotices(params: {
  aggregate: CostAggregate;
  actual: ActualCostResult;
  divergence: number | null;
  rowsTruncated: boolean;
  thresholdExceeded: boolean;
}): string[] {
  const { aggregate, actual, divergence, rowsTruncated, thresholdExceeded } = params;
  const notices: string[] = [];

  if (thresholdExceeded) {
    notices.push(`日次閾値 $${DAILY_COST_THRESHOLD_USD.toFixed(2)} を超えた`);
  }
  if (
    actual.kind === 'ok' &&
    divergence !== null &&
    Math.abs(divergence) >= DIVERGENCE_NOTICE_RATIO
  ) {
    // 比べた 2 つの数字をここに書く。平常時のレポートからは突き合わせの行を消したので、
    // ズレた日に読む人が探さなくて済むようにする。
    notices.push(
      `発酵の推定 ${usd(aggregate.estimatedCostUsd)} が同モデルの実額 ${usd(fermentationActualUsd(actual.byModel))} と ${percent(divergence)} ずれている — モデル変更・プロンプトキャッシュ・単価改定を確認`,
    );
  }
  if (aggregate.untrackedCount > 0) {
    notices.push(`トークン未記録 ${aggregate.untrackedCount} 件 — その分は推定に乗っていない`);
  }
  if (rowsTruncated) {
    notices.push('発酵の件数が上限を超えた — 件数・トークン・内訳は過少');
  }
  if (actual.kind === 'ok' && actual.truncated) {
    notices.push('実額のページングを打ち切った — 請求額は過少');
  }
  return notices;
}

/**
 * 月初からの日別バケットを取って前日比・累計・見込みを作る。
 *
 * 対象日の実額が取れていないとき（未設定・失敗）は、月の傾向だけ出しても読めないので
 * 取りに行かない。取得に失敗しても対象日のレポートは出したいので、失敗は null に
 * 落として縮退する。対象が 1 日のときは前日が先月になるため、前日ぶんだけ範囲を広げる。
 */
async function fetchTrend(
  actual: ActualCostResult,
  dateKey: string,
): Promise<ActualCostTrend | null> {
  if (actual.kind !== 'ok') return null;

  const { start: monthStart } = utcMonthBounds(dateKey);
  const { start: previousDayStart } = utcDayBounds(previousUtcDateKey(dateKey));
  const { end: targetDayEnd } = utcDayBounds(dateKey);
  const rangeStart = previousDayStart < monthStart ? previousDayStart : monthStart;

  const monthly = await fetchActualCost(rangeStart, targetDayEnd);
  if (monthly.kind !== 'ok') return null;
  return summarizeActualCostTrend(monthly.daily, dateKey);
}

export const cronCostAlert = new Hono()
  .use(
    '*',
    createCronAuthMiddleware({
      routeName: 'cron-cost-alert',
      discordTitlePrefix: 'コスト cron',
    }),
  )
  .post('/', async (c) => {
    try {
      const supabase = getSupabaseClient();

      // 対象は実行時刻の直前に閉じた UTC 日。JST 10:00 (= UTC 01:00) 実行なので
      // 「JST 前日 9:00 〜 当日 9:00」を、閉じてから 1 時間後に読む
      // （cost_report の反映ラグは通常 5 分程度）。
      //
      // 実額（UTC 日固定）と発酵の件数を **同じ窓** で切るのが肝。旧版は件数だけ JST 日で
      // 切っていたため、冒頭で毎回 JST と UTC の対応を説明することになり、読む人には
      // 何時から何時の話か分からなかった。定期発酵（JST 03:00）はこの窓の中に入る。
      const dateKey = previousUtcDateKey(toUtcDateKey(new Date()));
      const { startIso, endIso } = utcDayRangeIso(dateKey);

      // issue #352 以降 generation_id は NULL 固定。旧実装はこれを NOT NULL で
      // 絞っていたため対象が常に0件になり、レポートが毎日 $0.0000 になっていた。
      // 保存済みトークンから推定コストを出す方式に切替える。
      let rows: Awaited<ReturnType<typeof fetchFermentationCostRows>>;
      try {
        rows = await fetchFermentationCostRows(supabase, { startIso, endIso });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[cron-cost-alert] Supabase query failed', { error: message });
        await notifyDiscord({
          title: 'コスト cron: Supabase クエリ失敗',
          description: message,
          color: COLORS.ERROR,
        });
        return c.json({ error: message }, 500);
      }

      const aggregate = aggregateCost(rows.rows);

      // 請求額は Anthropic の cost_report が正（推定と混同させない）。
      const { start, end } = utcDayBounds(dateKey);
      const actual = await fetchActualCost(start, end);

      // 前日比・今月の累計・月末の見込み。モデル別内訳（対象日ぶん）と混ざらないよう、
      // 月ぶんの日別バケットは別呼び出しで取る。
      const trend = await fetchTrend(actual, dateKey);

      // 閾値判定は実額があれば実額で、なければ推定で行う。
      const thresholdBasisUsd =
        actual.kind === 'ok' ? actual.totalCostUsd : aggregate.estimatedCostUsd;
      const thresholdExceeded = thresholdBasisUsd >= DAILY_COST_THRESHOLD_USD;

      const divergence =
        actual.kind === 'ok'
          ? divergenceRatio(aggregate.estimatedCostUsd, fermentationActualUsd(actual.byModel))
          : null;

      // すべて縦に並べる（inline を使わない）。3 カラムは幅次第で崩れて読めない。
      const fields: DiscordField[] = [buildActualField(actual, trend)];
      if (trend) fields.push(buildTrendField(trend));
      if (actual.kind !== 'ok') {
        // 実額が取れない日だけ、推定が実額の代用として前に出る。
        fields.push({
          name: '推定コスト（発酵のみ・実額の代用）',
          value: `${usd(aggregate.estimatedCostUsd)}（トークン×単価）`,
          inline: false,
        });
      }

      fields.push(buildFermentationField(aggregate));
      // 0 件の日はユーザー別も 0 の再掲にしかならない（発酵 0 件で伝わる）。
      if (aggregate.fermentationCount > 0) {
        fields.push({
          name: `ユーザー別（推定・上位${TOP_USER_COUNT}）`,
          value: formatUserBreakdown(aggregate.byUser),
          inline: false,
        });
      }

      // 計算そのものを疑う場面でだけ式を出す。
      const basisNeeded =
        actual.kind !== 'ok' ||
        (divergence !== null && Math.abs(divergence) >= DIVERGENCE_NOTICE_RATIO);
      if (basisNeeded && aggregate.fermentationCount > 0) {
        fields.push({
          name: '推定の計算根拠',
          value: formatBasis(aggregate.inputTokens, aggregate.outputTokens),
          inline: false,
        });
      }

      const notices = buildNotices({
        aggregate,
        actual,
        divergence,
        rowsTruncated: rows.truncated,
        thresholdExceeded,
      });
      if (notices.length > 0) {
        fields.push({
          name: '要確認',
          value: notices.map((n) => `・${n}`).join('\n'),
          inline: false,
        });
      }

      const period = jstTimeRangeOfUtcDay(dateKey);
      const dayLabel = `${shortDate(dateKey)} 分`;
      await notifyDiscord({
        title: thresholdExceeded
          ? `AI コスト警告 — ${dayLabel}が閾値超過`
          : `AI コスト日次レポート — ${dayLabel}`,
        // 冒頭は「何時から何時の話か」だけを言う。UTC と JST の対応は読む人の仕事ではない。
        description: `${period} に発生したコストのレポートです。`,
        color: thresholdExceeded ? COLORS.ERROR : COLORS.INFO,
        fields,
      });

      return c.json({
        message: 'Cost alert check completed',
        /** 対象の UTC 日。JST では period のとおり「その日 9:00 〜 翌日 9:00」。 */
        date: dateKey,
        period,
        actualCost:
          actual.kind === 'ok'
            ? {
                status: 'ok',
                costUsd: round6(actual.totalCostUsd),
                truncated: actual.truncated,
                byModel: actual.byModel.map((m) => ({
                  model: m.model,
                  costUsd: round6(m.costUsd),
                  feature: featureOfModel(m.model),
                })),
              }
            : { status: actual.kind },
        previousDayCost: trend?.previousUsd == null ? null : round6(trend.previousUsd),
        monthToDateCost: trend ? round6(trend.monthToDateUsd) : null,
        projectedMonthEndCost: trend ? round6(trend.projectedMonthEndUsd) : null,
        /** 発酵のみの推定。用途別の実額は actualCost.byModel を見る。 */
        estimatedCost: round6(aggregate.estimatedCostUsd),
        fermentationCount: aggregate.fermentationCount,
        completedCount: aggregate.completedCount,
        failedCount: aggregate.failedCount,
        untrackedCount: aggregate.untrackedCount,
        inputTokens: aggregate.inputTokens,
        outputTokens: aggregate.outputTokens,
        userCount: aggregate.byUser.length,
        truncated: rows.truncated,
        thresholdExceeded,
        notices,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[cron-cost-alert] execution failed', { error: message });
      await notifyDiscord({
        title: 'コスト cron: 実行中にエラー',
        description: message,
        color: COLORS.ERROR,
      });
      return c.json({ error: 'Internal Server Error', message }, 500);
    }
  });
