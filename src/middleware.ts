import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

import { getPublicPromoSlug } from "@/lib/public-promo-path";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

export default withAuth(
  function middleware(request) {
    const promoSlug = getPublicPromoSlug(request.nextUrl.pathname);

    if (promoSlug) {
      const destination = request.nextUrl.clone();
      destination.pathname = `/promocoes/${promoSlug}`;
      return NextResponse.rewrite(destination);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        if (getPublicPromoSlug(req.nextUrl.pathname)) {
          return true;
        }

        if (!token) {
          return false;
        }

        if (req.nextUrl.pathname.startsWith("/admin")) {
          return adminRoles.has(String(token.role));
        }

        return true;
      }
    }
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/apoie-a-api/:path*",
    "/comparar-palpites/:path*",
    "/dashboard/:path*",
    "/ligas/:path*",
    "/minhas-ligas/:path*",
    "/palpites/:path*",
    "/planos/:path*",
    "/rodadas/:path*",
    "/rodadas-especiais/:path*"
  ]
};
