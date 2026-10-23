// Brazilian mobile numbers exist in two forms on WhatsApp: with the ninth digit (55 DDD 9XXXXXXXX, 13 digits)
// and without it (55 DDD XXXXXXXX, 12 digits). Meta's webhook may report either for the same person, while the
// app stores the 13-digit form the user types. Compare through all equivalent forms, never on the raw string.
export function brazilPhoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, '')
  const forms = new Set([digits])

  if (digits.startsWith('55')) {
    if (digits.length === 13 && digits[4] === '9') {
      forms.add(digits.slice(0, 4) + digits.slice(5))
    } else if (digits.length === 12 && /[6-9]/.test(digits[4])) {
      // 8-digit local numbers starting with 2–5 are landlines and have no mobile form
      forms.add(`${digits.slice(0, 4)}9${digits.slice(4)}`)
    }
  }

  return [...forms]
}
