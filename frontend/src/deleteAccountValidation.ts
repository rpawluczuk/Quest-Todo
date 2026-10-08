export function loginConfirmationError(login: string, confirmation: string): string {
  if (!confirmation) return 'Wpisz swój login.'
  return confirmation === login ? '' : 'Wpisany login nie jest zgodny z loginem konta.'
}

export function currentPasswordError(password: string): string {
  if (!password) return 'Podaj obecne hasło.'
  return new TextEncoder().encode(password).length <= 72
    ? ''
    : 'Hasło jest za długie. Wpisz poprawne obecne hasło.'
}

export function canDeleteAccount(login: string, confirmation: string, password: string, accepted: boolean): boolean {
  return login.length > 0
    && !loginConfirmationError(login, confirmation)
    && !currentPasswordError(password)
    && accepted
}
