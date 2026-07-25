import React from 'react';
import { motion } from 'framer-motion';
import { Phone, MessageCircle, MapPin, Truck } from 'lucide-react';

function DeliveryDetailsDrawer({ open, onClose, delivery, currentUser, onAction }) {
  if (!open || !delivery) return null;

  const handleCall = (phone) => {
    if (!phone) return;
    window.open(`tel:${phone}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.aside
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        className="relative ml-auto w-full max-w-[920px] bg-white shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold">Order #{delivery.orderId || delivery.id}</h3>
              <p className="text-sm text-slate-500">{delivery.product || 'No summary'}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-full bg-slate-100 p-2" onClick={() => handleCall(delivery.customerPhone)}>
                <Phone className="h-4 w-4" />
              </button>
              <button className="rounded-full bg-slate-100 p-2" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs text-slate-500">Customer</div>
              <div className="text-sm font-semibold">{delivery.customerName || 'Customer'}</div>
              <div className="text-xs text-slate-400">{delivery.customerPhone || '—'}</div>
              <div className="mt-2 text-sm text-slate-600">{delivery.deliveryAddress || 'Address not provided'}</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-500">Rider</div>
              <div className="text-sm font-semibold">{delivery.riderName || 'Unassigned'}</div>
              <div className="text-xs text-slate-400">Branch: {delivery.branchName || delivery.branchId || '—'}</div>
              <div className="mt-2 text-sm text-slate-600">Status: {delivery.deliveryStatus}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">ETA</div>
              <div className="font-semibold">{delivery.eta || 'Pending'}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Distance</div>
              <div className="font-semibold">{delivery.distance != null ? `${(delivery.distance/1000).toFixed(1)} km` : 'Pending'}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Last updated</div>
              <div className="font-semibold">{delivery.updatedAt || '—'}</div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => onAction('reassign')} className="rounded-md bg-slate-900 px-4 py-2 text-white">Reassign Rider</button>
            <button onClick={() => onAction('call_rider')} className="rounded-md border px-4 py-2">Call Rider</button>
            <button onClick={() => onAction('message_customer')} className="rounded-md border px-4 py-2">Message Customer</button>
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'rider') && (
              <button onClick={() => onAction('mark_delivered')} className="ml-auto rounded-md bg-emerald-500 px-4 py-2 text-white">Mark Delivered</button>
            )}
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

export default DeliveryDetailsDrawer;
