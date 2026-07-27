import React from 'react';
import { motion } from 'framer-motion';
import { Phone, MessageCircle, MapPin, Truck, X, Sparkles } from 'lucide-react';

function DeliveryDetailsDrawer({ open, onClose, delivery, currentUser, onAction }) {
  if (!open || !delivery) return null;

  const handleCall = (phone) => {
    if (!phone) return;
    window.open(`tel:${phone}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <motion.aside
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        className="relative ml-auto flex w-full max-w-[940px] flex-col bg-[linear-gradient(135deg,_#ffffff_0%,_#f7fbff_100%)] shadow-[0_30px_100px_-24px_rgba(15,23,42,0.65)]"
      >
        <div className="bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-500 p-6 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]">
                <Sparkles className="h-3.5 w-3.5" />
                Live dispatch details
              </div>
              <h3 className="mt-3 text-2xl font-semibold">Order #{delivery.orderId || delivery.id}</h3>
              <p className="mt-1 text-sm text-cyan-50">{delivery.product || 'No summary'}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-full bg-white/15 p-2 backdrop-blur" onClick={() => handleCall(delivery.customerPhone)}>
                <Phone className="h-4 w-4" />
              </button>
              <button className="rounded-full bg-white/15 p-2 backdrop-blur" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Customer</div>
              <div className="mt-3 text-lg font-semibold text-slate-950">{delivery.customerName || 'Customer'}</div>
              <div className="mt-1 text-sm text-slate-500">{delivery.customerPhone || '—'}</div>
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                <span>{delivery.deliveryAddress || 'Address not provided'}</span>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Rider</div>
              <div className="mt-3 text-lg font-semibold text-slate-950">{delivery.riderName || 'Unassigned'}</div>
              <div className="mt-1 text-sm text-slate-500">Branch: {delivery.branchName || delivery.branchId || '—'}</div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-sm font-medium text-fuchsia-700">
                <Truck className="h-4 w-4" />
                {delivery.deliveryStatus || 'Pending'}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] border border-cyan-200 bg-cyan-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">ETA</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{delivery.eta || 'Pending'}</div>
            </div>
            <div className="rounded-[20px] border border-fuchsia-200 bg-fuchsia-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">Distance</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{delivery.distance != null ? `${(delivery.distance / 1000).toFixed(1)} km` : 'Pending'}</div>
            </div>
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">Updated</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{delivery.updatedAt || '—'}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onAction('reassign')} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Reassign Rider</button>
            <button onClick={() => onAction('call_rider')} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Call Rider</button>
            <button onClick={() => onAction('message_customer')} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Message Customer</button>
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'rider') && (
              <button onClick={() => onAction('mark_delivered')} className="ml-auto rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 px-4 py-2 text-sm font-semibold text-white">Mark Delivered</button>
            )}
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

export default DeliveryDetailsDrawer;
