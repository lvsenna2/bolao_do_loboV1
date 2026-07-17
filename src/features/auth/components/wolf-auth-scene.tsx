import Image from "next/image";

import { cn } from "@/lib/utils";

type WolfAuthSceneProps = {
  className?: string;
};

export function WolfAuthScene({ className }: WolfAuthSceneProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "auth-wolf-scene relative min-h-[320px] overflow-hidden rounded-card border border-brand-gold/25 bg-black shadow-soft",
        className
      )}
    >
      <div className="auth-wolf-stars" />
      <div className="auth-wolf-moon" />
      <div className="auth-wolf-stadium" />
      <div className="auth-official-logo absolute inset-0 z-10 flex items-center justify-center p-7 sm:p-10">
        <Image
          alt="Bolao do Lobo"
          className="h-auto w-full max-w-[280px] rounded-full object-contain"
          height={360}
          priority
          src="/brand/bolao-do-lobo-logo.png"
          width={360}
        />
      </div>
    </div>
  );
}
