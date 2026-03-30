import type { PayrollRow } from '../types'

interface PayrollTableProps {
  rows: PayrollRow[]
  personLabel: string
}

export function PayrollTable({ rows, personLabel }: PayrollTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm table-fixed">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-gw-dark">
              <th className="px-4 py-3 font-medium text-white">{personLabel} Name</th>
              <th className="px-4 py-3 font-medium text-white hidden sm:table-cell">Email</th>
              <th className="px-4 py-3 font-medium text-white text-right">Total Hours</th>
              <th className="px-4 py-3 font-medium text-white text-right">Paid Hours</th>
              <th className="px-4 py-3 font-medium text-white text-right hidden md:table-cell">Live Hours</th>
              <th className="px-4 py-3 font-medium text-white text-right hidden md:table-cell">Classes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.person_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-gw-dark truncate">{r.person_name}</td>
                <td className="px-4 py-3 text-slate-600 truncate hidden sm:table-cell">{r.person_email}</td>
                <td className="px-4 py-3 text-slate-700 text-right font-medium">{r.total_hours}</td>
                <td className="px-4 py-3 text-slate-700 text-right">{r.paid_hours}</td>
                <td className="px-4 py-3 text-slate-600 text-right hidden md:table-cell">{r.live_hours}</td>
                <td className="px-4 py-3 text-slate-600 text-right hidden md:table-cell">{r.class_count}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 font-medium text-slate-800">
                <td className="px-4 py-3">Totals</td>
                <td className="hidden sm:table-cell" />
                <td className="px-4 py-3 text-right">{rows.reduce((s, r) => s + r.total_hours, 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{rows.reduce((s, r) => s + r.paid_hours, 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right hidden md:table-cell">{rows.reduce((s, r) => s + r.live_hours, 0).toFixed(2)}</td>
                <td className="hidden md:table-cell" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
