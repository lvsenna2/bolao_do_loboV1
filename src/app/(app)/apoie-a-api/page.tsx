import type { Route } from "next";
import { redirect } from "next/navigation";

export default function LegacyApiFundingPage() {
  redirect("/planos" as Route);
}
