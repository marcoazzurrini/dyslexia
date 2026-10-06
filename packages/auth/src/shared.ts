export const BASE_PATH = "/api/auth";

/** The `error` query value after a rejected sign-in. */
export const ACCOUNT_NOT_ALLOWED = "account_not_allowed";

export interface User {
  readonly email: string;
  readonly name: string;
  /** Profile picture URL, if the account has one. */
  readonly image: string | null;
}
