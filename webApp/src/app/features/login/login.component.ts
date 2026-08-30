import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

type Mode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  readonly mode = signal<Mode>('login');
  readonly busy = signal(false);
  readonly statusMessage = signal('');
  readonly statusIsError = signal(false);
  readonly registeredRecoveryCode = signal<string | null>(null);

  readonly email = signal('');
  readonly name = signal('');
  readonly password = signal('');
  readonly recoveryCode = signal('');
  readonly newPassword = signal('');

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.statusMessage.set('');
    this.statusIsError.set(false);
    this.registeredRecoveryCode.set(null);
  }

  async login(): Promise<void> {
    this.busy.set(true);
    const result = await this.auth.login(this.email(), this.password());
    this.busy.set(false);

    if (!result.success) {
      this.statusIsError.set(true);
      this.statusMessage.set(result.message ?? 'No se pudo iniciar sesión.');
      return;
    }
    void this.router.navigateByUrl('/');
  }

  async register(): Promise<void> {
    this.busy.set(true);
    const result = await this.auth.register(this.email(), this.name(), this.password());
    this.busy.set(false);

    if (!result.success) {
      this.statusIsError.set(true);
      this.statusMessage.set(result.message ?? 'No se pudo crear la cuenta.');
      return;
    }

    this.statusIsError.set(false);
    this.registeredRecoveryCode.set(result.recoveryCode ?? null);
    this.statusMessage.set('Cuenta creada. Guarda tu código de recuperación: no volverá a mostrarse.');
    this.password.set('');
  }

  async resetPassword(): Promise<void> {
    this.busy.set(true);
    const result = await this.auth.resetPasswordWithRecoveryCode(this.email(), this.recoveryCode(), this.newPassword());
    this.busy.set(false);

    this.statusIsError.set(!result.success);
    this.statusMessage.set(
      result.success ? 'Contraseña actualizada. Ya puedes iniciar sesión.' : (result.message ?? 'No se pudo restablecer la contraseña.')
    );
    if (result.success) {
      this.password.set('');
      this.newPassword.set('');
      this.recoveryCode.set('');
      this.setMode('login');
    }
  }
}
