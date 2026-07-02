"use client";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

export function applyServerFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors?: Record<string, string[]>
) {
  Object.entries(fieldErrors ?? {}).forEach(([field, messages]) => {
    const message = messages[0];

    if (message) {
      setError(field as Path<T>, {
        type: "server",
        message
      });
    }
  });
}
