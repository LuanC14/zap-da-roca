export type TransactionType = 'expense' | 'income'

export interface Category {
  id: string
  name: string
  type: 'expense' | 'income' | 'both'
  is_default: boolean
}

export interface Employee {
  id: string
  name: string
  daily_rate: number
  overtime_rate: number
  work_days: string[]
  work_hours: { start: string; end: string }
  active: boolean
  created_at: string
}

export interface WorkRecord {
  id: string
  employee_id: string
  employee?: Employee
  work_date: string
  regular_hours: number
  overtime_hours: number
  daily_rate_snapshot: number
  overtime_rate_snapshot: number
  notes: string | null
  created_at: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category_id: string
  category?: Category
  description: string
  transaction_date: string
  paid: boolean
  paid_at: string | null
  whatsapp_message_id: string | null
  created_at: string
}

export interface DashboardKPIs {
  income: number
  expenses: number
  balance: number
  labor_cost: number
  pending_today: number
}
