import { CheckEmailCard } from './check-email-card'

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <CheckEmailCard email={email ?? ''} />
}
