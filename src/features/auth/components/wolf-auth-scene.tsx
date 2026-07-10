import { PawPrint } from "lucide-react";

import { cn } from "@/lib/utils";

type WolfAuthSceneProps = {
  className?: string;
};

export function WolfAuthScene({ className }: WolfAuthSceneProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "auth-wolf-scene relative min-h-[320px] overflow-hidden rounded-card border border-white/15 bg-[#07144d] shadow-soft",
        className
      )}
    >
      <div className="auth-wolf-stars" />
      <div className="auth-wolf-moon" />
      <div className="auth-wolf-stadium" />

      <svg
        className="auth-wolf-mountains absolute inset-x-0 bottom-0 h-40 w-full"
        fill="none"
        viewBox="0 0 620 190"
      >
        <path d="M0 118 82 54l58 44 82-80 90 92 72-58 76 66 58-38 102 84v26H0Z" fill="#081033" />
        <path d="M0 144 90 92l70 44 104-74 98 82 88-50 72 38 98-56v114H0Z" fill="#0b1c64" />
      </svg>

      <svg
        className="auth-wolf-main absolute bottom-16 left-1/2 h-56 w-56 -translate-x-1/2"
        viewBox="0 0 220 220"
      >
        <path
          d="m38 70 34-44 16 40h44l16-40 34 44-10 54 22 32-36 5-20 30-28-18-28 18-20-30-36-5 22-32Z"
          fill="#0b173f"
        />
        <path
          d="m58 78 26-36 11 38h30l11-38 26 36-14 62 16 17-27 2-27 22-27-22-27-2 16-17Z"
          fill="#dbeafe"
        />
        <path d="m71 83 18 28-16 24 31-15V78Z" fill="#1e3a8a" />
        <path d="m149 83-18 28 16 24-31-15V78Z" fill="#1e40af" />
        <path d="m84 132 26-16 26 16-12 26h-28Z" fill="#eff6ff" />
        <path d="m98 129 12 10 12-10-6 18h-12Z" fill="#0f172a" />
        <path d="M92 99h-22l12 11 14-2Z" fill="#f59e0b" />
        <path d="M128 99h22l-12 11-14-2Z" fill="#f59e0b" />
        <path d="m78 56 9 25H65Z" fill="#111827" opacity="0.7" />
        <path d="m142 56-9 25h22Z" fill="#111827" opacity="0.7" />
        <path d="M70 159h80" stroke="#0f172a" strokeLinecap="round" strokeWidth="5" />
      </svg>

      <svg className="auth-wolf-silhouette auth-wolf-silhouette-one" viewBox="0 0 170 82">
        <path
          d="M6 54c22-24 42-31 63-24l18-22 12 25c20 2 38 10 60 25-35 4-51 4-78 0-24 8-44 8-75-4Z"
          fill="currentColor"
        />
      </svg>
      <svg className="auth-wolf-silhouette auth-wolf-silhouette-two" viewBox="0 0 170 82">
        <path
          d="M7 56c19-23 43-32 68-23L88 9l14 25c23 3 39 11 61 26-33 3-49 2-76-2-28 9-50 8-80-2Z"
          fill="currentColor"
        />
      </svg>
      <svg className="auth-wolf-silhouette auth-wolf-silhouette-three" viewBox="0 0 170 82">
        <path
          d="M8 55c24-26 46-31 68-22L88 8l15 26c20 3 37 12 58 25-29 5-48 5-77-1-27 9-49 8-76-3Z"
          fill="currentColor"
        />
      </svg>

      <div className="auth-wolf-paws">
        {Array.from({ length: 5 }).map((_, index) => (
          <PawPrint className="auth-wolf-paw" key={index} />
        ))}
      </div>
    </div>
  );
}
