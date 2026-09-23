import type { PageLinkKind } from '../../types/Page';

export type PageStatisticsPeriod = 7 | 30 | 90;

export interface PageStatisticsBucket {
  name: string;
  clicks: number;
}

export interface PageStatisticsLink {
  id: number;
  kind: PageLinkKind;
  label: string;
  icon: string | null;
  active: boolean;
  // In the selected period / since the link was added.
  clicks: number;
  total_clicks: number;
}

export interface PageStatistics {
  period_days: PageStatisticsPeriod;
  total_clicks: number;
  period_clicks: number;
  // One entry per UTC day of the period, oldest first.
  timeline: { date: string; clicks: number }[];
  links: PageStatisticsLink[];
  sources: PageStatisticsBucket[];
  devices: PageStatisticsBucket[];
  browsers: PageStatisticsBucket[];
  countries: PageStatisticsBucket[];
}
