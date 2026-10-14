import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from '../../../config/env.config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Outgoing email. No provider is wired yet: in development the message is printed to the log so the
 * password-reset flow can be tried end to end; in production it logs an error (and sends nothing)
 * until an SMTP or API provider is plugged in here. Callers must not depend on delivery succeeding.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService<EnvVars, true>) {}

  async send(message: MailMessage): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      this.logger.error(`Mail provider not configured; dropped "${message.subject}"`);
      return;
    }
    this.logger.log(`[dev mail] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}
