import { useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlySalesChart({ className, apiPath = '/api/tickets-monthly', seriesName = 'Tickets Created', tooltipFormatter }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    let chart = null;
    let cancelled = false;

    async function init() {
      try {
        const apiBase = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiBase}${apiPath}`);
        if (!res.ok) throw new Error(`Failed to fetch chart data from ${apiPath}`);
        const json = await res.json();
        if (cancelled) return;

        // Log fetched payload for debugging in-browser
        try { console.debug('MonthlySalesChart fetched', json); } catch (e) {}

        const labels = Array.isArray(json.labels) && json.labels.length ? json.labels : MONTH_LABELS;
        const data = Array.isArray(json.counts)
          ? json.counts
          : Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.totals)
              ? json.totals
              : Array.isArray(json.values)
                ? json.values
                : [];

        const options = {
          series: [
            {
              name: seriesName,
              data: data.length ? data : Array(12).fill(0)
            }
          ],
          colors: ['#465FFF'],
          chart: {
            type: 'bar',
            height: 280,
            toolbar: { show: false }
          },
          plotOptions: {
            bar: {
              horizontal: false,
              columnWidth: '42%',
              borderRadius: 8,
              borderRadiusApplication: 'end'
            }
          },
          dataLabels: { enabled: false },
          stroke: {
            show: true,
            width: 2,
            colors: ['transparent']
          },
          xaxis: {
            categories: labels.length ? labels : MONTH_LABELS,
            axisBorder: { show: false },
            axisTicks: { show: false }
          },
          yaxis: {
            labels: {
              formatter: (value) => `${Math.round(value)}`
            }
          },
          grid: {
            yaxis: { lines: { show: true } }
          },
          tooltip: {
            y: {
              formatter: tooltipFormatter || ((value) => `${value}`)
            }
          }
        };

        if (!ApexCharts) {
          console.error('MonthlySalesChart: ApexCharts library is not available');
          return;
        }
        chart = new ApexCharts(ref.current, options);
        await chart.render();
      } catch (error) {
        if (!cancelled) console.error('MonthlySalesChart init error', error);
      }
    }

    init();

    return () => {
      cancelled = true;
      try {
        chart && chart.destroy();
      } catch (error) {
        console.error('MonthlySalesChart destroy error', error);
      }
    };
  }, [apiPath, seriesName, tooltipFormatter]);

  return (
    <div className={className}>
      <div ref={ref} />
    </div>
  );
}
