export type ElectionActionResult<T = undefined> = {
  data?: T;
  fieldErrors?: Record<string, string[]>;
  message: string;
  ok: boolean;
};

export type ElectionPaymentView = {
  amountLabel: string;
  expiresAtLabel?: string;
  paymentId: string;
  pixCode: string;
  qrCodeDataUri: string;
  ticketUrl?: string | null;
  transactionId: string;
};
