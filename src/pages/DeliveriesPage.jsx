import React, { useEffect, useRef, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import DeliveryDetailsDrawer from '../components/DeliveryDetailsDrawer';
import { fetchDeliveries, fetchRiders, updateDeliveryStatus } from '../services/deliveriesService';
import { fetchOrders } from '../services/ordersService';
import { buildDeliveryFromOrder, normalizeOrderStatusForDelivery } from '../../utils/deliveryOrderSync.js';
import { divIcon } from 'leaflet';
import { ArrowRight, Clock3, Compass, MapPin, Sparkles, Truck } from 'lucide-react';

const TABS = ['Assigned', 'Active', 'Tracking', 'Completed', 'History'];
const DEFAULT_CENTER = [6.5244, 3.3792];

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default DeliveriesPage;

function createMapIcon(label, tone) {
  return divIcon({
    className: 'custom-map-icon',
    html: `<div class="custom-map-pin ${tone}">${label}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });
}

function normalizeOrderToDelivery(order) {
  return {
    ...buildDeliveryFromOrder(order),
    source: 'order',
    deliveryStatus: normalizeOrderStatusForDelivery(order?.status),
  };
}

function mergeDeliverySources(deliveries, orders) {
  const normalizedDeliveries = (Array.isArray(deliveries) ? deliveries : []).map((item) => ({ ...item, source: item?.source || 'delivery' }));
  const normalizedOrders = (Array.isArray(orders) ? orders : []).map(normalizeOrderToDelivery);
  const merged = [];
  const matchedOrderIds = new Set();

  normalizedDeliveries.forEach((delivery) => {
    const orderId = delivery?.orderId ?? delivery?.order_number ?? null;
    const matchingOrder = normalizedOrders.find((candidate) => Number(candidate.orderId) === Number(orderId) || Number(candidate.id) === Number(orderId));

    if (matchingOrder) {
      matchedOrderIds.add(String(orderId || matchingOrder.orderId || matchingOrder.id));
      merged.push({
        ...delivery,
        ...matchingOrder,
        id: delivery.id,
        orderId: delivery.orderId || matchingOrder.orderId || matchingOrder.id,
        deliveryStatus: normalizeOrderStatusForDelivery(matchingOrder.deliveryStatus || delivery.deliveryStatus),
        source: 'delivery',
        customerName: delivery.customerName || matchingOrder.customerName || 'Customer',
        product: delivery.product || matchingOrder.product,
        updatedAt: matchingOrder.updatedAt || delivery.updatedAt,
      });
      return;
    }

    merged.push(delivery);
  });

  normalizedOrders.forEach((order) => {
    const key = String(order.orderId || order.id || '');
    if (key && matchedOrderIds.has(key)) return;
    merged.push(order);
  });

  return merged;
}

function getStatusStyles(status) {
  const value = String(status || 'Pending');
  const styles = {
    Assigned: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
    'Rider Accepted': 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200',
    'Out For Delivery': 'border-amber-400/40 bg-amber-500/15 text-amber-200',
    Delivered: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
    Cancelled: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
  };
  return styles[value] || 'border-slate-400/30 bg-slate-500/10 text-slate-300';
}

function formatDistance(distance) {
  if (distance == null || Number.isNaN(Number(distance))) return '—';
  return `${(Number(distance) / 1000).toFixed(1)} km`;
}

function formatEta(value) {
  if (!value) return 'Pending';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return value;
  }
}

function DeliveriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useQuery();
  const socketRef = useRef(null);
  const [tab, setTab] = useState(() => {
    const q = query.get('tab');
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('deliveries:lastTab') : null;
    return q || stored || 'Assigned';
  });

  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => (typeof window !== 'undefined' ? window.currentUser || null : null));
  const [highlightedDeliveries, setHighlightedDeliveries] = useState(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('deliveries:lastTab', tab);
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [tab, location.pathname, location.search, navigate]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [del, rid, ord] = await Promise.all([fetchDeliveries(), fetchRiders(), fetchOrders()]);
        if (!mounted) return;
        setDeliveries(Array.isArray(del) ? del : []);
        setRiders(Array.isArray(rid) ? rid : []);
        setOrders(Array.isArray(ord) ? ord : []);
      } catch (e) {
        console.error('Failed to load deliveries', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (socketRef.current) return;
    const socket = io();
    socketRef.current = socket;
    const onAssigned = (payload) => {
      if (!payload || !payload.id) return;
      setDeliveries((prev) => {
        const exists = prev.some((d) => Number(d.id) === Number(payload.id));
        if (exists) return prev.map((d) => (Number(d.id) === Number(payload.id) ? { ...d, ...payload } : d));
        return [payload, ...prev];
      });
    };
    const onOrderCreated = (payload) => {
      if (!payload || !payload.id) return;
      setOrders((prev) => {
        const exists = prev.some((order) => Number(order.id) === Number(payload.id));
        if (exists) return prev.map((order) => (Number(order.id) === Number(payload.id) ? { ...order, ...payload, status: payload.status || order.status } : order));
        return [{ id: payload.id, customerName: payload.customerName || 'Customer', product: payload.product || '', amount: Number(payload.amount || 0), status: payload.status || 'pending', date: payload.date || new Date().toISOString() }, ...prev];
      });
    };
    const onOrderUpdated = (payload) => {
      if (!payload) return;
      const orderId = payload.orderId || payload.id;
      if (!orderId) return;
      setOrders((prev) => prev.map((order) => (Number(order.id) === Number(orderId) ? { ...order, ...payload, id: order.id, status: payload.status || order.status } : order)));
      setDeliveries((prev) => prev.map((delivery) => (Number(delivery.orderId) === Number(orderId) ? { ...delivery, deliveryStatus: normalizeOrderStatusForDelivery(payload.status || delivery.deliveryStatus) } : delivery)));
      setHighlightedDeliveries((prev) => {
        const next = new Set(prev);
        next.add(String(orderId));
        setTimeout(() => {
          setHighlightedDeliveries((current) => {
            const nextSet = new Set(current);
            nextSet.delete(String(orderId));
            return nextSet;
          });
        }, 4000);
        return next;
      });
      if (selectedDelivery && Number(selectedDelivery.orderId) === Number(orderId)) {
        setSelectedDelivery((current) => current ? { ...current, deliveryStatus: normalizeOrderStatusForDelivery(payload.status || current.deliveryStatus) } : current);
      }
    };
    const onStatus = (payload) => {
      if (!payload || !payload.deliveryId) return;
      setDeliveries((prev) => prev.map((d) => (Number(d.id) === Number(payload.deliveryId) ? { ...d, deliveryStatus: payload.status } : d)));
      if (selectedDelivery && Number(selectedDelivery.id) === Number(payload.deliveryId)) {
        setSelectedDelivery((s) => ({ ...s, deliveryStatus: payload.status }));
      }
    };
    const onLocation = (payload) => {
      if (!payload || !payload.deliveryId) return;
      setDeliveries((prev) => prev.map((d) => (Number(d.id) === Number(payload.deliveryId) ? { ...d, currentLat: payload.latitude, currentLng: payload.longitude } : d)));
      if (selectedDelivery && Number(selectedDelivery.id) === Number(payload.deliveryId)) {
        setSelectedDelivery((s) => ({ ...s, currentLat: payload.latitude, currentLng: payload.longitude }));
      }
    };
    const onEta = (payload) => {
      if (!payload || !payload.deliveryId) return;
      setDeliveries((prev) => prev.map((d) => (Number(d.id) === Number(payload.deliveryId) ? { ...d, eta: payload.eta, distance: payload.distance } : d)));
      if (selectedDelivery && Number(selectedDelivery.id) === Number(payload.deliveryId)) {
        setSelectedDelivery((s) => ({ ...s, eta: payload.eta, distance: payload.distance }));
      }
    };
    const onRoute = (payload) => {
      if (!payload || !payload.deliveryId) return;
      setDeliveries((prev) => prev.map((d) => (Number(d.id) === Number(payload.deliveryId) ? { ...d, route: payload.route } : d)));
      if (selectedDelivery && Number(selectedDelivery.id) === Number(payload.deliveryId)) {
        setSelectedDelivery((s) => ({ ...s, route: payload.route }));
      }
    };

    socket.on('delivery:assigned', onAssigned);
    socket.on('order-created', onOrderCreated);
    socket.on('order-updated', onOrderUpdated);
    socket.on('delivery:status', onStatus);
    socket.on('delivery:location', onLocation);
    socket.on('delivery:eta:update', onEta);
    socket.on('delivery:distance:update', onEta);
    socket.on('delivery:route:update', onRoute);

    socket.on('connect_error', (err) => console.warn('Delivery socket connect error', err));

    return () => {
      try {
        socket.off('delivery:assigned', onAssigned);
        socket.off('order-created', onOrderCreated);
        socket.off('order-updated', onOrderUpdated);
        socket.off('delivery:status', onStatus);
        socket.off('delivery:location', onLocation);
        socket.off('delivery:eta:update', onEta);
        socket.off('delivery:distance:update', onEta);
        socket.off('delivery:route:update', onRoute);
        socket.disconnect();
      } catch (e) {}
      socketRef.current = null;
    };
  }, [selectedDelivery]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      (async () => {
        try {
          const res = await fetch('/api/user', { credentials: 'same-origin' });
          if (res.ok) {
            const data = await res.json();
            setCurrentUser(data);
            window.currentUser = data;
          }
        } catch (e) {}
      })();
    }
  }, [currentUser]);

  const combinedDeliveries = useMemo(() => mergeDeliverySources(deliveries, orders), [deliveries, orders]);

  const filtered = useMemo(() => {
    const role = currentUserRef.current ? String(currentUserRef.current.role || '').toLowerCase() : null;
    if (role === 'rider') {
      return combinedDeliveries.filter((d) => Number(d.riderId) === Number(currentUserRef.current?.id));
    }
    if (role === 'manager') {
      const branchId = Number(currentUserRef.current?.branchId || currentUserRef.current?.branch_id || 0);
      if (branchId) return combinedDeliveries.filter((d) => Number(d.branchId) === branchId);
    }
    return combinedDeliveries;
  }, [combinedDeliveries, currentUser]);

  const tabItems = useMemo(() => {
    const now = new Date();
    return {
      Assigned: filtered.filter((d) => d.deliveryStatus === 'Assigned'),
      Active: filtered.filter((d) => ['Rider Accepted', 'Out For Delivery'].includes(d.deliveryStatus)),
      Tracking: filtered.filter((d) => ['Rider Accepted', 'Out For Delivery', 'Assigned'].includes(d.deliveryStatus)),
      Completed: filtered.filter((d) => d.deliveryStatus === 'Delivered' && new Date(d.updatedAt).toDateString() === now.toDateString()),
      History: filtered,
    };
  }, [filtered]);

  const summaryStats = useMemo(() => {
    const active = filtered.filter((d) => ['Assigned', 'Rider Accepted', 'Out For Delivery'].includes(d.deliveryStatus)).length;
    const inTransit = filtered.filter((d) => ['Rider Accepted', 'Out For Delivery'].includes(d.deliveryStatus)).length;
    const completed = filtered.filter((d) => d.deliveryStatus === 'Delivered').length;
    const tracking = filtered.filter((d) => ['Rider Accepted', 'Out For Delivery', 'Assigned'].includes(d.deliveryStatus)).length;
    return [
      { label: 'Active', value: active, hint: 'On the move now', accent: 'from-cyan-500 to-sky-500' },
      { label: 'In transit', value: inTransit, hint: 'Live handoffs', accent: 'from-fuchsia-500 to-violet-500' },
      { label: 'Tracking', value: tracking, hint: 'Map visibility', accent: 'from-amber-500 to-orange-500' },
      { label: 'Completed', value: completed, hint: 'Delivered today', accent: 'from-emerald-500 to-lime-500' },
    ];
  }, [filtered]);

  const openDetails = (delivery) => {
    setSelectedDelivery(delivery);
    setDrawerOpen(true);
  };

  const handleAction = async (action) => {
    if (!selectedDelivery) return;
    try {
      if (action === 'mark_delivered') {
        await updateDeliveryStatus(selectedDelivery.id, 'complete');
      }
      if (action === 'reassign') {
        alert('Reassign rider - open reassign UI');
      }
    } catch (e) {
      console.error('Action failed', e);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(217,70,239,0.18),_transparent_28%),linear-gradient(135deg,_#f8fbff_0%,_#eef5ff_45%,_#fff7ed_100%)] text-slate-900 dark:bg-slate-950 dark:text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-5">
            <header className="overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700">
                    <Sparkles className="h-4 w-4" />
                    Live delivery command center
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Premium delivery operations, tuned for bright momentum.</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">Monitor riders, update routes, and keep customers informed with a vibrant control center that feels built for modern SaaS teams.</p>
                  </div>
                </div>
                <div className="rounded-[24px] bg-gradient-to-br from-cyan-500 via-sky-500 to-fuchsia-500 p-[1px] shadow-lg shadow-cyan-500/20">
                  <div className="rounded-[23px] bg-slate-950 px-4 py-4 text-white">
                    <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Live pulse</div>
                    <div className="mt-1 text-xl font-semibold">{filtered.length} deliveries</div>
                    <div className="mt-1 text-sm text-slate-300">Updated in real time</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryStats.map((card) => (
                  <div key={card.label} className={`rounded-[22px] border border-white/60 bg-gradient-to-br ${card.accent} p-[1px]`}>
                    <div className="rounded-[21px] bg-white/95 p-4">
                      <div className="text-sm font-medium text-slate-500">{card.label}</div>
                      <div className="mt-2 text-3xl font-semibold text-slate-950">{card.value}</div>
                      <div className="mt-1 text-sm text-slate-500">{card.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </header>

            <section className="rounded-[32px] border border-slate-200/70 bg-slate-950/95 p-4 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Dispatch board</h2>
                  <p className="mt-1 text-sm text-slate-400">Bright priorities from assignment to handoff.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {TABS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                {loading ? (
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-slate-300">Loading deliveries…</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_1.4fr]">
                    <div className="space-y-3">
                      {tabItems[tab].length === 0 ? (
                        <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-slate-300">No deliveries found for this view.</div>
                      ) : (
                        tabItems[tab].map((d, index) => (
                          <div key={d.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-cyan-400/40">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-300">Route {index + 1}</div>
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusStyles(d.deliveryStatus)}`}>
                                    {d.deliveryStatus || 'Pending'}
                                  </span>
                                </div>
                                <h3 className="mt-3 text-base font-semibold text-white">Order #{d.orderId || d.id}</h3>
                                <p className="mt-1 text-sm text-slate-300">{d.customerName || 'Customer'}</p>
                                <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                                  <MapPin className="h-4 w-4 text-cyan-300" />
                                  <span className="line-clamp-1">{d.deliveryAddress || 'Address pending'}</span>
                                </div>
                              </div>
                              <div className="rounded-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 px-3 py-3 text-right">
                                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">ETA</div>
                                <div className="mt-1 text-sm font-semibold text-white">{formatEta(d.eta)}</div>
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-sm text-slate-400">
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-fuchsia-300" />
                                <span>{d.riderName || 'Unassigned'}</span>
                                {highlightedDeliveries.has(String(d.orderId || d.id)) && (
                                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 ring-1 ring-emerald-400/25">
                                    Updated
                                  </span>
                                )}
                              </div>
                              <button onClick={() => openDetails(d)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20">
                                View
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-3">
                      {tab === 'Tracking' ? (
                        <div className="space-y-3">
                          <div className="rounded-[20px] border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 p-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-cyan-200">
                              <Compass className="h-4 w-4" />
                              Active route intelligence
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                              <span>{tabItems['Tracking'].length} active routes</span>
                              <span>{riders.length} riders online</span>
                            </div>
                          </div>
                          <div className="h-[560px] overflow-hidden rounded-[20px] border border-white/10">
                            <MapContainer center={DEFAULT_CENTER} zoom={13} className="h-full w-full">
                              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                              {selectedDelivery && selectedDelivery.route && selectedDelivery.route.geometry && Array.isArray(selectedDelivery.route.geometry.coordinates) && (
                                <Polyline positions={selectedDelivery.route.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: '#22d3ee', weight: 4 }} />
                              )}
                              {tabItems['Tracking'].map((d) => (
                                d.currentLat && d.currentLng ? (
                                  <Marker key={`rider-${d.id}`} position={[Number(d.currentLat), Number(d.currentLng)]} icon={createMapIcon('R', 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white')}>
                                    <Popup>
                                      <div className="text-sm font-medium">{d.riderName || 'Rider'}</div>
                                      <div className="text-xs text-slate-500">{d.deliveryStatus}</div>
                                    </Popup>
                                  </Marker>
                                ) : null
                              ))}
                            </MapContainer>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {tabItems[tab].map((d) => (
                            <div key={d.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">Order #{d.orderId || d.id}</div>
                                  <div className="mt-1 text-sm text-slate-400">{d.customerName || 'Customer'}</div>
                                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {d.deliveryStatus || 'Pending'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => openDetails(d)} className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-white">Details</button>
                                  {['Active', 'Tracking'].includes(tab) && d.source !== 'order' && (
                                    <button onClick={async () => { await updateDeliveryStatus(d.id, 'start'); }} className="rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-1.5 text-sm font-semibold text-white">Start</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      <DeliveryDetailsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} delivery={selectedDelivery} currentUser={currentUser} onAction={handleAction} />
    </div>
  );
}


