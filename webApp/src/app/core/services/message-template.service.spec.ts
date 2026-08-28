import { MessageTemplateService } from './message-template.service';

describe('MessageTemplateService', () => {
  const service = new MessageTemplateService();

  it('replaces all occurrences of {{key}} placeholders', () => {
    const template = 'Futbol {{DATE}} {{TIME}} -- Fecha {{WEEK_NUMBER}}';
    const result = service.render(template, { DATE: '03/26/2026', TIME: '7:00 PM', WEEK_NUMBER: 13 });
    expect(result).toBe('Futbol 03/26/2026 7:00 PM -- Fecha 13');
  });

  it('leaves unknown placeholders untouched', () => {
    const result = service.render('{{KNOWN}} {{UNKNOWN}}', { KNOWN: 'ok' });
    expect(result).toBe('ok {{UNKNOWN}}');
  });
});
