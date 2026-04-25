import * as XLSX from 'xlsx'
import type { ClassTrainer } from '../types'
import type { ReportBody } from './apiClient'

export interface ParsedLegacyReport {
  sheetName: string
  body: ReportBody
  warnings: string[]
  studentNames: string[]
  progressEntries: Array<{ studentName: string; progressText: string }>
}

export interface ParsedPayrollRow {
  sheetName: string
  log_date: string
  person_type: 'trainer'
  trainer_id: string
  hours: number
  paid: boolean
  live_training: boolean
  notes: string | null
}

export interface LegacyWorkbookParseResult {
  reports: ParsedLegacyReport[]
  payrollRows: ParsedPayrollRow[]
  excludedSheets: string[]
  payrollWarnings: string[]
}

interface ParseLegacyWorkbookArgs {
  file: File
  trainers: ClassTrainer[]
  defaultGame?: string | null
  classStartDate?: string
}

const DAY_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
}

const EXCLUDED_SHEET_KEYWORDS = [
  'checklist',
  'legend',
  'formative',
  'sample',
  'tracking',
  'lt & la',
  'lt and la',
]

function normalizeText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return formatIsoDate(d)
}

function parseDayNumber(text: string): number | null {
  const lower = text.toLowerCase()
  const numberMatch = lower.match(/\bday\s+(\d{1,2})\b/)
  if (numberMatch) return Number(numberMatch[1])
  const wordMatch = lower.match(/\bday\s+([a-z]+)\b/)
  if (!wordMatch) return null
  return DAY_WORDS[wordMatch[1]] ?? null
}

function to24h(hourRaw: string, minuteRaw: string, ampmRaw: string | undefined): string {
  let hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  const ampm = (ampmRaw ?? '').toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function parseTimeRange(text: string): { start: string; end: string } | null {
  const match = text.match(/(\d{1,2})(?::|\.)(\d{2})\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::|\.)(\d{2})\s*(am|pm)?/i)
  if (!match) return null
  return {
    start: to24h(match[1], match[2], match[3]),
    end: to24h(match[4], match[5], match[6] ?? match[3]),
  }
}

function parseDateFromText(text: string): string | null {
  const cleaned = text.replace(/(\d+)(st|nd|rd|th)/gi, '$1')
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
  ]
  for (const pattern of patterns) {
    const found = cleaned.match(pattern)?.[0]
    if (!found) continue
    const date = new Date(found)
    if (!Number.isNaN(date.getTime())) return formatIsoDate(date)
  }
  return null
}

function parseGroupLabel(text: string): string | null {
  const m = text.match(/\bgroup\s*([a-z0-9]+)\b/i)
  return m ? m[1].toUpperCase() : null
}

function findTrainerByName(name: string, trainers: ClassTrainer[]): ClassTrainer | null {
  const candidate = normalizeName(name)
  if (!candidate) return null
  for (const trainer of trainers) {
    const trainerNorm = normalizeName(trainer.trainer_name)
    const trainerLast = trainerNorm.split(' ').at(-1) ?? ''
    if (
      trainerNorm.includes(candidate) ||
      candidate.includes(trainerNorm) ||
      (trainerLast && candidate.includes(trainerLast))
    ) {
      return trainer
    }
  }
  return null
}

function extractTrainerIds(textRows: string[], trainers: ClassTrainer[]): string[] {
  if (trainers.length === 0) return []
  const relevant = textRows.filter(row => /trainer|instructor|facilitator/i.test(row))
  if (relevant.length === 0) return []
  const candidateNames = new Set<string>()

  for (const line of relevant) {
    const afterColon = line.includes(':') ? line.split(':').slice(1).join(':') : line.replace(/trainers?|instructors?|facilitators?/ig, '')
    const parts = afterColon.split(/[,/&]| and /i).map(normalizeText).filter(Boolean)
    for (const p of parts) candidateNames.add(p)
  }

  const trainerIds: string[] = []
  for (const trainer of trainers) {
    const trainerNorm = normalizeName(trainer.trainer_name)
    const trainerLastName = trainerNorm.split(' ').at(-1) ?? ''
    for (const candidate of candidateNames) {
      const candidateNorm = normalizeName(candidate)
      if (!candidateNorm) continue
      if (trainerNorm.includes(candidateNorm) || candidateNorm.includes(trainerNorm) || (trainerLastName && candidateNorm.includes(trainerLastName))) {
        trainerIds.push(trainer.id)
        break
      }
    }
  }
  return [...new Set(trainerIds)]
}

function inferTimelineCategory(activity: string, notes: string): string | null {
  const combined = `${activity} ${notes}`.toLowerCase()
  if (!combined.trim()) return null
  if (combined.includes('drill') || combined.includes('test')) return 'Drill/Test'
  if (combined.includes('handout') || combined.includes('homework')) return 'Homework/Handout'
  if (combined.includes('break')) return 'Break'
  if (combined.includes('game')) return 'Game simulation'
  return 'Training block'
}

function isLikelyPersonName(text: string): boolean {
  if (!text) return false
  const normalized = normalizeText(text)
  if (normalized.length < 5 || normalized.length > 80) return false
  if (/\d/.test(normalized)) return false
  const lower = normalized.toLowerCase()
  if (/(trainee|student|trainer|date|time|activity|group|session|report|progress|rating|homework|legend|checklist)/.test(lower)) return false
  const parts = normalized.split(' ').filter(Boolean)
  if (parts.length < 2 || parts.length > 4) return false
  return parts.every(p => /^[A-Za-z][A-Za-z'-.]*$/.test(p))
}

function parseStudentNames(rows: string[][]): string[] {
  let headerIdx = -1
  let nameCol = -1

  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].map(c => c.toLowerCase())
    const candidateIdx = cells.findIndex(c => c.includes('trainee') || c.includes('student') || c === 'name' || c.includes('trainee name') || c.includes('student name'))
    if (candidateIdx >= 0) {
      headerIdx = i
      nameCol = candidateIdx
      break
    }
  }

  const names: string[] = []
  if (headerIdx >= 0) {
    let emptyStreak = 0
    for (let i = headerIdx + 1; i < rows.length; i += 1) {
      const raw = normalizeText(rows[i][nameCol] ?? '')
      if (!raw) {
        emptyStreak += 1
        if (emptyStreak >= 3 && names.length > 0) break
        continue
      }
      emptyStreak = 0
      if (isLikelyPersonName(raw)) names.push(raw)
    }
  }

  if (names.length === 0) {
    // Fallback: scan first column-ish cells for isolated names in structured rows.
    for (const row of rows) {
      for (const cell of row.slice(0, 2)) {
        const value = normalizeText(cell)
        if (isLikelyPersonName(value)) names.push(value)
      }
    }
  }

  return [...new Set(names)]
}

function parseProgressEntries(rows: string[][]): Array<{ studentName: string; progressText: string }> {
  let headerIdx = -1
  let nameCol = -1
  let progressCol = -1

  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].map(c => c.toLowerCase())
    const n = cells.findIndex(c => c.includes('trainee') || c.includes('student') || c === 'name' || c.includes('trainee name') || c.includes('student name'))
    const p = cells.findIndex(c => c.includes('progress') || c.includes('comment') || c.includes('notes'))
    if (n >= 0 && p >= 0) {
      headerIdx = i
      nameCol = n
      progressCol = p
      break
    }
  }
  if (headerIdx < 0) {
    // Fallback: detect rows that look like "<Name> ... <comment text>" without explicit headers.
    const fallback: Array<{ studentName: string; progressText: string }> = []
    for (const row of rows) {
      let nameIdx = -1
      let nameCandidate = ''
      for (let i = 0; i < Math.min(row.length, 3); i += 1) {
        const candidate = normalizeText(row[i] ?? '')
        if (isLikelyPersonName(candidate)) {
          nameCandidate = candidate
          nameIdx = i
          break
        }
      }
      if (nameIdx < 0) continue
      const textCells = row
        .filter((_, idx) => idx !== nameIdx)
        .map(c => normalizeText(c))
        .filter(Boolean)
        .filter(c => !/^(ee|me|ad|ni|yes|no|y|n)$/i.test(c))
      const progressText = textCells.join(' ').trim()
      if (!progressText) continue
      fallback.push({ studentName: nameCandidate, progressText })
    }
    return fallback
  }

  const entries: Array<{ studentName: string; progressText: string }> = []
  let emptyStreak = 0
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i]
    const studentName = normalizeText(row[nameCol] ?? '')
    const primaryProgress = normalizeText(row[progressCol] ?? '')
    const extraProgress = row
      .filter((_, idx) => idx !== nameCol)
      .map(c => normalizeText(c))
      .filter(Boolean)
      .filter(c => !/^(ee|me|ad|ni|yes|no|y|n)$/i.test(c))
      .join(' ')
      .trim()
    const progressText = primaryProgress || extraProgress
    if (!studentName && !progressText) {
      emptyStreak += 1
      if (emptyStreak >= 3 && entries.length > 0) break
      continue
    }
    emptyStreak = 0
    if (!isLikelyPersonName(studentName)) continue
    if (!progressText) continue
    entries.push({ studentName, progressText })
  }
  return entries
}

function parseTimeline(rows: string[][]): ReportBody['timeline'] {
  let headerIdx = -1
  let timeCol = -1
  let activityCol = -1
  let drillsCol = -1
  let categoryCol = -1

  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].map(c => c.toLowerCase())
    const hasTime = cells.some(c => c.includes('time'))
    const hasActivity = cells.some(c => c.includes('activity') || c.includes('breakdown'))
    if (hasTime && hasActivity) {
      headerIdx = i
      timeCol = cells.findIndex(c => c.includes('time'))
      activityCol = cells.findIndex(c => c.includes('activity') || c.includes('breakdown'))
      drillsCol = cells.findIndex(c => c.includes('drill') || c.includes('handout') || c.includes('test') || c.includes('homework'))
      categoryCol = cells.findIndex(c => c.includes('category'))
      break
    }
  }

  const result: ReportBody['timeline'] = []
  if (headerIdx < 0) return result
  let emptyStreak = 0

  const startRow = headerIdx + 1
  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i]
    const timeRaw = timeCol >= 0 ? row[timeCol] : row[0] ?? ''
    const activityRaw = activityCol >= 0 ? row[activityCol] : row[1] ?? ''
    const notesRaw = drillsCol >= 0 ? row[drillsCol] : row[2] ?? ''
    const categoryRaw = categoryCol >= 0 ? row[categoryCol] : ''
    const rowJoined = row.join(' ')
    const time = parseTimeRange(timeRaw || rowJoined)
    const activity = normalizeText(activityRaw)
    const notes = normalizeText(notesRaw)
    const category = normalizeText(categoryRaw) || inferTimelineCategory(activity, notes)

    if (!time && !activity && !notes) {
      emptyStreak += 1
      if (emptyStreak >= 4 && result.length > 0) break
      continue
    }
    emptyStreak = 0

    // Prevent trainee-comment rows from leaking into timeline
    if (!time) continue

    result.push({
      start_time: time?.start ?? null,
      end_time: time?.end ?? null,
      activity: activity || null,
      homework_handouts_tests: notes || null,
      category,
    })
  }

  return result
}

function parseSessionAndTimes(textRows: string[]): { sessionLabel: string | null; startTime: string | null; endTime: string | null } {
  for (const row of textRows) {
    const range = parseTimeRange(row)
    if (!range) continue
    const cleaned = normalizeText(row)
    const label = cleaned
      .replace(/(\d{1,2})(?::|\.)(\d{2})\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::|\.)(\d{2})\s*(am|pm)?/ig, '')
      .replace(/(?:-|:|,)+$/, '')
      .trim()
    return {
      sessionLabel: label || null,
      startTime: range.start,
      endTime: range.end,
    }
  }
  return { sessionLabel: null, startTime: null, endTime: null }
}

function isPayrollSheet(sheetName: string, textRows: string[]): boolean {
  const lowerName = sheetName.toLowerCase()
  if (lowerName.includes('payroll')) return true
  return textRows.slice(0, 10).some(t => t.toLowerCase().includes('payroll'))
}

function isLikelyDailyReportSheet(sheetName: string, textRows: string[]): boolean {
  const lowerName = sheetName.toLowerCase()
  if (EXCLUDED_SHEET_KEYWORDS.some(k => lowerName.includes(k))) return false
  if (isPayrollSheet(sheetName, textRows)) return false
  const combined = textRows.slice(0, 60).join(' ').toLowerCase()
  const hasDay = /\bday\s+(\d{1,2}|[a-z]+)\b/.test(combined) || /\bday\s+(\d{1,2}|[a-z]+)\b/.test(lowerName)
  const hasTimelineHints = (combined.includes('time') && combined.includes('activity')) || combined.includes('drill')
  return hasDay || hasTimelineHints
}

function parsePayrollRows(
  sheetName: string,
  rows: string[][],
  trainers: ClassTrainer[],
): { rows: ParsedPayrollRow[]; warnings: string[] } {
  const warnings: string[] = []
  if (trainers.length === 0) {
    return { rows: [], warnings: ['No assigned trainers in class; payroll rows skipped.'] }
  }

  let headerIdx = -1
  let dateCol = -1
  let nameCol = -1
  let hoursCol = -1
  let paidCol = -1
  let liveCol = -1
  let notesCol = -1

  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].map(c => c.toLowerCase())
    const d = cells.findIndex(c => c.includes('date'))
    const n = cells.findIndex(c => c.includes('trainer') || c.includes('name') || c.includes('person'))
    const h = cells.findIndex(c => c.includes('hour'))
    if (d >= 0 && n >= 0 && h >= 0) {
      headerIdx = i
      dateCol = d
      nameCol = n
      hoursCol = h
      paidCol = cells.findIndex(c => c.includes('paid'))
      liveCol = cells.findIndex(c => c.includes('live'))
      notesCol = cells.findIndex(c => c.includes('note'))
      break
    }
  }

  if (headerIdx < 0) {
    warnings.push('Payroll sheet did not have recognizable Date/Name/Hours columns.')
    return { rows: [], warnings }
  }

  const parsed: ParsedPayrollRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i]
    const dateRaw = normalizeText(row[dateCol] ?? '')
    const nameRaw = normalizeText(row[nameCol] ?? '')
    const hoursRaw = normalizeText(row[hoursCol] ?? '')
    if (!dateRaw && !nameRaw && !hoursRaw) continue

    const date = parseDateFromText(dateRaw)
    const hours = Number(hoursRaw)
    const trainer = findTrainerByName(nameRaw, trainers)
    if (!date || Number.isNaN(hours) || hours <= 0 || !trainer) continue

    const paidRaw = paidCol >= 0 ? normalizeText(row[paidCol] ?? '') : ''
    const liveRaw = liveCol >= 0 ? normalizeText(row[liveCol] ?? '') : ''
    const notesRaw = notesCol >= 0 ? normalizeText(row[notesCol] ?? '') : ''
    const paid = /^(yes|y|true|1|paid)$/i.test(paidRaw)
    const live_training = /^(yes|y|true|1|live)$/i.test(liveRaw)

    parsed.push({
      sheetName,
      log_date: date,
      person_type: 'trainer',
      trainer_id: trainer.id,
      hours,
      paid,
      live_training,
      notes: notesRaw || null,
    })
  }

  if (parsed.length === 0) warnings.push('No valid payroll rows parsed.')
  return { rows: parsed, warnings }
}

export async function parseLegacyWorkbook({
  file,
  trainers,
  defaultGame,
  classStartDate,
}: ParseLegacyWorkbookArgs): Promise<LegacyWorkbookParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const fileGroupLabel = parseGroupLabel(file.name)
  const reports: ParsedLegacyReport[] = []
  const payrollRows: ParsedPayrollRow[] = []
  const excludedSheets: string[] = []
  const payrollWarnings: string[] = []

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const worksheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as unknown[][]
    const rows = rawRows.map(row => row.map(normalizeText))
    const textRows = rows.map(row => normalizeText(row.join(' '))).filter(Boolean)

    if (isPayrollSheet(sheetName, textRows)) {
      const parsed = parsePayrollRows(sheetName, rows, trainers)
      payrollRows.push(...parsed.rows)
      for (const warning of parsed.warnings) payrollWarnings.push(`${sheetName}: ${warning}`)
      return
    }

    if (!isLikelyDailyReportSheet(sheetName, textRows)) {
      excludedSheets.push(sheetName)
      return
    }

    const warnings: string[] = []

    let reportDate: string | null = null
    for (const line of textRows.slice(0, 35)) {
      reportDate = parseDateFromText(line)
      if (reportDate) break
    }
    if (!reportDate && classStartDate) {
      const dayNumber = parseDayNumber(`${sheetName} ${textRows.slice(0, 10).join(' ')}`)
      reportDate = dayNumber ? addDays(classStartDate, Math.max(dayNumber - 1, 0)) : addDays(classStartDate, sheetIndex)
      warnings.push('Date inferred from class start date and sheet order/day number.')
    }
    if (!reportDate) {
      reportDate = formatIsoDate(new Date())
      warnings.push('Date not found; defaulted to today.')
    }

    const groupFromSheet = parseGroupLabel(`${sheetName} ${textRows.slice(0, 8).join(' ')}`)
    const groupLabel = groupFromSheet ?? fileGroupLabel
    if (!groupLabel) warnings.push('Group label not found.')

    const session = parseSessionAndTimes(textRows.slice(0, 40))
    if (!session.startTime || !session.endTime) warnings.push('Class time range not found.')

    const trainerIds = extractTrainerIds(textRows.slice(0, 60), trainers)
    if (trainerIds.length === 0 && trainers.length > 0) warnings.push('No trainer names matched assigned class trainers.')

    const timeline = parseTimeline(rows)
    if (timeline.length === 0) warnings.push('No timeline rows parsed.')

    const studentNames = parseStudentNames(rows)
    if (studentNames.length === 0) warnings.push('No student names parsed from this sheet.')
    const progressEntries = parseProgressEntries(rows)
    if (progressEntries.length === 0) warnings.push('No trainee progress comments parsed from this sheet.')

    reports.push({
      sheetName,
      warnings,
      studentNames,
      progressEntries,
      body: {
        report_date: reportDate,
        group_label: groupLabel ?? null,
        game: defaultGame ?? null,
        session_label: session.sessionLabel,
        class_start_time: session.startTime,
        class_end_time: session.endTime,
        current_trainees: null,
        mg_confirmed: null,
        mg_attended: null,
        licenses_received: null,
        override_hours_to_date: null,
        override_paid_hours_total: null,
        override_live_hours_total: null,
        trainer_ids: trainerIds,
        timeline,
        progress: [],
        drill_times: [],
      },
    })
  })

  return { reports, payrollRows, excludedSheets, payrollWarnings }
}
