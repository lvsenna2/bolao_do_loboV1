"use client";

type AdminDeleteButtonProps = {
  confirmMessage: string;
  label?: string;
};

export function AdminDeleteButton({
  confirmMessage,
  label = "Excluir"
}: AdminDeleteButtonProps) {
  return (
    <button
      className="h-10 rounded-button bg-brand-red px-3 text-sm font-semibold text-white transition hover:bg-red-700"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {label}
    </button>
  );
}
