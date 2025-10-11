export interface BrowserStatistic {
  name: string;
  value: number;
  color: string;
}

export interface CountryStatistic {
  country: string;
  count: number;
}

export interface DeviceStatistic {
  name: string;
  value: number;
  color: string;
}

export interface RegionStatistic {
  region: string;
  count: number;
}

export interface EventStatistics {
  browser_statistics: BrowserStatistic[];
  country_statistics: CountryStatistic[];
  device_statistics: DeviceStatistic[];
  region_statistics: RegionStatistic[];
}

export interface GetEventStatisticsResponse {
  browser_statistics: BrowserStatistic[];
  country_statistics: CountryStatistic[];
  device_statistics: DeviceStatistic[];
  region_statistics: RegionStatistic[];
}
