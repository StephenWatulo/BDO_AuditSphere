import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { AppConfigService } from '../config/app-config.service';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(private readonly config: AppConfigService) {
    const smtp = config.smtp;
    if (smtp.enabled) {
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      });
    }
  }

  get enabled(): boolean {
    return Boolean(this.transporter);
  }

  /** Never throws: mail failures are logged so business operations continue. */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({ from: this.config.smtp.from, ...message });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${message.to}: ${(err as Error).message}`);
      return false;
    }
  }

  async verify(): Promise<boolean> {
    if (!this.transporter) return true;
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
