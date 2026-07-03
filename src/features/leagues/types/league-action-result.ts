export type LeaguePaymentIntent = {
  amountLabel: string;
  leagueName: string;
  pixCode: string;
  pixKey: string;
  qrCodeDataUri: string;
  requiresPayment: true;
  transactionId: string;
};

export type LeagueActionResult<T = undefined> =
  | {
      ok: true;
      message: string;
      data?: T;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };
