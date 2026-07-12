import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MetricCard from '../components/MetricCard';
import TableCard from '../components/TableCard';
import StatusBadge from '../components/StatusBadge';
import StatisticsChart from '../components/StatisticsChart';
import MonthlySalesChart from '../components/MonthlySalesChart';
import MonthlyTargetGauge from '../components/MonthlyTargetGauge';
import { fetchDashboardStats, fetchRecentOrders, fetchRecentMessages } from '../services/dashboardService';
import { getSettings } from '../services/settingsService';

// Metric Icons
const customerIcon = (
  <svg className="fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
    <path fillRule="evenodd" clipRule="evenodd" d="M8.80443 5.60156C7.59109 5.60156 6.60749 6.58517 6.60749 7.79851C6.60749 9.01185 7.59109 9.99545 8.80443 9.99545C10.0178 9.99545 11.0014 9.01185 11.0014 7.79851C11.0014 6.58517 10.0178 5.60156 8.80443 5.60156ZM5.10749 7.79851C5.10749 5.75674 6.76267 4.10156 8.80443 4.10156C10.8462 4.10156 12.5014 5.75674 12.5014 7.79851C12.5014 9.84027 10.8462 11.4955 8.80443 11.4955C6.76267 11.4955 5.10749 9.84027 5.10749 7.79851Z" />
  </svg>
);

const orderIcon = (
  <svg className="fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
    <path fillRule="evenodd" clipRule="evenodd" d="M11.665 3.75621C11.8762 3.65064 12.1247 3.65064 12.3358 3.75621L18.7807 6.97856L12.3358 10.2009C12.1247 10.3065 11.8762 10.3065 11.665 10.2009L5.22014 6.97856L11.665 3.75621ZM4.29297 8.19203V16.0946C4.29297 16.3787 4.45347 16.6384 4.70757 16.7654L11.25 20.0366V11.6513C11.1631 11.6205 11.0777 11.5843 10.9942 11.5426L4.29297 8.19203Z" />
  </svg>
);

function DashboardPage() {
  const [customers, setCustomers] = useState('—');
  const [orders, setOrders] = useState('—');
  const [customersChange, setCustomersChange] = useState(null);
  const [ordersChange, setOrdersChange] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetAmount, setTargetAmount] = useState(20000);
  const [revenueAmount, setRevenueAmount] = useState(0);
  const [todayAmount, setTodayAmount] = useState(0);
  const [yesterdayAmount, setYesterdayAmount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const data = await fetchDashboardStats();
        if (!mounted) return;

        const settings = getSettings();
        const dashboardTarget = Number(settings.monthlyTargetAmount || 0) || 20000;
        const revenue = Number(data.revenueAmount || data.revenue || data.monthlyRevenue || 0) || 0;
        const today = Number(data.todayAmount || data.todayRevenue || 0) || 0;
        const yesterday = Number(data.yesterdayAmount || data.yesterdayRevenue || 0) || 0;

        setCustomers(data.customers.toLocaleString());
        setOrders(data.orders.toLocaleString());
        setTargetAmount(dashboardTarget);
        setRevenueAmount(revenue);
        setTodayAmount(today);
        setYesterdayAmount(yesterday);

        const customersDelta = typeof data.previousSnapshot.customers_change !== 'undefined' && data.previousSnapshot.customers_change !== null
          ? Number(data.previousSnapshot.customers_change)
          : null;
        const ordersDelta = typeof data.previousSnapshot.orders_change !== 'undefined' && data.previousSnapshot.orders_change !== null
          ? Number(data.previousSnapshot.orders_change)
          : null;

        setCustomersChange(customersDelta);
        setOrdersChange(ordersDelta);
      } catch (error) {
        console.error('Failed to load dashboard stats', error);
      }

      try {
        const orders = await fetchRecentOrders(5);
        if (mounted) {
          setRecentOrders(Array.isArray(orders) ? orders : []);
        }
      } catch (error) {
        console.error('Failed to load recent orders', error);
      }

      try {
        const messages = await fetchRecentMessages(5);
        if (mounted) {
          setRecentMessages(Array.isArray(messages) ? messages : []);
        }
      } catch (error) {
        console.error('Failed to load recent messages', error);
      }

      setLoading(false);
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  function getStatusType(status) {
    if (!status) return 'default';
    const lower = status.toLowerCase();
    if (lower.includes('pending') || lower.includes('processing')) return 'pending';
    if (lower.includes('completed') || lower.includes('delivered')) return 'success';
    if (lower.includes('failed') || lower.includes('cancelled')) return 'error';
    if (lower.includes('pending')) return 'warning';
    return 'default';
  }

  const ordersRows = useMemo(() => recentOrders.map((order) => [
    <div className="flex items-center gap-3" key={`${order.id}-product`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/15 text-sm font-semibold text-brand-600 dark:text-brand-400">
        {String(order.product || 'P').slice(0, 1).toUpperCase()}
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">{order.product || 'Product'}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{order.variant || 'Standard'}</div>
      </div>
    </div>,
    order.customer || 'Customer',
    order.amount ? `$${Number(order.amount).toFixed(2)}` : '$0.00',
    <StatusBadge key={`${order.id}-status`} status={order.status || 'Pending'} type={getStatusType(order.status)} />
  ]), [recentOrders]);

  const messageRows = useMemo(() => recentMessages.map((message) => [
    <div className="flex items-center gap-3" key={`${message.id}-message`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50 dark:bg-success-500/15 text-sm font-semibold text-success-600 dark:text-success-400">
        {String(message.customer_name || message.phone || 'C').slice(0, 1).toUpperCase()}
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">{message.customer_name || message.phone || 'Customer'}</div>
        <div className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{message.message || 'New message received'}</div>
      </div>
    </div>,
    message.created_at ? new Date(message.created_at).toLocaleString() : '—'
  ]), [recentMessages]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 mx-auto w-full max-w-7xl md:p-6">
          {/* Page Header */}
          <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">Welcome back! Here's a quick view of your support system.</p>
            </div>

          {/* Metric Cards Grid */}
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start md:gap-6">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <MetricCard
                    icon={customerIcon}
                    label="Customers"
                    value={customers}
                    change={customersChange}
                    changeType={customersChange && customersChange < 0 ? 'negative' : 'positive'}
                  />
                  <MetricCard
                    icon={orderIcon}
                    label="Orders"
                    value={orders}
                    change={ordersChange}
                    changeType={ordersChange && ordersChange < 0 ? 'negative' : 'positive'}
                  />
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Monthly Sales</h3>
                      <p className="text-sm text-gray-500">A quick snapshot of monthly revenue</p>
                    </div>
                  </div>
                  <MonthlySalesChart />
                </div>
              </div>
              <div className="lg:row-span-2">
                <MonthlyTargetGauge
                  targetAmount={targetAmount}
                  revenueAmount={revenueAmount}
                  todayAmount={todayAmount}
                  yesterdayAmount={yesterdayAmount}
                />
              </div>
            </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 xl:col-span-12">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Monthly Outward Messages</h3>
                      <p className="text-sm text-gray-500">Target you’ve set for each month</p>
                    </div>
                  </div>
                  <StatisticsChart />
                </div>
              </div>
              <div className="col-span-12 xl:col-span-7">
                <TableCard
                  title="Recent Orders"
                  linkLabel="See all"
                  linkHref="/orders"
                  headers={['Product', 'Customer', 'Amount', 'Status']}
                  rows={ordersRows}
                  emptyText={loading ? 'Loading recent orders…' : 'No recent orders'}
                />
              </div>
              <div className="col-span-12 xl:col-span-5">
                <TableCard
                  title="Recent Messages"
                  linkLabel="Open Inbox"
                  linkHref="/inbox"
                  headers={['Customer', 'Received']}
                  rows={messageRows}
                  emptyText={loading ? 'Loading messages…' : 'No recent messages'}
                />
              </div>
            </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardPage;
