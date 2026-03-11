"use client";

import { usePathname } from "next/navigation";
import AppShell from "./AppShell";

const NO_SHELL_PATHS = ["/login"];

export default function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noShell = !!pathname && NO_SHELL_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (noShell) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
