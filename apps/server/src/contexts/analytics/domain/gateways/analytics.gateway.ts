export interface TrendResult {
  data: number[];
  days: string[];
  label: string;
}

export interface AnalyticsGateway {
  queryTrend(params: {
    dateFrom: string;
    events: { id: string; math: string }[];
    properties?: { key: string; value: string; operator: string }[];
    breakdown?: string;
    breakdownType?: string;
    interval?: string;
  }): Promise<TrendResult[]>;

  queryHogQL(query: string): Promise<unknown[][]>;
}
