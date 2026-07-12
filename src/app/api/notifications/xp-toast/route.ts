import { NextResponse } from "next/server";

import { serverNow } from "@/lib/date-time";
import { getCurrentSession } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function GET() {
  const session = await getCurrentSession();

  if (!session?.user) {
    return NextResponse.json({ notification: null }, { status: 401 });
  }

  const createdAfter = new Date(serverNow().getTime() - 10 * 60 * 1000);

  const notification = await prisma.notification.findFirst({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      createdAt: true,
      icon: true,
      id: true,
      levelAfter: true,
      message: true,
      title: true,
      uniqueKey: true,
      xpReceived: true
    },
    where: {
      createdAt: {
        gte: createdAfter
      },
      isRead: false,
      type: "XP",
      userId: session.user.id
    }
  });

  return NextResponse.json({
    notification: notification
      ? {
          ...notification,
          createdAt: notification.createdAt.toISOString()
        }
      : null
  });
}
