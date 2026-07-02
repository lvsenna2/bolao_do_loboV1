import { withAuth } from "next-auth/middleware";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

export default withAuth({
  callbacks: {
    authorized({ req, token }) {
      if (!token) {
        return false;
      }

      if (req.nextUrl.pathname.startsWith("/admin")) {
        return adminRoles.has(String(token.role));
      }

      return true;
    }
  }
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/minhas-ligas/:path*",
    "/palpites/:path*",
    "/rodadas/:path*"
  ]
};
