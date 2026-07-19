"use client";

import Link from "next/link";
import { Button } from "@backuphub/ui";
import { useAuthStore } from "@/stores/auth-store";

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="flex items-center justify-between border-b border-border px-8 py-4">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold">BackupHub</span>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/equipos" className="hover:text-foreground">
            Equipos
          </Link>
          <Link href="/planes" className="hover:text-foreground">
            Planes
          </Link>
          <Link href="/historial" className="hover:text-foreground">
            Historial
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-muted-foreground">
            {user.name} · {user.role}
          </span>
        )}
        <Button variant="secondary" size="sm" onClick={() => logout()}>
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}
