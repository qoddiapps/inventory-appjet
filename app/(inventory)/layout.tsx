import { Sidebar } from "@/components/Sidebar";
import { requirePageSession } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</main>
    </div>
  );
}
