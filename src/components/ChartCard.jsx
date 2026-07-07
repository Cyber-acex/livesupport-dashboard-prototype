/**
 * ChartCard - Premium chart wrapper inspired by TailAdmin
 * Provides consistent styling for chart containers
 */
function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6 ${className}`}>
      {title && (
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
}

export default ChartCard;
