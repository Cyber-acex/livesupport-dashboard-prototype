import { useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';

export default function StatisticsChart({ className }){
  const ref = useRef(null);

  useEffect(()=>{
    if (!ref.current) return;

    let chart = null;
    let cancelled = false;

    async function init() {
      try {
        const apiBase = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiBase}/api/messages/monthly`);
        if (!res.ok) throw new Error('Failed to fetch monthly messages');
        const js = await res.json();
        if (cancelled) return;

        const options = {
          series: [
            { name: 'AI', data: Array.isArray(js.ai) ? js.ai : [] },
            { name: 'Staff', data: Array.isArray(js.staff) ? js.staff : [] }
          ],
          legend: { show: true, position: 'top', horizontalAlign: 'left' },
          colors: ['#465FFF','#9CB9FF'],
          chart: { type: 'area', height: 320, toolbar: { show: false } },
          stroke: { curve: 'straight', width: ['2','2'] },
          markers: { size: 0 },
          fill: { gradient: { enabled: true, opacityFrom: 0.55, opacityTo: 0 } },
          xaxis: { categories: Array.isArray(js.labels) ? js.labels : [], axisBorder:{show:false}, axisTicks:{show:false} },
          grid: { yaxis: { lines: { show: true } } },
          tooltip: { x: { format: 'dd MMM yyyy' } },
          dataLabels: { enabled: false }
        };

        chart = new ApexCharts(ref.current, options);
        await chart.render();
      } catch (e) {
        console.error('StatisticsChart init error', e);
      }
    }

    init();

    return ()=>{ cancelled = true; try{ chart && chart.destroy(); }catch(e){} };
  }, []);

  return (
    <div className={className}>
      <div ref={ref} id="chartThree"></div>
    </div>
  );
}
