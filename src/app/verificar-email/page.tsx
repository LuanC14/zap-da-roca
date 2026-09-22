import { OtpForm } from './otp-form'

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <OtpForm email={email ?? ''} />
}
