/**
 * Strips formatting characters (spaces, dashes, brackets, dots) from a phone string,
 * then validates it is a UK number.
 *
 * Accepted formats (after stripping):
 *   0[1-9]xxxxxxxxx  — 11-digit UK local (mobile 07xxx, landline 01xxx/02x/03xxx, freephone 0800 etc.)
 *   +44[1-9]xxxxxxxxx — E.164 international equivalent
 *
 * Returns the stripped, normalised value on success, or throws a descriptive error.
 */
export function sanitisePhone(raw: string | undefined | null): string | null {
  if (!raw || !raw.trim()) return null; // optional field — empty is fine

  const stripped = raw.replace(/[\s\-().]/g, '');

  if (/^(0[1-9]\d{9}|\+44[1-9]\d{9})$/.test(stripped)) {
    return stripped;
  }

  throw new Error('Please enter a valid UK phone number (e.g. 07911 123456 or +44 7911 123456)');
}
