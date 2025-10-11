import { Alert, Card, SimpleGrid } from '@mantine/core';
import { BarChart, DonutChart } from '@mantine/charts';
import { useEventStatistics } from 'packages/core/actions/get-event-statistics/get-event-statistics.hook';
import { useParams } from 'react-router';
import { injectRandomColor } from '~/utils/get-random-color';

export function Statistics() {
  const params = useParams();
  const { data } = useEventStatistics(params.id || '');

  if (!data) {
    return (
      <Alert title="No Data Yet" color="blue" variant="light" my="lg">
        Your link is ready to go! Statistics will appear here once people start
        accessing it.
      </Alert>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} mt="lg">
      <Card h={400}>
        <DonutChart
          chartLabel="Device Statistics"
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
              <span className="text-gray-700 dark:text-gray-300">
                {item.name}:
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card h={400}>
        <DonutChart
          chartLabel="Browser Statistics"
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
              <span className="text-gray-700 dark:text-gray-300">
                {item.name}:
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card h={400}>
        <BarChart
          h="100%"
          data={data.region_statistics || []}
          dataKey="region"
          series={[{ name: 'count', label: 'Regions', color: 'teal.6' }]}
          withTooltip
          withLegend
        />

        <div className="mt-4 space-y-2">
          {(data.region_statistics || []).map(item => (
            <div
              key={item.region}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {item.region}:
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card h={400}>
        <BarChart
          h="100%"
          data={data.country_statistics || []}
          dataKey="country"
          series={[{ name: 'count', label: 'Countries', color: 'violet.6' }]}
          withTooltip
          withLegend
        />

        <div className="mt-4 space-y-2">
          {(data.country_statistics || []).map(item => (
            <div
              key={item.country}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {item.country}:
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </SimpleGrid>
  );
}
