/**
 * TableCard - Premium table wrapper inspired by TailAdmin
 * Provides consistent styling for data tables
 */
function TableCard({ title, linkLabel, linkHref, headers, rows, emptyText, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      {/* Header */}
      {(title || linkLabel) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {title}
              </h3>
            </div>
          )}

          {linkHref && (
            <div className="flex items-center gap-3">
              <a
                href={linkHref}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 transition-colors"
              >
                {linkLabel}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Table or Custom Content */}
      {children ? (
        children
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-full">
            {/* Table Header */}
            <thead>
              <tr className="border-gray-100 border-y dark:border-gray-800">
                {headers.map((header) => (
                  <th key={header} className="py-3">
                    <div className="flex items-center">
                      <p className="font-medium text-gray-500 text-theme-xs dark:text-gray-400">
                        {header}
                      </p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {rows && rows.length > 0 ? (
                rows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${index}-${cellIndex}`}
                        className="px-4 py-4 text-sm text-gray-800 dark:text-gray-300"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers?.length || 1} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    {emptyText || 'No data available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TableCard;
