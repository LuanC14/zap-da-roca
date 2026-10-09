// Minimal in-memory stand-in for the supabase-js query builder (only what the app uses).
// It does NOT apply RLS — it stands in for the service-role client, so tests prove that
// the application code itself scopes every query to the tenant.

type Row = Record<string, unknown>
export type Tables = Record<string, Row[]>
type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number | null }

const UNIQUE: Record<string, string> = { registered_phones: 'whatsapp_number', whatsapp_messages: 'id' }
const IDENTITY = new Set(['transactions', 'work_records'])
const EMBED_FK: Record<string, string> = { categories: 'category_id', employees: 'employee_id' }

const cmp = (a: unknown, b: unknown) => {
  const x = a as number | string
  const y = b as number | string
  return x < y ? -1 : x > y ? 1 : 0
}

function likeToRegex(pattern: string): RegExp {
  const body = pattern.split('%').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${body}$`, 'i')
}

export function createFakeDb(seed: Tables = {}) {
  const tables: Tables = Object.fromEntries(
    Object.entries(seed).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))])
  )
  let nextId = 1

  class Query implements PromiseLike<Result> {
    private filters: ((r: Row) => boolean)[] = []
    private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
    private payload: Row | Row[] = {}
    private cols = '*'
    private head = false
    private wantCount = false
    private orderBy: { col: string; asc: boolean } | null = null
    private limitN: number | null = null
    private mode: 'many' | 'single' | 'maybe' = 'many'
    private onConflict: string | undefined

    constructor(private table: string) {}

    select(cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
      this.cols = cols
      this.head = !!opts?.head
      this.wantCount = !!opts?.count
      return this
    }
    insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this }
    update(p: Row) { this.op = 'update'; this.payload = p; return this }
    upsert(p: Row, opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.onConflict = opts?.onConflict; return this }
    delete() { this.op = 'delete'; return this }

    eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this }
    neq(col: string, v: unknown) { this.filters.push((r) => r[col] !== v); return this }
    gte(col: string, v: unknown) { this.filters.push((r) => cmp(r[col], v) >= 0); return this }
    lte(col: string, v: unknown) { this.filters.push((r) => cmp(r[col], v) <= 0); return this }
    lt(col: string, v: unknown) { this.filters.push((r) => cmp(r[col], v) < 0); return this }
    in(col: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[col])); return this }
    is(col: string, v: null) { this.filters.push((r) => (r[col] ?? null) === v); return this }
    ilike(col: string, pattern: string) {
      const re = likeToRegex(pattern)
      this.filters.push((r) => re.test(String(r[col] ?? '')))
      return this
    }
    // Supports the `col.eq.value,col.is.null` form used by the app
    or(expr: string) {
      const conds = expr.split(',').map((c) => {
        const [col, op, ...rest] = c.split('.')
        const val = rest.join('.')
        return (r: Row) => (op === 'is' ? (r[col] ?? null) === null : String(r[col]) === val)
      })
      this.filters.push((r) => conds.some((c) => c(r)))
      return this
    }
    order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending ?? true }; return this }
    limit(n: number) { this.limitN = n; return this }
    single() { this.mode = 'single'; return this }
    maybeSingle() { this.mode = 'maybe'; return this }

    then<A = Result, B = never>(
      onfulfilled?: ((v: Result) => A | PromiseLike<A>) | null,
      onrejected?: ((e: unknown) => B | PromiseLike<B>) | null
    ): PromiseLike<A | B> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected)
    }

    private embed(rows: Row[]): Row[] {
      const embeds = [...this.cols.matchAll(/(\w+)\(([^)]*)\)/g)].map((m) => m[1])
      return rows.map((r) => {
        const out: Row = { ...r }
        for (const rel of embeds) {
          const fk = EMBED_FK[rel]
          out[rel] = fk ? (tables[rel] ?? []).find((x) => x.id === r[fk]) ?? null : null
        }
        return out
      })
    }

    private shape(rows: Row[]): Result {
      if (this.mode === 'many') return { data: rows, error: null }
      if (this.mode === 'maybe') {
        if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
        return { data: rows[0] ?? null, error: null }
      }
      if (rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'expected one row' } }
      return { data: rows[0], error: null }
    }

    private insertRows(rows: Row[]): Result {
      const tbl = (tables[this.table] ??= [])
      const uniqueCol = UNIQUE[this.table]
      const inserted: Row[] = []
      for (const row of rows) {
        if (uniqueCol && tbl.some((r) => r[uniqueCol] === row[uniqueCol])) {
          return { data: null, error: { code: '23505', message: `duplicate key on ${uniqueCol}` } }
        }
        const full: Row = { ...row }
        if (IDENTITY.has(this.table)) full.id = nextId++
        else if (full.id === undefined && !uniqueCol) full.id = `id-${nextId++}`
        if (this.table === 'phone_verifications') {
          full.attempts ??= 0
          full.used ??= false
          full.created_at ??= new Date().toISOString()
        }
        tbl.push(full)
        inserted.push(full)
      }
      return this.shape(this.embed(inserted))
    }

    private run(): Result {
      const tbl = (tables[this.table] ??= [])
      const matches = () => tbl.filter((r) => this.filters.every((f) => f(r)))

      switch (this.op) {
        case 'insert':
          return this.insertRows(Array.isArray(this.payload) ? this.payload : [this.payload])
        case 'upsert': {
          const col = this.onConflict ?? 'id'
          const p = this.payload as Row
          const existing = tbl.find((r) => r[col] === p[col])
          if (existing) { Object.assign(existing, p); return this.shape([existing]) }
          return this.insertRows([p])
        }
        case 'update': {
          const rows = matches()
          rows.forEach((r) => Object.assign(r, this.payload))
          return this.shape(this.embed(rows))
        }
        case 'delete': {
          const rows = matches()
          tables[this.table] = tbl.filter((r) => !rows.includes(r))
          return { data: null, error: null }
        }
        default: {
          let rows = matches()
          if (this.orderBy) {
            const { col, asc } = this.orderBy
            rows = [...rows].sort((a, b) => (asc ? 1 : -1) * cmp(a[col], b[col]))
          }
          if (this.limitN !== null) rows = rows.slice(0, this.limitN)
          if (this.head) return { data: null, error: null, count: rows.length }
          const res = this.shape(this.embed(rows))
          if (this.wantCount) res.count = rows.length
          return res
        }
      }
    }
  }

  return { tables, from: (table: string) => new Query(table) }
}

export type FakeDb = ReturnType<typeof createFakeDb>

// Typical data set: two tenants (A active, B in trial), one expired, one unverified number
export const FUTURE = new Date(Date.now() + 5 * 86_400_000).toISOString()
export const PAST = new Date(Date.now() - 5 * 86_400_000).toISOString()

export function baseSeed(): Tables {
  return {
    registered_phones: [
      { user_id: 'user-a', whatsapp_number: '5511999990001', verified: true },
      { user_id: 'user-b', whatsapp_number: '5511999990002', verified: true },
      { user_id: 'user-expired', whatsapp_number: '5511999990003', verified: true },
      { user_id: 'user-pending', whatsapp_number: '5511999990004', verified: false },
      { user_id: 'user-admin', whatsapp_number: '5511999990005', verified: true },
    ],
    profiles: [
      { id: 'user-a', subscription_status: 'active', trial_ends_at: PAST, is_admin: false },
      { id: 'user-b', subscription_status: 'trial', trial_ends_at: FUTURE, is_admin: false },
      { id: 'user-expired', subscription_status: 'trial', trial_ends_at: PAST, is_admin: false },
      { id: 'user-pending', subscription_status: 'active', trial_ends_at: FUTURE, is_admin: false },
      { id: 'user-admin', subscription_status: 'trial', trial_ends_at: PAST, is_admin: true },
    ],
    categories: [
      { id: 'c1', name: 'Insumos / Adubos', type: 'expense', user_id: null },
      { id: 'c2', name: 'Combustível / Diesel', type: 'expense', user_id: null },
      { id: 'c3', name: 'Maquinário', type: 'expense', user_id: null },
      { id: 'c4', name: 'Mão de Obra', type: 'expense', user_id: null },
      { id: 'c5', name: 'Venda de Safra', type: 'income', user_id: null },
      { id: 'c6', name: 'Veterinário', type: 'expense', user_id: 'user-b' },
    ],
    employees: [
      { id: 'e1', user_id: 'user-a', name: 'João Silva', daily_rate: 100, overtime_rate: 15, active: true },
      { id: 'e2', user_id: 'user-a', name: 'José Santos', daily_rate: 90, overtime_rate: 12, active: true },
      { id: 'e3', user_id: 'user-b', name: 'João Silva', daily_rate: 200, overtime_rate: 30, active: true },
      { id: 'e4', user_id: 'user-b', name: 'Pedro Lima', daily_rate: 150, overtime_rate: 20, active: true },
    ],
    transactions: [],
    work_records: [],
    whatsapp_messages: [],
    phone_verifications: [],
    payment_events: [],
  }
}
