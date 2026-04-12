const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
  'Email not confirmed': 'メールアドレスが確認されていません。確認メールをご確認ください',
  'User already registered': 'このメールアドレスは既に登録されています',
  'Password should be at least 6 characters': 'パスワードは6文字以上で入力してください',
  'Email rate limit exceeded': 'しばらく時間をおいてから再度お試しください',
  'For security purposes, you can only request this after':
    'セキュリティのため、しばらく時間をおいてから再度お試しください',
  'Unable to validate email address: invalid format': 'メールアドレスの形式が正しくありません',
  'Signup requires a valid password': '有効なパスワードを入力してください',
  'User not found': 'ユーザーが見つかりません',
  'New password should be different from the old password':
    '新しいパスワードは現在のパスワードと異なるものにしてください',
  'Auth session missing!': 'セッションが切れました。もう一度ログインしてください',
};

export function translateAuthError(message: string): string {
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (message.includes(key)) return value;
  }
  return message;
}
