import { ParsedCommand } from '@/lib/parsers/command-parser'
import { supabaseAdmin } from '@/lib/supabase'
import { formatBrazilian, currentMonthRange, parseMonthPeriod } from '@/lib/parsers/date-parser'
import { matchCategory, matchEmployee, type CategoryRow } from '@/lib/parsers/match'
import { formatCurrency } from '@/lib/format'
import { hasAccess } from '@/lib/access'

const AJUDA = `🌾 *ZapRural — Comandos disponíveis*

*💰 Financeiro*
!pagar <valor> <categoria> <descrição> [data]
!receber <valor> <categoria> <descrição> [data]
!pago <id> — Quitar lançamento
!saldo — Resumo do mês atual
!relatorio [mes/ano] — Ex: !relatorio set/2026

*👷 Mão de Obra*
!ponto <nome> [data] — Registrar diária
!extra <nome> <horas> [data] — Horas extras
!mao_obra [mes/ano] — Custo com equipe
!funcionarios — Listar funcionários

*📅 Datas* no formato DD/MM/AAAA (opcional)
*Categorias*: combustivel, insumos, maquinario, maodeobra, safra

Dúvidas? Fale com o suporte.`

const NOT_LINKED =
  '❌ Número não cadastrado. Acesse o portal Zap da Roça e vincule seu WhatsApp nas configurações.'
const NO_ACCESS =
  '🔒 Seu período de acesso terminou. Assine em zapdaroca.com.br para continuar usando o Zap da Roça.'

export async function handleCommand(
  cmd: ParsedCommand,
  from: string,
  messageId: string
): Promise<string> {
  const { data: phone, error: phoneError } = await supabaseAdmin
    .from('registered_phones')
    .select('user_id')
    .eq('whatsapp_number', from)
    .eq('verified', true)
    .maybeSingle()

  // A database failure must not be reported to the user as "number not registered"
  if (phoneError) throw phoneError
  if (!phone?.user_id) return NOT_LINKED

  const userId = phone.user_id

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, trial_ends_at, current_period_end, is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!hasAccess(profile)) return NO_ACCESS

  switch (cmd.command) {
    case 'ajuda':
      return AJUDA

    case 'funcionarios':
      return handleFuncionarios(userId)

    case 'saldo':
      return handleSaldo(userId)

    case 'relatorio':
      return handleRelatorio(userId, cmd.period)

    case 'pago':
      return handlePago(userId, cmd.transactionId)

    case 'pagar':
    case 'receber':
      return handleTransaction(userId, cmd, messageId)

    case 'ponto':
      return handlePonto(userId, cmd)

    case 'extra':
      return handleExtra(userId, cmd)

    case 'mao_obra':
      return handleMaoObra(userId, cmd.period)

    default:
      return '❓ Comando não reconhecido. Envie *!ajuda* para ver todos os comandos disponíveis.'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

type NamedEmbed = { name: string } | null
const embedName = (embed: unknown) => (embed as NamedEmbed)?.name

async function handleFuncionarios(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('name, daily_rate, overtime_rate')
    .eq('user_id', userId)
    .eq('active', true)
    .order('name')

  if (error || !data?.length) return '📋 Nenhum funcionário cadastrado.'

  const lines = data.map(
    (e) => `• ${e.name} — Diária: ${formatCurrency(e.daily_rate)} | H.Extra: ${formatCurrency(e.overtime_rate)}/h`
  )
  return `👷 *Funcionários ativos*\n\n${lines.join('\n')}`
}

async function handleSaldo(userId: string): Promise<string> {
  const { start, end } = currentMonthRange()

  const { data } = await supabaseAdmin
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .gte('transaction_date', start)
    .lte('transaction_date', end)

  const income = (data ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = (data ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses

  const period = `${formatBrazilian(start)} a ${formatBrazilian(end)}`
  const sinal = balance >= 0 ? '✅' : '⚠️'

  return (
    `📊 *Resumo — ${period}*\n\n` +
    `💚 Receitas:  ${formatCurrency(income)}\n` +
    `🔴 Despesas: ${formatCurrency(expenses)}\n` +
    `${sinal} Saldo:     ${formatCurrency(balance)}`
  )
}

async function handleRelatorio(userId: string, period?: string): Promise<string> {
  let start: string, end: string

  if (period) {
    const parsed = parseMonthPeriod(period)
    if (!parsed) return '❌ Período inválido. Use o formato: !relatorio 09/2026 ou !relatorio set/2026'
    start = parsed.start; end = parsed.end
  } else {
    const range = currentMonthRange()
    start = range.start; end = range.end
  }

  const { data } = await supabaseAdmin
    .from('transactions')
    .select('type, amount, description, transaction_date, paid, categories(name)')
    .eq('user_id', userId)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date')

  if (!data?.length) return `📊 Nenhum lançamento encontrado para o período ${formatBrazilian(start)}–${formatBrazilian(end)}.`

  const income = data.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = data.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const toLines = (type: 'expense' | 'income') =>
    data
      .filter((t) => t.type === type)
      .slice(0, 10)
      .map((t) => `  • ${t.description ?? embedName(t.categories)} — ${formatCurrency(t.amount)}`)
      .join('\n')

  return (
    `📋 *Relatório: ${formatBrazilian(start)} a ${formatBrazilian(end)}*\n\n` +
    `💚 *Receitas: ${formatCurrency(income)}*\n${toLines('income') || '  (nenhuma)'}\n\n` +
    `🔴 *Despesas: ${formatCurrency(expenses)}*\n${toLines('expense') || '  (nenhuma)'}\n\n` +
    `Saldo: *${formatCurrency(income - expenses)}*`
  )
}

async function handlePago(userId: string, id?: number): Promise<string> {
  if (!id) return '❌ Informe o ID do lançamento. Ex: !pago 42'

  const { data: tx } = await supabaseAdmin
    .from('transactions')
    .select('id, amount, description, paid')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!tx) return `❌ Lançamento #${id} não encontrado.`
  if (tx.paid) return `ℹ️ Lançamento #${id} já estava quitado.`

  const { error } = await supabaseAdmin
    .from('transactions')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  return `✅ Lançamento #${id} quitado!\n${tx.description} — ${formatCurrency(tx.amount)}`
}

async function handleTransaction(userId: string, cmd: ParsedCommand, messageId: string): Promise<string> {
  if (!cmd.amount || !cmd.categoryKeyword) {
    const example = cmd.command === 'pagar'
      ? '!pagar 350 combustivel abastecimento trator'
      : '!receber 8000 safra venda do milho'
    return `❌ Formato inválido (valor deve ser maior que zero). Exemplo:\n${example}`
  }

  const type = cmd.command === 'pagar' ? 'expense' : 'income'

  // Global categories (user_id IS NULL) + the tenant's own
  const { data: cats } = await supabaseAdmin
    .from('categories')
    .select('id, name, type, user_id')
    .or(`user_id.eq.${userId},user_id.is.null`)

  const category = matchCategory((cats ?? []) as CategoryRow[], cmd.categoryKeyword, type)
  const label = category?.name ?? cmd.categoryKeyword

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: userId,
      type,
      amount: cmd.amount,
      category_id: category?.id ?? null,
      description: cmd.description ?? label,
      transaction_date: cmd.date,
      paid: false,
      whatsapp_message_id: messageId,
    })
    .select('id')
    .single()

  if (error) throw error

  const emoji = type === 'expense' ? '🔴' : '💚'
  const verb = type === 'expense' ? 'Despesa' : 'Receita'

  return (
    `${emoji} *${verb} registrada! (ID: #${data.id})*\n` +
    `Valor: ${formatCurrency(cmd.amount)}\n` +
    `Categoria: ${category ? category.name : `${cmd.categoryKeyword} (sem categoria)`}\n` +
    (cmd.description ? `Descrição: ${cmd.description}\n` : '') +
    `Data: ${formatBrazilian(cmd.date!)}`
  )
}

async function findEmployee<T extends { id: string; name: string }>(
  userId: string,
  query: string,
  columns: string
): Promise<{ employee: T } | { reply: string }> {
  const { data } = await supabaseAdmin
    .from('employees')
    .select(columns)
    .eq('user_id', userId)
    .eq('active', true)

  const match = matchEmployee((data ?? []) as unknown as T[], query)
  if (match.status === 'found') return { employee: match.employee }
  if (match.status === 'ambiguous') {
    return { reply: `⚠️ Mais de um funcionário corresponde a "${query}": ${match.names.join(', ')}. Informe o nome completo.` }
  }
  return { reply: `❌ Funcionário "${query}" não encontrado.` }
}

async function handlePonto(userId: string, cmd: ParsedCommand): Promise<string> {
  if (!cmd.employeeName) return '❌ Informe o nome do funcionário. Ex: !ponto João'

  const found = await findEmployee<{ id: string; name: string; daily_rate: number }>(
    userId, cmd.employeeName, 'id, name, daily_rate'
  )
  if ('reply' in found) return found.reply
  const { employee } = found

  const { data: existing } = await supabaseAdmin
    .from('work_records')
    .select('id, daily_rate_snapshot')
    .eq('user_id', userId)
    .eq('employee_id', employee.id)
    .eq('work_date', cmd.date)

  const dayRecord = existing?.[0]

  if (existing?.some((r) => r.daily_rate_snapshot > 0)) {
    return `ℹ️ Ponto de ${employee.name} em ${formatBrazilian(cmd.date!)} já está registrado.`
  }

  if (dayRecord) {
    // Day already has an overtime-only record: add the daily rate to it
    const { error } = await supabaseAdmin
      .from('work_records')
      .update({ regular_hours: 8, daily_rate_snapshot: employee.daily_rate })
      .eq('id', dayRecord.id)
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('work_records').insert({
      user_id: userId,
      employee_id: employee.id,
      work_date: cmd.date,
      regular_hours: 8,
      overtime_hours: 0,
      daily_rate_snapshot: employee.daily_rate,
      overtime_rate_snapshot: 0,
    })
    if (error) throw error
  }

  return (
    `✅ *Ponto registrado!*\n` +
    `Funcionário: ${employee.name}\n` +
    `Data: ${formatBrazilian(cmd.date!)}\n` +
    `Diária: ${formatCurrency(employee.daily_rate)}`
  )
}

async function handleExtra(userId: string, cmd: ParsedCommand): Promise<string> {
  if (!cmd.employeeName || !cmd.hours) {
    return '❌ Formato inválido. Ex: !extra João 2 (horas entre 0 e 24)'
  }

  const found = await findEmployee<{ id: string; name: string; overtime_rate: number }>(
    userId, cmd.employeeName, 'id, name, overtime_rate'
  )
  if ('reply' in found) return found.reply
  const { employee } = found

  const { data: existing } = await supabaseAdmin
    .from('work_records')
    .select('id, overtime_hours')
    .eq('user_id', userId)
    .eq('employee_id', employee.id)
    .eq('work_date', cmd.date)

  const dayRecord = existing?.[0]

  if (dayRecord) {
    const { error } = await supabaseAdmin
      .from('work_records')
      .update({
        overtime_hours: (dayRecord.overtime_hours ?? 0) + cmd.hours,
        overtime_rate_snapshot: employee.overtime_rate,
      })
      .eq('id', dayRecord.id)
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('work_records').insert({
      user_id: userId,
      employee_id: employee.id,
      work_date: cmd.date,
      regular_hours: 0,
      overtime_hours: cmd.hours,
      daily_rate_snapshot: 0,
      overtime_rate_snapshot: employee.overtime_rate,
    })
    if (error) throw error
  }

  const totalExtra = cmd.hours * employee.overtime_rate
  return (
    `✅ *Hora extra registrada!*\n` +
    `Funcionário: ${employee.name}\n` +
    `Horas: ${cmd.hours}h × ${formatCurrency(employee.overtime_rate)} = ${formatCurrency(totalExtra)}\n` +
    `Data: ${formatBrazilian(cmd.date!)}`
  )
}

async function handleMaoObra(userId: string, period?: string): Promise<string> {
  let start: string, end: string

  if (period) {
    const parsed = parseMonthPeriod(period)
    if (!parsed) return '❌ Período inválido. Ex: !mao_obra set/2026'
    start = parsed.start; end = parsed.end
  } else {
    const range = currentMonthRange()
    start = range.start; end = range.end
  }

  const { data } = await supabaseAdmin
    .from('work_records')
    .select('daily_rate_snapshot, overtime_hours, overtime_rate_snapshot, employees(name)')
    .eq('user_id', userId)
    .gte('work_date', start)
    .lte('work_date', end)

  if (!data?.length) return `👷 Nenhum registro de trabalho em ${formatBrazilian(start)}–${formatBrazilian(end)}.`

  const byEmployee: Record<string, { name: string; days: number; extraCost: number }> = {}
  let total = 0

  for (const r of data) {
    const name = embedName(r.employees) ?? 'Desconhecido'
    if (!byEmployee[name]) byEmployee[name] = { name, days: 0, extraCost: 0 }
    if (r.daily_rate_snapshot > 0) byEmployee[name].days += 1
    const extra = r.overtime_hours * r.overtime_rate_snapshot
    byEmployee[name].extraCost += extra
    total += r.daily_rate_snapshot + extra
  }

  const lines = Object.values(byEmployee).map(
    (e) => `• ${e.name}: ${e.days} dia(s) + extras ${formatCurrency(e.extraCost)}`
  )

  return (
    `👷 *Mão de Obra: ${formatBrazilian(start)} a ${formatBrazilian(end)}*\n\n` +
    lines.join('\n') +
    `\n\n💰 *Total: ${formatCurrency(total)}*`
  )
}
