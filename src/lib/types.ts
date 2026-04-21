export type BookkeepingFreq = 'monthly' | 'quarterly' | 'none'
export type EslFreq = 'monthly' | 'quarterly' | 'none'
export type EmailCadence = 'monthly' | 'quarterly'
export type ClientStatus = 'active' | 'inactive' | 'liquidated' | 'on_hold'
export type TaskType = 'bookkeeping' | 'esl' | 'vat' | 'cit' | 'annual_accounts'
export type TaskStatus = 'pending' | 'info_requested' | 'in_progress' | 'done'

export const TEAM_MEMBERS = ['Jay', 'Amrit', 'Robert', 'Kartavya', 'Garima'] as const
export type TeamMember = typeof TEAM_MEMBERS[number]

export interface ClientAuditLog {
  id: string
  client_id: string
  user_id: string
  batch_id: string
  action: 'created' | 'updated' | 'deleted'
  field_name: string | null
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
}

export interface Client {
  id: string
  user_id: string
  company_name: string
  contact_first: string
  contact_last: string
  email: string
  sector: string
  bookkeeping_freq: BookkeepingFreq
  esl_freq: EslFreq
  has_vat: boolean
  has_cit: boolean
  has_annual_accounts: boolean
  email_cadence: EmailCadence
  status: ClientStatus
  email_to: string       // override TO address; empty = use contact email
  email_cc: string       // comma-separated CC addresses
  assigned_to: string
  notes: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  client_id: string
  task_type: TaskType
  period_label: string
  deadline: string   // ISO date string e.g. "2026-04-30"
  status: TaskStatus
  assigned_to: string
  notes: string
  created_at: string
  updated_at: string
  // Joined from clients table
  clients?: { company_name: string; email: string; contact_first: string }
}

export interface EmailTemplate {
  id: string
  user_id: string
  name: string
  cadence: EmailCadence
  subject: string
  body: string
  created_at: string
  updated_at: string
}

// ── Task label helpers ────────────────────────────────────────────────────────
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  bookkeeping: 'Bookkeeping',
  esl: 'ESL Filing',
  vat: 'VAT Return',
  cit: 'Corporate Income Tax',
  annual_accounts: 'Annual Accounts',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  info_requested: 'Info Requested',
  in_progress: 'In Progress',
  done: 'Done',
}

// ── Task generation ───────────────────────────────────────────────────────────
// Generates the expected tasks for the next 12 months for a given client.
// Call this when a client is created or updated to (re)populate the tasks table.

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const QUARTERS: Record<number, { label: string; months: string; endMonth: number }> = {
  1: { label: 'Q1', months: 'Jan–Mar', endMonth: 2 },  // endMonth = 0-indexed
  2: { label: 'Q2', months: 'Apr–Jun', endMonth: 5 },
  3: { label: 'Q3', months: 'Jul–Sep', endMonth: 8 },
  4: { label: 'Q4', months: 'Oct–Dec', endMonth: 11 },
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export interface GeneratedTask {
  client_id: string
  user_id: string
  task_type: TaskType
  period_label: string
  deadline: string
  status: TaskStatus
  assigned_to: string
  notes: string
}

export function generateTasksForClient(
  client: Client,
  referenceDate: Date = new Date()
): GeneratedTask[] {
  const tasks: GeneratedTask[] = []
  const base = { client_id: client.id, user_id: client.user_id, status: 'pending' as TaskStatus, assigned_to: '', notes: '' }

  const year = referenceDate.getFullYear()

  // ── Monthly bookkeeping: deadline = 15th of following month ─────────────
  if (client.bookkeeping_freq === 'monthly') {
    for (let m = 0; m < 12; m++) {
      const deadlineYear = m === 11 ? year + 1 : year
      const deadlineMonth = (m + 1) % 12
      tasks.push({
        ...base,
        task_type: 'bookkeeping',
        period_label: `${MONTH_NAMES[m]} ${year}`,
        deadline: dateStr(deadlineYear, deadlineMonth, 15),
      })
    }
  }

  // ── Quarterly bookkeeping: deadline = 15th of month after quarter-end ───
  if (client.bookkeeping_freq === 'quarterly') {
    for (let q = 1; q <= 4; q++) {
      const qInfo = QUARTERS[q]
      const deadlineDate = new Date(year, qInfo.endMonth + 1, 15)
      tasks.push({
        ...base,
        task_type: 'bookkeeping',
        period_label: `${qInfo.label} ${year} (${qInfo.months})`,
        deadline: deadlineDate.toISOString().split('T')[0],
      })
    }
  }

  // ── Monthly ESL: same deadline as monthly bookkeeping ───────────────────
  if (client.esl_freq === 'monthly') {
    for (let m = 0; m < 12; m++) {
      const deadlineYear = m === 11 ? year + 1 : year
      const deadlineMonth = (m + 1) % 12
      tasks.push({
        ...base,
        task_type: 'esl',
        period_label: `${MONTH_NAMES[m]} ${year}`,
        deadline: dateStr(deadlineYear, deadlineMonth, 15),
      })
    }
  }

  // ── Quarterly ESL: 15th of month after quarter-end ──────────────────────
  if (client.esl_freq === 'quarterly') {
    for (let q = 1; q <= 4; q++) {
      const qInfo = QUARTERS[q]
      const deadlineDate = new Date(year, qInfo.endMonth + 1, 15)
      tasks.push({
        ...base,
        task_type: 'esl',
        period_label: `${qInfo.label} ${year} (${qInfo.months})`,
        deadline: deadlineDate.toISOString().split('T')[0],
      })
    }
  }

  // ── Quarterly VAT: last day of month following quarter-end ──────────────
  if (client.has_vat) {
    for (let q = 1; q <= 4; q++) {
      const qInfo = QUARTERS[q]
      // Last day of the month after quarter-end
      const deadlineDate = new Date(year, qInfo.endMonth + 2, 0) // day 0 = last day of prev month
      tasks.push({
        ...base,
        task_type: 'vat',
        period_label: `${qInfo.label} ${year} VAT`,
        deadline: deadlineDate.toISOString().split('T')[0],
      })
    }
  }

  // ── Annual CIT: June 30 of following year ────────────────────────────────
  if (client.has_cit) {
    tasks.push({
      ...base,
      task_type: 'cit',
      period_label: `CIT ${year}`,
      deadline: `${year + 1}-06-30`,
    })
  }

  // ── Annual Accounts: July 31 of following year ───────────────────────────
  if (client.has_annual_accounts) {
    tasks.push({
      ...base,
      task_type: 'annual_accounts',
      period_label: `Annual Accounts ${year}`,
      deadline: `${year + 1}-07-31`,
    })
  }

  return tasks
}
