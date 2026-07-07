/**
 * StatusBadge - Premium status indicator inspired by TailAdmin
 * Displays status with color coding
 */
function StatusBadge({ status, type = 'default' }) {
  const statusConfig = {
    success: {
      bg: 'bg-success-50 dark:bg-success-500/15',
      text: 'text-success-600 dark:text-success-500',
      label: status || 'Success'
    },
    error: {
      bg: 'bg-error-50 dark:bg-error-500/15',
      text: 'text-error-600 dark:text-error-500',
      label: status || 'Error'
    },
    warning: {
      bg: 'bg-warning-50 dark:bg-warning-500/15',
      text: 'text-warning-600 dark:text-warning-500',
      label: status || 'Warning'
    },
    pending: {
      bg: 'bg-blue-light-50 dark:bg-blue-light-500/15',
      text: 'text-blue-light-600 dark:text-blue-light-500',
      label: status || 'Pending'
    },
    default: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      label: status || 'Default'
    }
  };

  const config = statusConfig[type] || statusConfig.default;

  return (
    <span className={`inline-flex items-center rounded-full ${config.bg} px-3 py-1 text-xs font-medium ${config.text}`}>
      {config.label}
    </span>
  );
}

export default StatusBadge;
