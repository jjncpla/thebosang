/**
 * 비밀번호 정책
 * - 최소 8자 이상
 * - 영문자(a-z, A-Z)와 숫자(0-9)를 각각 1자 이상 포함
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  description: "8자 이상, 영문과 숫자를 각각 1자 이상 포함",
} as const;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validatePassword(password: unknown): PasswordValidationResult {
  if (typeof password !== "string") {
    return { ok: false, error: "비밀번호가 문자열이 아닙니다." };
  }
  if (password.length < PASSWORD_POLICY.minLength) {
    return { ok: false, error: `비밀번호는 ${PASSWORD_POLICY.minLength}자 이상이어야 합니다.` };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLetter || !hasDigit) {
    return { ok: false, error: "비밀번호는 영문과 숫자를 각각 1자 이상 포함해야 합니다." };
  }
  // 공백 금지
  if (/\s/.test(password)) {
    return { ok: false, error: "비밀번호에 공백은 사용할 수 없습니다." };
  }
  return { ok: true };
}
