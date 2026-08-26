import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

import { isMaintenanceActive } from "@/lib/maintenance";
import { getPublicPromoSlug } from "@/lib/public-promo-path";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);
const protectedPaths = [
  "/admin",
  "/apoie-a-api",
  "/comparar-palpites",
  "/dashboard",
  "/ligas",
  "/minhas-ligas",
  "/palpites",
  "/planos",
  "/rodadas",
  "/rodadas-especiais"
];

function isProtectedPath(pathname: string) {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default withAuth(
  function middleware(request) {
    if (isMaintenanceActive()) {
      if (request.nextUrl.pathname === "/manutencao") return NextResponse.next();

      const destination = request.nextUrl.clone();
      destination.pathname = "/manutencao";
      const response = NextResponse.rewrite(destination);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    if (request.nextUrl.pathname === "/manutencao") {
      const destination = request.nextUrl.clone();
      destination.pathname = "/";
      return NextResponse.redirect(destination);
    }

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
        if (isMaintenanceActive()) {
          return true;
        }

        if (getPublicPromoSlug(req.nextUrl.pathname)) {
          return true;
        }

        if (!isProtectedPath(req.nextUrl.pathname)) {
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
  matcher: ["/((?!api|_next/static|_next/image|brand|favicon.ico|.*\\..*).*)"]
};
