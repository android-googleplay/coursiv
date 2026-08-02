export function shouldSendTicketEmail(input: {
  debug: boolean;
  firebaseConfigured: boolean;
  internal: boolean;
  apiKey?: string;
  fromEmail?: string;
  recipientEmail?: string | null;
}) {
  return Boolean(
    !input.debug
    && input.firebaseConfigured
    && !input.internal
    && input.apiKey
    && input.fromEmail
    && input.recipientEmail,
  );
}
