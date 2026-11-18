import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getAdmin } from "@/lib/session";
import { getBusiness } from "@/lib/tenant";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getAdmin()) redirect("/admin");
  const [accounts, business] = await Promise.all([prisma.account.count(), getBusiness()]);
  return <LoginForm mode={accounts === 0 ? "setup" : "login"} business={business.name} next={next ?? ""} />;
}
