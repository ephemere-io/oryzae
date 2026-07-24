export interface AnalyticsGateway {
  // PostHog の REST 集計（/insights/trend/）はレガシー扱いで無効化されたアカウントがあり
  // 403 "Legacy insight endpoints are not available" を返す。そのため集計は全て
  // 現行の Query API（/query/ + HogQL）に一本化する。
  queryHogQL(query: string): Promise<unknown[][]>;
}
