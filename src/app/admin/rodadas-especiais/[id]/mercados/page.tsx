import { redirect } from "next/navigation";
import type { Route } from "next";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/rodadas-especiais/${(await params).id}#mercados` as Route);
}
