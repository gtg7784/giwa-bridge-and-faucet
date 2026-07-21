"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplet } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Faucet" },
  { href: "/bridge", label: "Bridge" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-heading text-sm font-medium tracking-tight"
        >
          <Droplet className="size-4" />
          Giwa Faucet
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
