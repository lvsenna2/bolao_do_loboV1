import crypto from "node:crypto";

export function createSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
