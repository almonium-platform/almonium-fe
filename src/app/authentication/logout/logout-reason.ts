/** `?reason=` on the logout route. Deletion goes to the landing page; a plain sign-out goes to the sign-in form. */
export const LOGOUT_REASON_ACCOUNT_DELETED = 'account-deleted';

/** `?deleted=1` on the landing page, set by the logout route once a deleted account has been torn down. */
export const LANDING_ACCOUNT_DELETED_PARAM = 'deleted';
