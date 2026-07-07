/**
 * MetricCard - Premium metric display component inspired by TailAdmin
 * Displays a single metric with icon, label, value, and optional change indicator
 */
function MetricCard({ icon, label, value, change, changeType = 'positive' }) {
  const isNegative = changeType === 'negative';
  const iconBgColor = isNegative ? 'bg-error-50 dark:bg-error-500/15' : 'bg-success-50 dark:bg-success-500/15';
  const iconTextColor = isNegative ? 'text-error-500 dark:text-error-500' : 'text-success-500 dark:text-success-500';
  const changeBgColor = isNegative ? 'bg-error-50 dark:bg-error-500/15' : 'bg-success-50 dark:bg-success-500/15';
  const changeTextColor = isNegative ? 'text-error-600 dark:text-error-500' : 'text-success-600 dark:text-success-500';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 transition-all hover:shadow-theme-md dark:hover:shadow-none">
      {/* Icon Container */}
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBgColor}`}>
        <div className={`h-6 w-6 ${iconTextColor}`}>{icon}</div>
      </div>

      {/* Content */}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
          <h4 className="mt-2 text-title-sm font-bold text-gray-800 dark:text-white/90">
            {value}
          </h4>
        </div>

        {/* Change Badge */}
        {change !== null && change !== undefined && (
          <span className={`flex items-center gap-1 rounded-full ${changeBgColor} py-0.5 pl-2 pr-2.5 text-sm font-medium ${changeTextColor}`}>
            <svg
              className="fill-current"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d={
                  isNegative
                    ? 'M5.31462 10.3761C5.45194 10.5293 5.65136 10.6257 5.87329 10.6257C5.8736 10.6257 5.8739 10.6257 5.87421 10.6257C6.0663 10.6259 6.25845 10.5527 6.40505 10.4062L9.40514 7.4082C9.69814 7.11541 9.69831 6.64054 9.40552 6.34754C9.11273 6.05454 8.63785 6.05438 8.34486 6.34717L6.62329 8.06753L6.62329 1.875C6.62329 1.46079 6.28751 1.125 5.87329 1.125C5.45908 1.125 5.12329 1.46079 5.12329 1.875L5.12329 8.06422L3.40516 6.34719C3.11218 6.05439 2.6373 6.05454 2.3445 6.34752C2.0517 6.64051 2.05185 7.11538 2.34484 7.40818L5.31462 10.3761Z'
                    : 'M5.56462 1.62393C5.70193 1.47072 5.90135 1.37432 6.12329 1.37432C6.1236 1.37432 6.12391 1.37432 6.12422 1.37432C6.31631 1.37415 6.50845 1.44731 6.65505 1.59381L9.65514 4.5918C9.94814 4.88459 9.94831 5.35947 9.65552 5.65246C9.36273 5.94546 8.88785 5.94562 8.59486 5.65283L6.87329 3.93247L6.87329 10.125C6.87329 10.5392 6.53751 10.875 6.12329 10.875C5.70908 10.875 5.37329 10.5392 5.37329 10.125L5.37329 3.93578L3.65516 5.65282C3.36218 5.94562 2.8873 5.94547 2.5945 5.65248C2.3017 5.35949 2.30185 4.88462 2.59484 4.59182L5.56462 1.62393Z'
                }
              />
            </svg>
            {change >= 0 ? '+' : '-'}{Math.abs(Number(change)).toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
