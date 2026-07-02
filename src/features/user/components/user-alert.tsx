import { AlertTriangle } from "lucide-react";

type UserAlertProps = {
  message?: string;
};

export function UserAlert({ message }: UserAlertProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="mb-5 flex items-start gap-3 rounded-card border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-200">
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
