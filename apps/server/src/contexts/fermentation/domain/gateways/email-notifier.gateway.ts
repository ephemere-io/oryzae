export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText: string;
}

export interface EmailNotifier {
  send(params: SendEmailParams): Promise<void>;
}
