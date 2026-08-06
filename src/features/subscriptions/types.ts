export type SubscriptionPixView = {
  amountLabel: string;
  expiresAtLabel?: string;
  paymentId: string;
  pixCode: string;
  qrCodeDataUri: string;
  ticketUrl?: string | null;
  transactionId: string;
};

export type SubscriptionCheckoutResult = {
  checkoutUrl?: string;
  payment?: SubscriptionPixView;
  subscriptionId: string;
};

export type SubscriptionActionResult<T = undefined> = {
  data?: T;
  message: string;
  ok: boolean;
};
