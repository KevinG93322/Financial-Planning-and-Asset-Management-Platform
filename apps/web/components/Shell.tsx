"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const links = [
  { href: "/household", label: "Household" },
  { href: "/plan", label: "Plan" },
  { href: "/vault", label: "Vault" },
];

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="brand">
          Financial Platform
          <span>Planning and asset records</span>
        </Link>
        <p className="lede">
          Household figures stay in PostgreSQL. The chain stores consent, content hashes, and demo vault shares.
        </p>
        {user ? (
          <nav className="nav">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : undefined}>
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {user ? (
          <>
            <button className="sign-out" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
            <p className="address">{loading ? "Checking session" : shortAddress(user.address)}</p>
          </>
        ) : (
          <p className="address">{loading ? "Checking session" : "Local demo · chain 31337"}</p>
        )}
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
