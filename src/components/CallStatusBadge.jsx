import StatusBadge from './StatusBadge';

const statusMap = {
  waiting: { label: 'Calling…', type: 'pending' },
  ringing: { label: 'Ringing…', type: 'pending' },
  answered: { label: 'Connected', type: 'success' },
  rejected: { label: 'Rejected', type: 'error' },
  missed: { label: 'Missed', type: 'warning' },
  ended: { label: 'Ended', type: 'default' },
  failed: { label: 'Failed', type: 'error' }
};

function CallStatusBadge({ status }) {
  const config = statusMap[status] || { label: 'Unknown', type: 'default' };
  return <StatusBadge status={config.label} type={config.type} />;
}

export default CallStatusBadge;
