import { useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';

function MonthlyTargetGauge() {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    let chart = null;
    let cancelled = false;

    const options = {
      series: [75.55],
      colors: ['#465FFF'],
      chart: {
        type: 'radialBar',
        height: 240,
        sparkline: { enabled: true },
        toolbar: { show: false },
      },
      plotOptions: {
        radialBar: {
          startAngle: -90,
          endAngle: 90,
          hollow: { size: '78%' },
          track: {
            background: '#E4E7EC',
            strokeWidth: '100%',
            margin: 5,
          },
          dataLabels: {
            name: { show: false },
            value: {
              fontSize: '28px',
              fontWeight: '600',
              offsetY: 58,
              color: '#111827',
              formatter: (val) => `${val}%`,
            },
          },
        },
      },
      fill: {
        type: 'solid',
        colors: ['#465FFF'],
      },
      stroke: { lineCap: 'round' },
      labels: ['Progress'],
    };

    const renderChart = () => {
      if (!chartRef.current || cancelled) return;
      chart = new ApexCharts(chartRef.current, options);
      chart.render();
    };

    renderChart();

    return () => {
      cancelled = true;
      try {
        chart && chart.destroy();
      } catch (error) {
        console.error('MonthlyTargetGauge cleanup error', error);
      }
    };
  }, []);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Monthly Target</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Target you’ve set for each month</p>
        </div>
        <span className="rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-600 dark:bg-success-500/15 dark:text-success-400">
          +10%
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-[220px]">
          <div ref={chartRef} />
        </div>

        <div className="flex-1 space-y-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Target</div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">$20K</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Revenue</div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">$20K</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Today</div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">$20K</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlyTargetGauge;
