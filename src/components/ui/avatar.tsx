import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

type AvatarProps = {
  alt?: string;
  className?: string;
  name?: string | null;
  src?: string | null;
};

function getInitials(name?: string | null) {
  if (!name) {
    return "";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Avatar({ alt = "", className, name, src }: AvatarProps) {
  const initials = getInitials(name);

  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-app-elevated text-sm font-bold text-app-foreground",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt || name || ""} className="h-full w-full object-cover" src={src} />
      ) : initials ? (
        initials
      ) : (
        <UserRound aria-hidden className="h-5 w-5 text-app-muted" />
      )}
    </span>
  );
}
