import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import {
  fetchActiveDeliveries,
  fetchOrderStatuses,
  normalizeDeliveryStatus,
  capitalizeLabel,
  DEFAULT_CENTER,
  getDeliveryStatusColor,
  generateTestDelivery
} from '../services/trackingService';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

function TrackingPage() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());
  const polylinesRef = useRef(new Map());

  const [deliveries, setDeliveries] = useState([]);
  const [orderStatuses, setOrderStatuses] = useState(new Map());
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [notification, setNotification] = useState('');

  const summary = useMemo(() => {
    const statusCounts = deliveries.reduce((acc, delivery) => {
      const normalized = normalizeDeliveryStatus(delivery.delivery_status);
      acc[normalized] = (acc[normalized] || 0) + 1;
      return acc;
    }, {});

    return {
      active: deliveries.length,
      inTransit: statusCounts['in-transit'] || 0,
      pending: statusCounts.pending || 0
    };
  }, [deliveries]);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const deliveriesData = await fetchActiveDeliveries();
      const statusesData = await fetchOrderStatuses();
      setDeliveries(deliveriesData);
      setOrderStatuses(statusesData);
    } catch (error) {
      console.error('Failed to load data', error);
      showNotification('Unable to load deliveries');
    }
  };

  const showNotification = (message) => {
    setNotification(message);
    window.setTimeout(() => setNotification(''), 3000);
  };

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    markersRef.current.forEach((marker) => map.removeLayer(marker));
    polylinesRef.current.forEach((polyline) => map.removeLayer(polyline));
    markersRef.current.clear();
    polylinesRef.current.clear();

    deliveries.forEach((delivery) => {
      const { id, rider_name, vehicle, current_lat, current_lng, customer_lat, customer_lng, delivery_status, order_id } = delivery;

      if (!current_lat || !current_lng) return;

      const riderIcon = L.divIcon({
        html: `<div style="background: #2563eb; color: white; padding: 6px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; border: 2px solid white; box-shadow: 0 6px 18px rgba(15,23,42,0.2);">${vehicle ? vehicle[0].toUpperCase() : 'R'}</div>`,
        className: 'rider-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const riderMarker = L.marker([current_lat, current_lng], { icon: riderIcon }).addTo(map);
      const orderStatus = orderStatuses.get(order_id) || normalizeDeliveryStatus(delivery_status);
      riderMarker.bindPopup(`
        <div style="font-size: 12px; line-height: 1.4;">
          <strong>${rider_name || 'Rider'}</strong><br>
          Vehicle: ${vehicle || 'Unknown'}<br>
          Order: ${order_id}<br>
          Delivery: <strong>${capitalizeLabel(delivery_status)}</strong><br>
          Status: <strong>${capitalizeLabel(orderStatus)}</strong>
        </div>
      `);
      markersRef.current.set(`delivery-${id}`, riderMarker);

      if (customer_lat && customer_lng) {
        const customerIcon = L.divIcon({
          html: `<div style="background: #10b981; color: white; padding: 6px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; border: 2px solid white; box-shadow: 0 6px 18px rgba(15,23,42,0.2);">📍</div>`,
          className: 'customer-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const customerMarker = L.marker([customer_lat, customer_lng], { icon: customerIcon }).addTo(map);
        customerMarker.bindPopup('<div style="font-size: 12px;"><strong>Customer Location</strong></div>');
        markersRef.current.set(`customer-${id}`, customerMarker);

        const pathColor = delivery_status === 'delivered' ? '#10b981' : '#2563eb';
        const polyline = L.polyline([[current_lat, current_lng], [customer_lat, customer_lng]], {
          color: pathColor,
          weight: 2,
          opacity: 0.7,
          dashArray: delivery_status === 'delivered' ? '' : '5, 5'
        }).addTo(map);
        polylinesRef.current.set(`path-${id}`, polyline);
      }
    });
  }, [deliveries, orderStatuses]);

  const handleSearch = () => {
    if (!searchInput.trim()) {
      showNotification('Enter an order ID');
      return;
    }

    const found = deliveries.find((d) => d.order_id?.includes(searchInput));
    if (found && found.current_lat && found.current_lng) {
      const map = mapInstanceRef.current;
      map.setView([found.current_lat, found.current_lng], 15);
      const marker = markersRef.current.get(`delivery-${found.id}`);
      if (marker) marker.openPopup();
      setSelectedDeliveryId(found.id);
      showNotification(`Found order ${found.order_id}`);
    } else {
      showNotification('Order not found');
    }
  };

  const handleCenterMap = () => {
    const map = mapInstanceRef.current;
    if (deliveries.length > 0 && deliveries[0].current_lat) {
      map.setView([deliveries[0].current_lat, deliveries[0].current_lng], 14);
    } else {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
    }
  };

  const handleZoomToFit = () => {
    const map = mapInstanceRef.current;
    const bounds = L.latLngBounds([]);
    markersRef.current.forEach((marker, key) => {
      if (!key.includes('customer')) {
        bounds.extend(marker.getLatLng());
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      showNotification('No deliveries to display');
    }
  };

  const handleClearMarkers = () => {
    if (window.confirm('Clear all markers from the map?')) {
      const map = mapInstanceRef.current;
      markersRef.current.forEach((marker) => map.removeLayer(marker));
      polylinesRef.current.forEach((polyline) => map.removeLayer(polyline));
      markersRef.current.clear();
      polylinesRef.current.clear();
      setDeliveries([]);
      showNotification('All markers cleared');
    }
  };

  const handleAddTestDelivery = () => {
    const testDelivery = generateTestDelivery();
    setDeliveries((prev) => [...prev, testDelivery]);
    showNotification(`Test delivery added: ${testDelivery.order_id}`);
  };

  const handleFocusDelivery = (deliveryId, delivery) => {
    const map = mapInstanceRef.current;
    if (delivery.current_lat && delivery.current_lng) {
      map.setView([delivery.current_lat, delivery.current_lng], 15);
      const marker = markersRef.current.get(`delivery-${deliveryId}`);
      if (marker) marker.openPopup();
    }
    setSelectedDeliveryId(deliveryId);
  };

  const handleStopAll = () => {
    if (window.confirm('Stop all deliveries?')) {
      setDeliveries([]);
      showNotification('All deliveries stopped');
    }
  };

  const statusBadgeColor = (status) => {
    const normalized = normalizeDeliveryStatus(status);
    switch (normalized) {
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'picked-up':
        return 'bg-cyan-100 text-cyan-700';
      case 'in-transit':
        return 'bg-emerald-100 text-emerald-700';
      case 'arriving':
        return 'bg-orange-100 text-orange-700';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {notification ? (
              <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {notification}
              </div>
            ) : null}

            <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-200">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-500">Live tracking</p>
                  <h1 className="mt-3 text-3xl font-semibold text-slate-900">Delivery operations</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    Keep every route visible with a focused map view, live delivery cards, and fast search actions.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={loadData}
                    className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTestDelivery}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    + Add test delivery
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Active routes</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{summary.active}</p>
                  <p className="mt-2 text-sm text-slate-500">Deliveries currently tracked in the system.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">In transit</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{summary.inTransit}</p>
                  <p className="mt-2 text-sm text-slate-500">Drivers already on the road to customers.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Pending</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{summary.pending}</p>
                  <p className="mt-2 text-sm text-slate-500">Orders waiting for pickup or assignment.</p>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
              <div className="rounded-[28px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-200 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Live map</h2>
                    <p className="mt-1 text-sm text-slate-500">Search by order number and jump directly to a rider.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Order ID"
                        className="w-32 bg-transparent outline-none"
                      />
                    </label>
                    <button type="button" onClick={handleSearch} className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">
                      Locate
                    </button>
                    <button type="button" onClick={handleCenterMap} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Center
                    </button>
                    <button type="button" onClick={handleZoomToFit} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Fit all
                    </button>
                  </div>
                </div>

                <div className="relative mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100">
                  <div ref={mapRef} className="h-[320px] w-full sm:h-[360px]" />
                  <div className="absolute right-4 top-4 flex flex-col gap-2">
                    <button type="button" onClick={handleCenterMap} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                      📍 Center
                    </button>
                    <button type="button" onClick={handleZoomToFit} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                      🔎 Fit all
                    </button>
                    <button type="button" onClick={handleClearMarkers} className="rounded-2xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600">
                      🛑 Clear
                    </button>
                  </div>
                  <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">Rider</span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">Customer</span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">Live route</span>
                  </div>
                </div>
              </div>

              <aside className="flex h-[min(560px,calc(100vh-10rem))] min-h-0 flex-col overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-200 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Active deliveries</h2>
                    <p className="mt-1 text-sm text-slate-500">Review each route and jump to the map.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                    {deliveries.length}
                  </span>
                </div>

                <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
                  {deliveries.length === 0 ? (
                    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
                      No active deliveries yet. Add a test route to preview the feed.
                    </div>
                  ) : (
                    deliveries.map((delivery) => {
                      const deliveryStatus = normalizeDeliveryStatus(delivery.delivery_status);
                      const isSelected = delivery.id === selectedDeliveryId;
                      const orderStatus = orderStatuses.get(delivery.order_id) || deliveryStatus;

                      return (
                        <button
                          key={delivery.id}
                          type="button"
                          onClick={() => handleFocusDelivery(delivery.id, delivery)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isSelected ? 'border-sky-400 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{delivery.order_id || `Order #${delivery.id}`}</p>
                              <p className="mt-1 text-sm text-slate-500">{delivery.rider_name || 'Pending rider'}</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeColor(deliveryStatus)}`}>
                              {capitalizeLabel(deliveryStatus)}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1 text-sm text-slate-600">
                            <div className="flex items-center justify-between gap-2">
                              <span>Vehicle</span>
                              <span className="font-medium text-slate-700">{delivery.vehicle || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span>Status</span>
                              <span className="font-medium text-slate-700">{capitalizeLabel(orderStatus)}</span>
                            </div>
                            {delivery.distance ? (
                              <div className="flex items-center justify-between gap-2">
                                <span>Distance</span>
                                <span className="font-medium text-slate-700">{delivery.distance.toFixed(2)} km</span>
                              </div>
                            ) : null}
                            {delivery.eta ? (
                              <div className="flex items-center justify-between gap-2">
                                <span>ETA</span>
                                <span className="font-medium text-slate-700">{delivery.eta}</span>
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4">
                  <button type="button" onClick={handleStopAll} className="rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600">
                    Stop all deliveries
                  </button>
                  <button type="button" onClick={handleClearMarkers} className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                    Clear map markers
                  </button>
                </div>
              </aside>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default TrackingPage;
