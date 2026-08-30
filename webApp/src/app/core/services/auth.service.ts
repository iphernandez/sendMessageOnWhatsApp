import { Injectable, signal } from '@angular/core';
import { DataStoreService } from './data-store.service';
import { PublicUser, UserRecord } from '../models/user.model';

const PBKDF2_ITERATIONS = 150_000;
const CURRENT_USER_KEY = 'currentUserId';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1, avoids ambiguous characters
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Seed account requested by the repo owner; password must be changed on first login.
const SEED_ADMIN_EMAIL = 'i.patricio.hernandez@gmail.com';
const SEED_ADMIN_NAME = 'Pato "Presi" Hernandez';
const SEED_ADMIN_TEMP_PASSWORD = 'Ffch2026-Presi!';

export interface AuthResult {
  success: boolean;
  message?: string;
}

export interface RegisterResult extends AuthResult {
  recoveryCode?: string;
}

export interface ResetPasswordResult extends AuthResult {
  tempPassword?: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Derives a salted PBKDF2-SHA256 hash for a password or recovery code. Never stores the plain secret. */
async function derive(secret: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, [
    'deriveBits'
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

/** Avoids short-circuit comparison of secret hashes. */
function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomCode(length: number, groupSize: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (groupSize > 0 && i % groupSize === groupSize - 1 && i !== length - 1) code += '-';
  }
  return code;
}

function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, recoveryCodeHash: _rch, recoveryCodeSalt: _rcs, ...publicUser } = user;
  return publicUser;
}

/**
 * Client-side auth: accounts live in this browser's IndexedDB only (no backend/email server),
 * so they are not synced to GitHub like the rest of the app data. Passwords/recovery codes are
 * salted+hashed with PBKDF2 and never stored or logged in plain text.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<PublicUser | null>(null);
  readonly ready = signal(false);
  private readonly initPromise: Promise<void>;

  constructor(private readonly store: DataStoreService) {
    this.initPromise = this.init();
  }

  whenReady(): Promise<void> {
    return this.initPromise;
  }

  private async init(): Promise<void> {
    await this.seedAdminIfNeeded();
    await this.restoreSession();
    this.ready.set(true);
  }

  private async seedAdminIfNeeded(): Promise<void> {
    const count = await this.store.users.count();
    if (count > 0) return;

    const { hash, salt } = await derive(SEED_ADMIN_TEMP_PASSWORD);
    const admin: UserRecord = {
      id: crypto.randomUUID(),
      email: SEED_ADMIN_EMAIL.toLowerCase(),
      name: SEED_ADMIN_NAME,
      passwordHash: hash,
      passwordSalt: salt,
      recoveryCodeHash: null,
      recoveryCodeSalt: null,
      isAdmin: true,
      mustChangePassword: true,
      createdAt: new Date().toISOString()
    };
    await this.store.users.add(admin);
  }

  private async restoreSession(): Promise<void> {
    const userId = await this.store.getSetting(CURRENT_USER_KEY);
    if (!userId) return;
    const user = await this.store.users.get(userId);
    if (user) this.currentUser.set(toPublicUser(user));
  }

  async register(email: string, name: string, password: string): Promise<RegisterResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return { success: false, message: 'Ingresa un correo electrónico válido.' };
    }
    if (!name.trim()) {
      return { success: false, message: 'Ingresa tu nombre.' };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { success: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` };
    }

    const existing = await this.store.users.where('email').equals(normalizedEmail).first();
    if (existing) {
      return { success: false, message: 'Ya existe una cuenta con ese correo.' };
    }

    const { hash, salt } = await derive(password);
    const recoveryCode = randomCode(12, 4);
    const recovery = await derive(recoveryCode);
    const user: UserRecord = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name: name.trim(),
      passwordHash: hash,
      passwordSalt: salt,
      recoveryCodeHash: recovery.hash,
      recoveryCodeSalt: recovery.salt,
      isAdmin: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString()
    };
    await this.store.users.add(user);
    return { success: true, recoveryCode };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.store.users.where('email').equals(normalizedEmail).first();
    if (!user) return { success: false, message: 'Correo o contraseña incorrectos.' };

    const { hash } = await derive(password, user.passwordSalt);
    if (!secureEqual(hash, user.passwordHash)) {
      return { success: false, message: 'Correo o contraseña incorrectos.' };
    }

    await this.store.setSetting(CURRENT_USER_KEY, user.id);
    this.currentUser.set(toPublicUser(user));
    return { success: true };
  }

  logout(): void {
    void this.store.clearSetting(CURRENT_USER_KEY);
    this.currentUser.set(null);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    const current = this.currentUser();
    if (!current) return { success: false, message: 'Debes iniciar sesión.' };
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { success: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` };
    }

    const user = await this.store.users.get(current.id);
    if (!user) return { success: false, message: 'Usuario no encontrado.' };

    const { hash } = await derive(currentPassword, user.passwordSalt);
    if (!secureEqual(hash, user.passwordHash)) {
      return { success: false, message: 'La contraseña actual no es correcta.' };
    }

    const next = await derive(newPassword);
    await this.store.users.update(user.id, {
      passwordHash: next.hash,
      passwordSalt: next.salt,
      mustChangePassword: false
    });
    this.currentUser.set({ ...current, mustChangePassword: false });
    return { success: true };
  }

  /** Regenerates the logged-in user's recovery code. The plain code is returned once and never stored. */
  async generateNewRecoveryCode(): Promise<string | null> {
    const current = this.currentUser();
    if (!current) return null;

    const recoveryCode = randomCode(12, 4);
    const { hash, salt } = await derive(recoveryCode);
    await this.store.users.update(current.id, { recoveryCodeHash: hash, recoveryCodeSalt: salt });
    return recoveryCode;
  }

  async resetPasswordWithRecoveryCode(email: string, recoveryCode: string, newPassword: string): Promise<AuthResult> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { success: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.store.users.where('email').equals(normalizedEmail).first();
    if (!user?.recoveryCodeHash || !user.recoveryCodeSalt) {
      return { success: false, message: 'Correo o código de recuperación incorrectos.' };
    }

    const { hash } = await derive(recoveryCode.trim().toUpperCase(), user.recoveryCodeSalt);
    if (!secureEqual(hash, user.recoveryCodeHash)) {
      return { success: false, message: 'Correo o código de recuperación incorrectos.' };
    }

    const next = await derive(newPassword);
    await this.store.users.update(user.id, {
      passwordHash: next.hash,
      passwordSalt: next.salt,
      mustChangePassword: false
    });
    return { success: true };
  }

  async listUsers(): Promise<PublicUser[]> {
    const users = await this.store.users.toArray();
    return users.map(toPublicUser).sort((a, b) => a.email.localeCompare(b.email));
  }

  /** Only an existing administrator can promote/demote accounts; the last remaining admin cannot be demoted. */
  async setAdmin(userId: string, isAdmin: boolean): Promise<AuthResult> {
    const requester = this.currentUser();
    if (!requester?.isAdmin) return { success: false, message: 'Solo un administrador puede hacer esto.' };

    const users = await this.store.users.toArray();
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Usuario no encontrado.' };

    if (!isAdmin) {
      const otherAdmins = users.filter((u) => u.isAdmin && u.id !== userId);
      if (otherAdmins.length === 0) {
        return { success: false, message: 'Debe existir al menos un administrador.' };
      }
    }

    await this.store.users.update(userId, { isAdmin });
    if (requester.id === userId) {
      this.currentUser.set({ ...requester, isAdmin });
    }
    return { success: true };
  }

  async deleteUser(userId: string): Promise<AuthResult> {
    const requester = this.currentUser();
    if (!requester?.isAdmin) return { success: false, message: 'Solo un administrador puede hacer esto.' };
    if (requester.id === userId) return { success: false, message: 'No puedes eliminar tu propia cuenta.' };

    const users = await this.store.users.toArray();
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Usuario no encontrado.' };

    if (target.isAdmin) {
      const otherAdmins = users.filter((u) => u.isAdmin && u.id !== userId);
      if (otherAdmins.length === 0) {
        return { success: false, message: 'Debe existir al menos un administrador.' };
      }
    }

    await this.store.users.delete(userId);
    return { success: true };
  }

  /** Admin-assisted reset for a user who lost both their password and recovery code. Returns the plain temp password once. */
  async adminResetPassword(userId: string): Promise<ResetPasswordResult> {
    const requester = this.currentUser();
    if (!requester?.isAdmin) return { success: false, message: 'Solo un administrador puede hacer esto.' };

    const user = await this.store.users.get(userId);
    if (!user) return { success: false, message: 'Usuario no encontrado.' };

    const tempPassword = randomCode(10, 0);
    const { hash, salt } = await derive(tempPassword);
    await this.store.users.update(userId, { passwordHash: hash, passwordSalt: salt, mustChangePassword: true });
    return { success: true, tempPassword };
  }
}
