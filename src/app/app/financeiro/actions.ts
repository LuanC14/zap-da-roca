'use server'

import { revalidatePath } from 'next/cache'
import { requireTenant } from '@/lib/tenant'
import { deleteTransaction, loadCategories, recordTransaction, settleTransaction } from '@/lib/ledger'
import { isReasonableDate } from '@/lib/parsers/date-parser'
import { parseAmount } from '@/lib/parsers/text'

export type ActionResult = { error?: string; ok?: true }

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireTenant()

  const type = String(formData.get('type') ?? '')
  if (type !== 'expense' && type !== 'income') return { error: 'Escolha despesa ou receita.' }

  const amount = parseAmount(String(formData.get('amount') ?? ''))
  if (amount === null) return { error: 'Valor inválido. Exemplo: 350 ou 1.500,50.' }

  const date = String(formData.get('date') ?? '')
  if (!isReasonableDate(date)) return { error: 'Data inválida.' }

  const categoryId = String(formData.get('category_id') ?? '')
  let category = null
  if (categoryId) {
    category = (await loadCategories(supabase, user.id)).find((c) => c.id === categoryId) ?? null
    if (!category || (category.type !== type && category.type !== 'both')) {
      return { error: 'Categoria inválida para este tipo de lançamento.' }
    }
  }

  const description = String(formData.get('description') ?? '').trim().replace(/\s+/g, ' ')
  if (description.length > 120) return { error: 'Descrição muito longa (máximo 120 caracteres).' }

  try {
    await recordTransaction(supabase, user.id, {
      type,
      amount,
      category,
      description: description || category?.name || (type === 'expense' ? 'Despesa' : 'Receita'),
      date,
      paid: formData.get('paid') === 'on',
    })
  } catch (err) {
    console.error('createTransaction failed:', err)
    return { error: 'Não foi possível salvar o lançamento. Tente novamente.' }
  }

  revalidatePath('/app', 'layout')
  return { ok: true }
}

export async function settleTransactionAction(id: number): Promise<ActionResult> {
  const { supabase, user } = await requireTenant()
  if (!Number.isSafeInteger(id) || id <= 0) return { error: 'Lançamento inválido.' }

  try {
    const result = await settleTransaction(supabase, user.id, id)
    if (result.status === 'not_found') return { error: 'Lançamento não encontrado.' }
  } catch (err) {
    console.error('settleTransaction failed:', err)
    return { error: 'Não foi possível quitar. Tente novamente.' }
  }

  revalidatePath('/app', 'layout')
  return { ok: true }
}

export async function deleteTransactionAction(id: number): Promise<ActionResult> {
  const { supabase, user } = await requireTenant()
  if (!Number.isSafeInteger(id) || id <= 0) return { error: 'Lançamento inválido.' }

  try {
    if (!(await deleteTransaction(supabase, user.id, id))) return { error: 'Lançamento não encontrado.' }
  } catch (err) {
    console.error('deleteTransaction failed:', err)
    return { error: 'Não foi possível excluir. Tente novamente.' }
  }

  revalidatePath('/app', 'layout')
  return { ok: true }
}
