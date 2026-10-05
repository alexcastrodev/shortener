import { Alert, Card, SimpleGrid } from '@mantine/core';
import { BarChart, DonutChart } from '@mantine/charts';
import { useEventStatistics } from 'packages/core/actions/get-event-statistics/get-event-statistics.hook';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { injectRandomColor } from '~/utils/get-random-color';

export function Statistics() {
  const { t } = useTranslation('links');
  const params = useParams();
  const { data } = useEventStatistics(params.id || '');

  if (!data) {
    return (
      <Alert title={t('no_data_title')} color="brand" variant="light" my="lg">
        {t('no_data_message')}
      </Alert>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} mt="lg" spacing="md">
      <Card h={420} p="lg">
        <DonutChart
          chartLabel={t('device_statistics')}
          withLabelsLine
          labelsType="value"
          withLabels
          data={injectRandomColor(data.device_statistics || [])}
          w="100%"
        />

        <div className="mt-4 space-y-2">
          {(data.device_statistics || []).map(item => (
            <div
              key={item.name}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{item.name}:</span>
              <span className="font-semibold text-foreground">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card h={420} p="lg">
        <DonutChart
          chartLabel={t('browser_statistics')}
          withLabelsLine
          labelsType="value"
          withLabels
          data={injectRandomColor(data.browser_statistics || [])}
          w="100%"
        />

        <div className="mt-4 space-y-2">
          {(data.browser_statistics || []).map(item => (
            <div
              key={item.name}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{item.name}:</span>
              <span className="font-semibold text-foreground">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card h={420} p="lg">
        <BarChart
          h="100%"
          data={data.region_statistics || []}
          dataKey="region"
          series={[{ name: 'count', label: t('regions'), color: 'brand.6' }]}
          withTooltip
          withLegend
        />

        <div className="mt-4 space-y-2">
          {(data.region_statistics || []).map(item => (
            <div
              key={item.region}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{item.region}:</span>
              <span className="font-semibold text-foreground">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card h={420} p="lg">
        <BarChart
          h="100%"
          data={data.country_statistics || []}
          dataKey="country"
          series={[{ name: 'count', label: t('countries'), color: 'indigo.6' }]}
          withTooltip
          withLegend
        />

        <div className="mt-4 space-y-2">
          {(data.country_statistics || []).map(item => (
            <div
              key={item.country}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{item.country}:</span>
              <span className="font-semibold text-foreground">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </SimpleGrid>
  );
}
