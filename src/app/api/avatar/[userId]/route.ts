import { prisma } from "@/server/db";

export const runtime = "nodejs";

const avatarDataUrlPattern = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/;

type AvatarRouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(_request: Request, context: AvatarRouteContext) {
  const { userId } = await context.params;

  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) {
    return new Response(null, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    select: {
      avatarUrl: true
    },
    where: {
      deletedAt: null,
      id: userId
    }
  });
  const match = user?.avatarUrl?.match(avatarDataUrlPattern);

  if (!match) {
    return new Response(null, { status: 404 });
  }

  const subtype = match[1].toLowerCase();
  const image = Buffer.from(match[2], "base64");

  return new Response(image, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=3600",
      "Content-Type": subtype === "jpg" ? "image/jpeg" : `image/${subtype}`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
