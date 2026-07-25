import React, { useEffect, useRef, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import DeliveryDetailsDrawer from '../components/DeliveryDetailsDrawer';
import { fetchDeliveries, fetchRiders, updateDeliveryStatus, submitDeliveryLocation } from '../services/deliveriesService';
import { divIcon } from 'leaflet';
import { Phone, MapPin, Truck, Users2 } from 'lucide-react';

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
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => (typeof window !== 'undefined' ? window.currentUser || null : null));

  useEffect(() => {
    // persist tab
    if (typeof window !== 'undefined') window.localStorage.setItem('deliveries:lastTab', tab);
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [tab]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [del, rid] = await Promise.all([fetchDeliveries(), fetchRiders()]);
        if (!mounted) return;
        setDeliveries(Array.isArray(del) ? del : []);
        setRiders(Array.isArray(rid) ? rid : []);
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
    // setup socket once
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
    socket.on('delivery:status', onStatus);
    socket.on('delivery:location', onLocation);
    socket.on('delivery:eta:update', onEta);
    socket.on('delivery:distance:update', onEta);
    socket.on('delivery:route:update', onRoute);

    socket.on('connect_error', (err) => console.warn('Delivery socket connect error', err));

    return () => {
      try {
        socket.off('delivery:assigned', onAssigned);
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
    // try to load current user if not present
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
  }, []);

  const filtered = useMemo(() => {
    const role = currentUserRef.current ? String(currentUserRef.current.role || '').toLowerCase() : null;
    if (role === 'rider') {
      return deliveries.filter((d) => Number(d.riderId) === Number(currentUserRef.current?.id));
    }
    if (role === 'manager') {
      const branchId = Number(currentUserRef.current?.branchId || currentUserRef.current?.branch_id || 0);
      if (branchId) return deliveries.filter((d) => Number(d.branchId) === branchId);
    }
    // admin or others
    return deliveries;
  }, [deliveries, currentUser]);

  const tabItems = useMemo(() => {
    const now = new Date();
    return {
      Assigned: filtered.filter((d) => d.deliveryStatus === 'Assigned'),
      Active: filtered.filter((d) => ['Rider Accepted', 'Out For Delivery'].includes(d.deliveryStatus)),
      Tracking: filtered.filter((d) => ['Rider Accepted', 'Out For Delivery', 'Assigned'].includes(d.deliveryStatus)),
      Completed: filtered.filter((d) => d.deliveryStatus === 'Delivered' && new Date(d.updatedAt).toDateString() === now.toDateString()),
      History: filtered // full history (server-side paging recommended)
    };
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
        // open reassign modal (not implemented) - placeholder
        alert('Reassign rider - open reassign UI');
      }
    } catch (e) {
      console.error('Action failed', e);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:pl-[220px]">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="rounded-[24px] border bg-white p-4 shadow-sm dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Deliveries</h1>
              <div className="flex gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">Live</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="rounded-lg border p-6">Loading deliveries…</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="col-span-1 space-y-3">
                    {tabItems[tab].length === 0 ? (
                      <div className="rounded-lg border p-6">No deliveries found.</div>
                    ) : (
                      tabItems[tab].map((d) => (
                        <div key={d.id} className="rounded-lg border p-4 bg-white flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">Order #{d.orderId || d.id}</div>
                            <div className="text-xs text-slate-500">{d.customerName || 'Customer'}</div>
                            <div className="text-xs text-slate-400">{d.deliveryStatus}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openDetails(d)} className="rounded-md border px-3 py-1 text-sm">Open</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="col-span-2">
                    {tab === 'Tracking' ? (
                      <div className="rounded-lg border p-4 bg-white">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          <div className="col-span-1">
                            <div className="mb-3 text-sm font-semibold">Active deliveries</div>
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                              {tabItems['Tracking'].map((d) => (
                                <div key={d.id} className="rounded-lg border p-3 flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold">#{d.orderId || d.id}</div>
                                    <div className="text-xs text-slate-500">{d.customerName}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm">{d.eta || 'ETA pending'}</div>
                                    <div className="text-xs text-slate-400">{d.distance != null ? `${(d.distance/1000).toFixed(1)} km` : '—'}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="col-span-2">
                            <div className="h-[560px] rounded-lg overflow-hidden">
                              <MapContainer center={DEFAULT_CENTER} zoom={13} className="h-full w-full">
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                                {selectedDelivery && selectedDelivery.route && selectedDelivery.route.geometry && Array.isArray(selectedDelivery.route.geometry.coordinates) && (
                                  <Polyline positions={selectedDelivery.route.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: '#22d3ee', weight: 4 }} />
                                )}
                                {tabItems['Tracking'].map((d) => (
                                  d.currentLat && d.currentLng ? (
                                    <Marker key={`rider-${d.id}`} position={[Number(d.currentLat), Number(d.currentLng)]} icon={createMapIcon('R', 'bg-emerald-500')}>
                                      <Popup>
                                        <div className="text-sm">{d.riderName || 'Rider'}</div>
                                      </Popup>
                                    </Marker>
                                  ) : null
                                ))}
                              </MapContainer>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border p-4 bg-white">
                        <div className="grid gap-3">
                          {tabItems[tab].map((d) => (
                            <div key={d.id} className="rounded-lg border p-4 flex items-center justify-between">
                              <div>
                                <div className="text-sm font-semibold">Order #{d.orderId || d.id}</div>
                                <div className="text-xs text-slate-500">{d.customerName}</div>
                                <div className="text-xs text-slate-400">{d.deliveryStatus}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => openDetails(d)} className="rounded-md border px-3 py-1 text-sm">Details</button>
                                {['Active','Tracking'].includes(tab) && (
                                  <button onClick={async () => { await updateDeliveryStatus(d.id, 'start'); }} className="rounded-md bg-slate-900 px-3 py-1 text-white">Start</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <DeliveryDetailsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} delivery={selectedDelivery} currentUser={currentUser} onAction={handleAction} />
    </div>
  );
}


