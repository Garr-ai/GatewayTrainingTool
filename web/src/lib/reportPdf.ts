import type { ReportWithNested } from './apiClient'
import type { ClassTrainer, ClassEnrollment } from '../types'

export interface ReportPdfArgs {
  report: ReportWithNested
  className: string
  trainers: ClassTrainer[]
  enrollments: ClassEnrollment[]
}

function esc(v: string | null | undefined): string {
  if (v == null) return '—'
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function generateReportHtml({ report, className, trainers, enrollments }: ReportPdfArgs): string {
  const trainerNames = report.trainer_ids.length
    ? report.trainer_ids.map(id => trainers.find(t => t.id === id)?.trainer_name ?? id).map(esc).join(', ')
    : '—'

  const fmt = esc
  const fmtNum = (v: number | null | undefined) => (v != null ? String(v) : '—')

  const timelineRows = report.timeline.length
    ? report.timeline
        .map(
          item => `
        <tr>
          <td>${fmt(item.start_time)}${item.start_time && item.end_time ? ' – ' : ''}${item.end_time ?? ''}</td>
          <td>${fmt(item.activity)}</td>
          <td>${fmt(item.homework_handouts_tests)}</td>
          <td>${fmt(item.category)}</td>
        </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">No timeline entries</td></tr>'

  const progressRows = report.progress.length
    ? report.progress
        .map(row => {
          const enr = enrollments.find(e => e.id === row.enrollment_id)
          return `
        <tr>
          <td>${enr?.student_name ?? 'Unknown'}</td>
          <td class="center">${fmt(row.gk_rating)}</td>
          <td class="center">${fmt(row.dex_rating)}</td>
          <td class="center">${fmt(row.hom_rating)}</td>
          <td class="center">${row.coming_back_next_day ? '✓' : '✗'}</td>
          <td class="center">${row.homework_completed ? '✓' : '✗'}</td>
          <td>${fmt(row.progress_text)}</td>
        </tr>`
        })
        .join('')
    : '<tr><td colspan="7" class="empty">No trainee progress entries</td></tr>'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Daily Report – ${esc(className)} – ${esc(report.report_date)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; padding: 32px 40px; }
    h1 { font-size: 18px; font-weight: 700; color: #081C30; }
    h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #134270; margin-bottom: 6px; margin-top: 20px; border-bottom: 1.5px solid #134270; padding-bottom: 3px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #081C30; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left .subtitle { font-size: 12px; color: #475569; margin-top: 2px; }
    .header-right { text-align: right; font-size: 11px; color: #64748b; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 4px; }
    .meta-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; }
    .meta-item .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 2px; }
    .meta-item .value { font-size: 12px; font-weight: 600; color: #0f172a; }
    .trainers { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 10px; margin-bottom: 4px; }
    .trainers .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #3b82f6; font-weight: 600; }
    .trainers .value { font-size: 11px; color: #1e3a5f; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    thead tr { background: #134270; color: #fff; }
    thead th { padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    td.center { text-align: center; }
    td.empty { text-align: center; color: #94a3b8; padding: 12px; font-style: italic; }
    footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 16px 20px; }
      @page { margin: 12mm 14mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${esc(className)} — Daily Report</h1>
      <div class="subtitle">${esc(report.report_date)}${report.group_label ? ' · Group ' + esc(report.group_label) : ''}${report.session_label ? ' · ' + esc(report.session_label) : ''}</div>
    </div>
    <div class="header-right">
      <div>Generated ${new Date().toLocaleDateString('en-CA')}</div>
      <div>Gateway Casinos Training Tool</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><div class="label">Game</div><div class="value">${fmt(report.game)}</div></div>
    <div class="meta-item"><div class="label">Class time</div><div class="value">${report.class_start_time ?? ''}${report.class_start_time && report.class_end_time ? ' – ' : ''}${report.class_end_time ?? ''}${!report.class_start_time && !report.class_end_time ? '—' : ''}</div></div>
    <div class="meta-item"><div class="label">M&amp;G confirmed / attended</div><div class="value">${fmtNum(report.mg_confirmed)} / ${fmtNum(report.mg_attended)}</div></div>
    <div class="meta-item"><div class="label">Current trainees</div><div class="value">${fmtNum(report.current_trainees)}</div></div>
    <div class="meta-item"><div class="label">Licenses received</div><div class="value">${fmtNum(report.licenses_received)}</div></div>
    <div class="meta-item"><div class="label">Hours to date</div><div class="value">${report.override_hours_to_date != null ? report.override_hours_to_date : '—'}</div></div>
    <div class="meta-item"><div class="label">Total paid hours</div><div class="value">${report.override_paid_hours_total != null ? report.override_paid_hours_total : '—'}</div></div>
    <div class="meta-item"><div class="label">Live training hours</div><div class="value">${report.override_live_hours_total != null ? report.override_live_hours_total : '—'}</div></div>
  </div>

  <div class="trainers">
    <div class="label">Trainers</div>
    <div class="value">${trainerNames}</div>
  </div>

  <h2>Training Timeline</h2>
  <table>
    <thead>
      <tr>
        <th style="width:14%">Time</th>
        <th style="width:30%">Activity</th>
        <th style="width:30%">Homework / Handouts / Tests</th>
        <th style="width:26%">Category</th>
      </tr>
    </thead>
    <tbody>${timelineRows}</tbody>
  </table>

  <h2>Trainee Progress</h2>
  <table>
    <thead>
      <tr>
        <th style="width:18%">Trainee</th>
        <th style="width:6%">GK</th>
        <th style="width:6%">Dex</th>
        <th style="width:6%">HoM</th>
        <th style="width:8%">Coming back</th>
        <th style="width:8%">HW done</th>
        <th>Progress notes</th>
      </tr>
    </thead>
    <tbody>${progressRows}</tbody>
  </table>

  <footer>
    <span>${esc(className)} — ${esc(report.report_date)}</span>
    <span>Gateway Casinos &amp; Entertainment (Unofficial)</span>
  </footer>
</body>
</html>`
}
