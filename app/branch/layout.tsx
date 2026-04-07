import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function BranchLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userRole = (session?.user as { role?: string })?.role

  const allowedRoles = ["ADMIN", "SENIOR_MANAGER", "SITE_MANAGER"]
  if (!session || !allowedRoles.includes(userRole || "")) {
    redirect("/")
  }

  return <>{children}</>
}
