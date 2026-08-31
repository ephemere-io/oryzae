type Translator = (key: string) => string;

const ERROR_KEY_MAP: Record<string, string> = {
  'Invalid login credentials': 'invalid_credentials',
  'Email not confirmed': 'email_not_confirmed',
  'User already registered': 'user_already_registered',
  'Password should be at least 6 characters': 'password_too_short',
  'Email rate limit exceeded': 'rate_limit',
  'For security purposes, you can only request this after': 'security_wait',
  'Unable to validate email address: invalid format': 'invalid_email_format',
  'Signup requires a valid password': 'invalid_password',
  'User not found': 'user_not_found',
  'New password should be different from the old password': 'same_password_new',
  'Auth session missing!': 'session_missing',
  'A user with this email address has already been registered': 'user_already_registered_2',
  'Email address not confirmed': 'email_not_confirmed_2',
  'Same password': 'same_password',
  capacity_reached: 'capacity_reached',
};

export function translateAuthError(message: string, t: Translator): string {
  for (const [supabaseKey, i18nKey] of Object.entries(ERROR_KEY_MAP)) {
    if (message.includes(supabaseKey)) return t(i18nKey);
  }
  return message;
}
