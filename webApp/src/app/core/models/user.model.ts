/**
 * Profile document stored in Firestore `users/{uid}`, keyed by the Firebase Authentication uid.
 * Credentials (password) live only in Firebase Authentication, never in this document/collection.
 */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}
