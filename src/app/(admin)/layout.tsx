import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdmin(); // вторая линия защиты после middleware
  if (!user) redirect("/login");
  return (
    <>
      <Header email={user.email ?? ""} />
      <Sidebar />
      <main className="ml-60 min-h-screen px-6 pb-10 pt-20">{children}</main>
    </>
  );
}
