import { Injectable } from '@angular/core';

/**
 * Fills {{key}} placeholders in convocatoria.md/convocados.md-style templates.
 * Mirrors the variable-replacement pattern used by the repo's other WhatsApp bot variants,
 * but supports the double-brace syntax actually used in convocatoria.md.
 */
@Injectable({ providedIn: 'root' })
export class MessageTemplateService {
  render(template: string, vars: Record<string, string | number>): string {
    return Object.entries(vars).reduce(
      (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
      template
    );
  }
}
