export type Result<T, E> = { success: true; value: T } | { success: false; error: E };

export function ok<T, E>(value: T): Result<T, E> {
  return { success: true, value };
}

export function err<T, E>(error: E): Result<T, E> {
  return { success: false, error };
}
