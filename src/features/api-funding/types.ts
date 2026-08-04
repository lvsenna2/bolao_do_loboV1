export type ApiFundingPaymentView = {
  amountLabel: string;
  expiresAtLabel?: string;
  paymentId: string;
  pixCode: string;
  qrCodeDataUri: string;
  ticketUrl?: string | null;
  transactionId: string;
};

export type ApiFundingActionResult<T = undefined> = {
  data?: T;
  message: string;
  ok: boolean;
};
