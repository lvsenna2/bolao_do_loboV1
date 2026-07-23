import { MessageCircle, Phone } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/5521964696114?text=Ola%2C%20preciso%20de%20ajuda%20no%20Bolao%20do%20Lobo.";

export function WhatsappContactButton() {
  return (
    <a
      aria-label="Falar com o Bolao do Lobo pelo WhatsApp"
      className="group fixed bottom-24 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#25D366] text-white shadow-[0_12px_32px_rgba(0,0,0,0.38)] transition hover:scale-105 hover:bg-[#20bd5a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:bottom-6 lg:right-6"
      href={WHATSAPP_URL}
      rel="noreferrer"
      target="_blank"
      title="Falar no WhatsApp"
    >
      <MessageCircle aria-hidden className="h-8 w-8" strokeWidth={2.3} />
      <Phone
        aria-hidden
        className="absolute h-4 w-4 -rotate-12 transition group-hover:rotate-0"
        fill="currentColor"
        strokeWidth={2.6}
      />
      <span className="sr-only">Falar no WhatsApp</span>
    </a>
  );
}
