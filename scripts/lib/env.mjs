import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Loads KEY=VALUE lines from a gitignored env file into process.env (never overrides real env vars)
export function loadEnvFile(name = '.env.deploy') {
  const path = join(process.cwd(), name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    const value = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}
