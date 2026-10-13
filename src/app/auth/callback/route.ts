import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/redirects'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/entrar?erro=link', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/entrar?erro=link', origin))
  }

  // `next` lets the password-reset e-mail land on /redefinir-senha; default is the dashboard
  return NextResponse.redirect(new URL(safeNext(searchParams.get('next')), origin))
}
