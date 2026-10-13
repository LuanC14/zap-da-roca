#!/usr/bin/env node
// Tenant-isolation check against a REAL Supabase project (local stack or production).
// Creates two throw-away confirmed users, tries the attacks the RLS migration closes, then deletes them.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/rls-check.mjs
// (or put those three in a gitignored .env.deploy). Sends no e-mail; leaves no data behind.

import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from './lib/env.mjs'

loadEnvFile()

const need = (k) => {
  const v = process.env[k]
  if (!v) {
    console.error(`Missing ${k}`)
    process.exit(2)
  }
  return v
}
const SB_URL = need('SUPABASE_URL')
const ANON = need('SUPABASE_ANON_KEY')
const SERVICE = need('SUPABASE_SERVICE_ROLE_KEY')

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(SB_URL, SERVICE, opts)

const stamp = Date.now()
const password = randomBytes(18).toString('base64url')
const created = []
const results = []

const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : detail ? `\n      ${detail}` : ''}`)
}
const denied = (error) => !!error && (error.code === '42501' || /permission denied|row-level security/i.test(error.message))

async function makeTenant(label) {
  const email = `rls-check-${stamp}-${label}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS Check ${label.toUpperCase()}` },
  })
  if (error) throw new Error(`createUser ${label}: ${error.message}`)
  created.push(data.user.id)
  const client = createClient(SB_URL, ANON, opts)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signIn ${label}: ${signInError.message}`)
  return { id: data.user.id, client }
}

try {
  console.log(`RLS check → ${SB_URL}\n`)
  const a = await makeTenant('a')
  const b = await makeTenant('b')

  // Billing columns are server-only (free-subscription exploit)
  for (const [label, patch] of [
    ['subscription_status', { subscription_status: 'active' }],
    ['trial_ends_at', { trial_ends_at: '2099-01-01T00:00:00Z' }],
    ['current_period_end', { current_period_end: '2099-01-01T00:00:00Z' }],
    ['is_admin', { is_admin: true }],
  ]) {
    const { error } = await a.client.from('profiles').update(patch).eq('id', a.id)
    check(`user cannot edit own ${label}`, denied(error), error ? error.message : 'update was accepted')
  }
  const { data: profileNow } = await admin.from('profiles').select('subscription_status, is_admin').eq('id', a.id).single()
  check('profile billing data is unchanged afterwards', profileNow?.subscription_status === 'trial' && profileNow?.is_admin === false)

  const { data: renamed, error: renameError } = await a.client.from('profiles').update({ full_name: 'Novo Nome' }).eq('id', a.id).select('id')
  check('user can still edit own name', !renameError && renamed?.length === 1, renameError?.message)

  const { data: seen } = await a.client.from('profiles').select('id')
  check('user sees only own profile', seen?.length === 1 && seen[0].id === a.id)

  // WhatsApp linking must go through the OTP flow
  const phone = `55119${String(stamp).slice(-8)}`
  const { error: phoneError } = await a.client.from('registered_phones').insert({ user_id: a.id, whatsapp_number: phone, verified: true })
  check('user cannot link a verified phone directly (OTP bypass)', denied(phoneError), phoneError ? phoneError.message : 'insert was accepted')

  // Tenant data isolation
  const { error: txError } = await a.client.from('transactions').insert({ user_id: a.id, type: 'expense', amount: 1, transaction_date: '2026-01-01', description: 'rls-check' })
  check('user can write own transaction', !txError, txError?.message)

  const { data: bTx } = await b.client.from('transactions').select('id')
  check('other tenant cannot read it', (bTx ?? []).length === 0)

  const { data: touched } = await b.client.from('transactions').update({ paid: true }).eq('user_id', a.id).select('id')
  check('other tenant cannot update it', (touched ?? []).length === 0)

  const { error: forgedError } = await a.client.from('transactions').insert({ user_id: b.id, type: 'expense', amount: 1, transaction_date: '2026-01-01' })
  check('user cannot write rows for another tenant', denied(forgedError), forgedError ? forgedError.message : 'insert was accepted')

  // Server-only tables
  for (const table of ['phone_verifications', 'payment_events', 'whatsapp_messages']) {
    const { data, error } = await a.client.from(table).select('*')
    check(`${table} is invisible to users`, denied(error) || (data ?? []).length === 0)
  }

  const { data: cats } = await a.client.from('categories').select('name').is('user_id', null)
  check('default categories exist', (cats ?? []).length >= 5, `found ${(cats ?? []).length}`)

  // Not signed in
  const anon = createClient(SB_URL, ANON, opts)
  const { data: anonProfiles } = await anon.from('profiles').select('id')
  const { data: anonTx } = await anon.from('transactions').select('id')
  check('anonymous visitors see no tenant data', (anonProfiles ?? []).length === 0 && (anonTx ?? []).length === 0)
} catch (err) {
  console.error(`\nAborted: ${err.message}`)
  results.push(false)
} finally {
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) console.error(`WARNING: could not delete test user ${id}: ${error.message}`)
  }
}

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exitCode = failed ? 1 : 0
