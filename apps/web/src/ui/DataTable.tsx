import { Loader2 } from 'lucide-react'

export interface Column {
  key: string
  label?: React.ReactNode
  align?: 'left' | 'right'
  /** Overrides the default `px-4 py-2.5 font-medium` header cell classes. */
  className?: string
}

interface DataTableProps {
  columns: Column[]
  loading?: boolean
  loadingLabel?: string
  /** When true and not loading, renders the `empty` node in a full-width row. */
  isEmpty?: boolean
  empty?: React.ReactNode
  /** `<tr>` rows for the body. */
  children?: React.ReactNode
}

/**
 * Bordered, responsive table surface with shared header styling and built-in
 * loading / empty rows. Pages only supply the header spec and body rows.
 */
export default function DataTable({
  columns,
  loading,
  loadingLabel = 'Loading...',
  isEmpty,
  empty,
  children,
}: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.className ?? `px-4 py-2.5 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" aria-hidden />
                    {loadingLabel}
                  </span>
                </td>
              </tr>
            )}
            {!loading && isEmpty && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-500">
                  {empty}
                </td>
              </tr>
            )}
            {!loading && children}
          </tbody>
        </table>
      </div>
    </div>
  )
}
