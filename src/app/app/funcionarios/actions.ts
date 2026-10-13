'use server'

import { revalidatePath } from 'next/cache'
import { requireTenant } from '@/lib/tenant'
import { matchKey, parseRate } from '@/lib/parsers/text'

export type ActionResult = { error?: string; ok?: true }

function readEmployeeForm(formData: FormData):
  | { name: string; daily_rate: number; overtime_rate: number }
  | { error: string } {
  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) return { error: 'Informe o nome (2 a 80 caracteres).' }

  const daily_rate = parseRate(String(formData.get('daily_rate') ?? ''))
  if (daily_rate === null) return { error: 'Diária inválida. Exemplo: 120 ou 120,50.' }

  const overtime_rate = parseRate(String(formData.get('overtime_rate') ?? ''), true)
  if (overtime_rate === null) return { error: 'Hora extra inválida. Exemplo: 15 ou 15,50 (use 0 se não houver).' }

  return { name, daily_rate, overtime_rate }
}

// The bot finds people by name, so two active people with the same name would make !ponto ambiguous
async function nameTaken(
  supabase: Awaited<ReturnType<typeof requireTenant>>['supabase'],
  userId: string,
  name: string,
  exceptId?: string
): Promise<boolean> {
  const { data } = await supabase.from('employees').select('id, name').eq('user_id', userId).eq('active', true)
  return (data ?? []).some((e) => e.id !== exceptId && matchKey(e.name) === matchKey(name))
}

export async function createEmployee(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireTenant()

  const parsed = readEmployeeForm(formData)
  if ('error' in parsed) return parsed
  if (await nameTaken(supabase, user.id, parsed.name)) return { error: 'Já existe um funcionário ativo com esse nome.' }

  const { error } = await supabase.from('employees').insert({ user_id: user.id, ...parsed })
  if (error) return { error: 'Não foi possível cadastrar. Tente novamente.' }

  revalidatePath('/app/funcionarios')
  return { ok: true }
}

export async function updateEmployee(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireTenant()

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Funcionário não informado.' }

  const parsed = readEmployeeForm(formData)
  if ('error' in parsed) return parsed
  if (await nameTaken(supabase, user.id, parsed.name, id)) return { error: 'Já existe um funcionário ativo com esse nome.' }

  // Past work records keep the rates snapshotted at the time; only future entries use the new ones
  const { data, error } = await supabase
    .from('employees')
    .update(parsed)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) return { error: 'Não foi possível salvar. Tente novamente.' }
  if (!data?.length) return { error: 'Funcionário não encontrado.' }

  revalidatePath('/app/funcionarios')
  return { ok: true }
}

// Deactivate instead of delete: deleting would cascade away the work history and its costs
export async function setEmployeeActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase, user } = await requireTenant()

  if (active) {
    const { data: target } = await supabase.from('employees').select('name').eq('id', id).eq('user_id', user.id).maybeSingle()
    if (!target) return { error: 'Funcionário não encontrado.' }
    if (await nameTaken(supabase, user.id, target.name, id)) {
      return { error: 'Já existe outro funcionário ativo com esse nome. Renomeie um deles antes.' }
    }
  }

  const { data, error } = await supabase
    .from('employees')
    .update({ active })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) return { error: 'Não foi possível atualizar. Tente novamente.' }
  if (!data?.length) return { error: 'Funcionário não encontrado.' }

  revalidatePath('/app/funcionarios')
  return { ok: true }
}
