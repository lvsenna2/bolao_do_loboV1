import { getUnreadNotificationCount } from "@/features/user/data/user-data";

type UnreadNotificationBadgeProps = {
  userId: string;
};

export async function UnreadNotificationBadge({ userId }: UnreadNotificationBadgeProps) {
  const count = await getUnreadNotificationCount(userId);

  if (count <= 0) {
    return null;
  }

  return (
    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold leading-5 text-slate-950">
      {count > 99 ? "99+" : count}
    </span>
  );
}
