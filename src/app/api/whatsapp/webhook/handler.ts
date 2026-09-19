import { ParsedCommand } from '@/lib/parsers/command-parser'
import { supabaseAdmin } from '@/lib/supabase'
import { formatBrazilian, currentMonthRange, parseMonthPeriod } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'

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

export async function handleCommand(
  cmd: ParsedCommand,
  from: string,
  messageId: string
): Promise<string> {
  switch (cmd.command) {
    case 'ajuda':
      return AJUDA

    case 'funcionarios':
      return handleFuncionarios()

    case 'saldo':
      return handleSaldo()

    case 'relatorio':
      return handleRelatorio(cmd.period)

    case 'pago':
      return handlePago(cmd.transactionId)

    case 'pagar':
    case 'receber':
      return handleTransaction(cmd, messageId)

    case 'ponto':
      return handlePonto(cmd)

    case 'extra':
      return handleExtra(cmd)

    case 'mao_obra':
      return handleMaoObra(cmd.period)

    default:
      return '❓ Comando não reconhecido. Envie *!ajuda* para ver todos os comandos disponíveis.'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function handleFuncionarios(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('name, daily_rate, overtime_rate')
    .eq('active', true)
    .order('name')

  if (error || !data?.length) return '📋 Nenhum funcionário cadastrado.'

  const lines = data.map(
    (e) => `• ${e.name} — Diária: ${formatCurrency(e.daily_rate)} | H.Extra: ${formatCurrency(e.overtime_rate)}/h`
  )
  return `👷 *Funcionários ativos*\n\n${lines.join('\n')}`
}

async function handleSaldo(): Promise<string> {
  const { start, end } = currentMonthRange()

  const { data } = await supabaseAdmin
    .from('transactions')
    .select('type, amount')
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

async function handleRelatorio(period?: string): Promise<string> {
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
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date')

  if (!data?.length) return `📊 Nenhum lançamento encontrado para o período ${formatBrazilian(start)}–${formatBrazilian(end)}.`

  const income = data.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = data.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const expenseLines = data
    .filter((t) => t.type === 'expense')
    .slice(0, 10)
    .map((t) => `  • ${t.description ?? (t.categories as unknown as { name: string })?.name} — ${formatCurrency(t.amount)}`)
    .join('\n')

  const incomeLines = data
    .filter((t) => t.type === 'income')
    .slice(0, 10)
    .map((t) => `  • ${t.description ?? (t.categories as unknown as { name: string })?.name} — ${formatCurrency(t.amount)}`)
    .join('\n')

  return (
    `📋 *Relatório: ${formatBrazilian(start)} a ${formatBrazilian(end)}*\n\n` +
    `💚 *Receitas: ${formatCurrency(income)}*\n${incomeLines || '  (nenhuma)'}\n\n` +
    `🔴 *Despesas: ${formatCurrency(expenses)}*\n${expenseLines || '  (nenhuma)'}\n\n` +
    `Saldo: *${formatCurrency(income - expenses)}*`
  )
}

async function handlePago(id?: number): Promise<string> {
  if (!id) return '❌ Informe o ID do lançamento. Ex: !pago 42'

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('id', id)
    .select('amount, description, type')
    .single()

  if (error || !data) return `❌ Lançamento #${id} não encontrado.`

  return `✅ Lançamento #${id} quitado!\n${data.description} — ${formatCurrency(data.amount)}`
}

async function handleTransaction(cmd: ParsedCommand, messageId: string): Promise<string> {
  if (!cmd.amount || !cmd.categoryKeyword) {
    const example = cmd.command === 'pagar'
      ? '!pagar 350 combustivel abastecimento trator'
      : '!receber 8000 safra venda do milho'
    return `❌ Formato inválido. Exemplo:\n${example}`
  }

  // Find category by keyword
  const { data: cats } = await supabaseAdmin
    .from('categories')
    .select('id, name')
    .ilike('name', `%${cmd.categoryKeyword}%`)
    .limit(1)

  const categoryId = cats?.[0]?.id ?? null
  const categoryName = cats?.[0]?.name ?? cmd.categoryKeyword

  const type = cmd.command === 'pagar' ? 'expense' : 'income'

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .insert({
      type,
      amount: cmd.amount,
      category_id: categoryId,
      description: cmd.description ?? categoryName,
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
    `Categoria: ${categoryName}\n` +
    (cmd.description ? `Descrição: ${cmd.description}\n` : '') +
    `Data: ${formatBrazilian(cmd.date!)}`
  )
}

async function handlePonto(cmd: ParsedCommand): Promise<string> {
  if (!cmd.employeeName) return '❌ Informe o nome do funcionário. Ex: !ponto João'

  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, name, daily_rate')
    .ilike('name', `%${cmd.employeeName}%`)
    .eq('active', true)
    .limit(1)

  const employee = employees?.[0]
  if (!employee) return `❌ Funcionário "${cmd.employeeName}" não encontrado.`

  const { error } = await supabaseAdmin.from('work_records').insert({
    employee_id: employee.id,
    work_date: cmd.date,
    regular_hours: 8,
    overtime_hours: 0,
    daily_rate_snapshot: employee.daily_rate,
    overtime_rate_snapshot: 0,
  })

  if (error) throw error

  return (
    `✅ *Ponto registrado!*\n` +
    `Funcionário: ${employee.name}\n` +
    `Data: ${formatBrazilian(cmd.date!)}\n` +
    `Diária: ${formatCurrency(employee.daily_rate)}`
  )
}

async function handleExtra(cmd: ParsedCommand): Promise<string> {
  if (!cmd.employeeName || !cmd.hours) {
    return '❌ Formato inválido. Ex: !extra João 2'
  }

  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, name, overtime_rate')
    .ilike('name', `%${cmd.employeeName}%`)
    .eq('active', true)
    .limit(1)

  const employee = employees?.[0]
  if (!employee) return `❌ Funcionário "${cmd.employeeName}" não encontrado.`

  // Try to update existing work_record for that date, otherwise insert
  const { data: existing } = await supabaseAdmin
    .from('work_records')
    .select('id, overtime_hours')
    .eq('employee_id', employee.id)
    .eq('work_date', cmd.date)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin
      .from('work_records')
      .update({
        overtime_hours: (existing.overtime_hours ?? 0) + cmd.hours,
        overtime_rate_snapshot: employee.overtime_rate,
      })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin.from('work_records').insert({
      employee_id: employee.id,
      work_date: cmd.date,
      regular_hours: 0,
      overtime_hours: cmd.hours,
      daily_rate_snapshot: 0,
      overtime_rate_snapshot: employee.overtime_rate,
    })
  }

  const totalExtra = cmd.hours * employee.overtime_rate
  return (
    `✅ *Hora extra registrada!*\n` +
    `Funcionário: ${employee.name}\n` +
    `Horas: ${cmd.hours}h × ${formatCurrency(employee.overtime_rate)} = ${formatCurrency(totalExtra)}\n` +
    `Data: ${formatBrazilian(cmd.date!)}`
  )
}

async function handleMaoObra(period?: string): Promise<string> {
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
    .gte('work_date', start)
    .lte('work_date', end)

  if (!data?.length) return `👷 Nenhum registro de trabalho em ${formatBrazilian(start)}–${formatBrazilian(end)}.`

  // Group by employee
  const byEmployee: Record<string, { name: string; days: number; extraCost: number }> = {}
  let total = 0

  for (const r of data) {
    const name = (r.employees as unknown as { name: string })?.name ?? 'Desconhecido'
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
