/** Persisted user account. Password/recovery secrets are never stored or transmitted in plain text. */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  recoveryCodeHash: string | null;
  recoveryCodeSalt: string | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

/** Safe-to-display projection of a UserRecord, with all secret material stripped out. */
export type PublicUser = Omit<
  UserRecord,
  'passwordHash' | 'passwordSalt' | 'recoveryCodeHash' | 'recoveryCodeSalt'
>;
