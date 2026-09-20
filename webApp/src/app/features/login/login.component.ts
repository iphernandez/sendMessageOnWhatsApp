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

  readonly email = signal('');
  readonly name = signal('');
  readonly password = signal('');

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.statusMessage.set('');
    this.statusIsError.set(false);
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
    this.statusMessage.set('Cuenta creada. Ya puedes iniciar sesión.');
    this.password.set('');
    this.setMode('login');
  }

  async forgotPassword(): Promise<void> {
    this.busy.set(true);
    const result = await this.auth.sendForgotPasswordEmail(this.email());
    this.busy.set(false);

    this.statusIsError.set(!result.success);
    this.statusMessage.set(
      result.success
        ? 'Si el correo existe, se envió un enlace para restablecer la contraseña.'
        : (result.message ?? 'No se pudo enviar el correo de restablecimiento.')
    );
  }
}
