import { useEffect, useMemo, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { calculateMonthlyTargetPercent } from '../utils/monthlyTarget';

function formatCurrency(value) {
  const numericValue = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: numericValue >= 1000 ? 0 : 2
  }).format(numericValue);
}

function MonthlyTargetGauge({ targetAmount = 20000, revenueAmount = 0, todayAmount = 0, yesterdayAmount = 0, progressPercent = null }) {
  const chartRef = useRef(null);
  const safeTarget = Number(targetAmount) || 0;
  const safeRevenue = Number(revenueAmount) || 0;
  const safeToday = Number(todayAmount) || 0;
  const safeYesterday = Number(yesterdayAmount) || 0;

  const computedPercent = useMemo(() => calculateMonthlyTargetPercent({
    targetAmount: safeTarget,
    revenueAmount: safeRevenue,
    progressPercent
  }), [progressPercent, safeTarget, safeRevenue]);

  const insightMessage = useMemo(() => {
    if (!safeYesterday) {
      return 'You just started tracking today’s progress. Keep the momentum going!';
    }

    const difference = safeToday - safeYesterday;
    if (difference > 0) {
      const percent = Math.round((difference / safeYesterday) * 100);
      return `Great job! You earned ${formatCurrency(difference)} more than yesterday${percent ? ` (${percent}% higher)` : ''}. Keep it up!`;
    }
    if (difference < 0) {
      const percent = Math.round((Math.abs(difference) / safeYesterday) * 100);
      return `Oops, you earned ${formatCurrency(Math.abs(difference))} less than yesterday${percent ? ` (${percent}% lower)` : ''}. Try a little harder today.`;
    }
    return 'You earned the same as yesterday. Steady progress is still progress!';
  }, [safeToday, safeYesterday]);

  useEffect(() => {
    if (!chartRef.current) return;

    let chart = null;
    let cancelled = false;

    const options = {
      series: [Number(computedPercent.toFixed(2))],
      colors: ['#465FFF'],
      chart: {
        type: 'radialBar',
        height: 360,
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
              formatter: (val) => `${Number(val).toFixed(1)}%`,
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
  }, [computedPercent]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Monthly Target</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Target you’ve set for each month</p>
        </div>
        <span className="rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-600 dark:bg-success-500/15 dark:text-success-400">
          {computedPercent.toFixed(0)}%
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="w-full">
          <div ref={chartRef} className="mx-auto h-[320px] w-full max-w-[280px]" />
        </div>

        <div className="mx-auto max-w-[460px] text-center text-sm text-gray-600 dark:text-gray-300">
          {insightMessage}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Target</div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(safeTarget)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Revenue</div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(safeRevenue)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Today</div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(safeToday)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlyTargetGauge;
