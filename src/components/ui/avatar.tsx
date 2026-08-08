import { UserRound } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";

type AvatarProps = {
  alt?: string;
  className?: string;
  name?: string | null;
  priority?: boolean;
  src?: string | null;
  userId?: string | null;
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

export function Avatar({
  alt = "",
  className,
  name,
  priority = false,
  src,
  userId
}: AvatarProps) {
  const initials = getInitials(name);
  const optimizedSrc = userId && src?.startsWith("data:image/") ? `/api/avatar/${userId}` : null;

  return (
    <span
      className={cn(
        "relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-app-elevated text-sm font-bold text-app-foreground",
        className
      )}
    >
      {optimizedSrc ? (
        <Image
          alt={alt || name || ""}
          className="object-cover"
          fill
          priority={priority}
          quality={75}
          sizes="(max-width: 640px) 64px, 80px"
          src={optimizedSrc}
        />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={alt || name || ""}
          className="h-full w-full object-cover"
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          height={80}
          loading={priority ? "eager" : "lazy"}
          src={src}
          width={80}
        />
      ) : initials ? (
        initials
      ) : (
        <UserRound aria-hidden className="h-5 w-5 text-app-muted" />
      )}
    </span>
  );
}
