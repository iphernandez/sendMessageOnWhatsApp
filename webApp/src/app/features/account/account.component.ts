import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-account',
  imports: [FormsModule],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss'
})
export class AccountComponent {
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly busy = signal(false);
  readonly statusMessage = signal('');
  readonly statusIsError = signal(false);
  readonly newRecoveryCode = signal<string | null>(null);

  constructor(readonly auth: AuthService) {}

  async changePassword(): Promise<void> {
    this.busy.set(true);
    const result = await this.auth.changePassword(this.currentPassword(), this.newPassword());
    this.busy.set(false);

    this.statusIsError.set(!result.success);
    this.statusMessage.set(result.success ? 'Contraseña actualizada.' : (result.message ?? 'No se pudo actualizar la contraseña.'));
    if (result.success) {
      this.currentPassword.set('');
      this.newPassword.set('');
    }
  }

  async regenerateRecoveryCode(): Promise<void> {
    this.busy.set(true);
    const code = await this.auth.generateNewRecoveryCode();
    this.busy.set(false);
    this.newRecoveryCode.set(code);
  }
}
