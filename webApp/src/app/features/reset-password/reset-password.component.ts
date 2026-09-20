import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent {
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly email = signal<string | null>(null);
  readonly newPassword = signal('');
  readonly statusMessage = signal('');
  readonly statusIsError = signal(false);
  readonly done = signal(false);

  private oobCode = '';

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    void this.init();
  }

  private async init(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    this.oobCode = params.get('oobCode') ?? '';
    if (!this.oobCode) {
      this.statusIsError.set(true);
      this.statusMessage.set('Enlace de restablecimiento inválido.');
      this.loading.set(false);
      return;
    }

    const result = await this.auth.verifyResetCode(this.oobCode);
    if (!result) {
      this.statusIsError.set(true);
      this.statusMessage.set('El enlace ya no es válido. Solicita uno nuevo desde Iniciar sesión.');
    } else {
      this.email.set(result.email);
    }
    this.loading.set(false);
  }

  async confirm(): Promise<void> {
    this.busy.set(true);
    const result = await this.auth.confirmPasswordReset(this.oobCode, this.newPassword());
    this.busy.set(false);

    this.statusIsError.set(!result.success);
    this.statusMessage.set(result.success ? 'Contraseña actualizada. Ya puedes iniciar sesión.' : (result.message ?? 'No se pudo restablecer la contraseña.'));
    if (result.success) {
      this.done.set(true);
      setTimeout(() => void this.router.navigateByUrl('/login'), 2000);
    }
  }
}
