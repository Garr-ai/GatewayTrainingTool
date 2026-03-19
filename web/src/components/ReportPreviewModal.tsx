import { useEffect, useRef, useState } from 'react'
import { generateReportHtml } from '../lib/reportPdf'
import type { ReportPdfArgs } from '../lib/reportPdf'

export function ReportPreviewModal({ args, onClose }: { args: ReportPdfArgs; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const filename = `report-${args.className.replace(/\s+/g, '-')}-${args.report.report_date}.html`

  useEffect(() => {
    const html = generateReportHtml(args)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePrint() {
    iframeRef.current?.contentWindow?.print()
  }

  function handleDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={onClose}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between bg-gw-darkest px-4 py-3 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-sm font-medium text-white truncate">
          {args.className} — {args.report.report_date}
          {args.report.group_label ? ` · Group ${args.report.group_label}` : ''}
        </span>
        <div className="flex items-center gap-2 ml-4">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-md bg-gw-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-gw-blue-hover"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* iframe preview */}
      <div className="flex-1 min-h-0 p-4" onClick={e => e.stopPropagation()}>
        {blobUrl && (
          <iframe
            ref={iframeRef}
            src={blobUrl}
            className="w-full h-full rounded-lg bg-white shadow-lg"
            title="Report preview"
          />
        )}
      </div>
    </div>
  )
}
