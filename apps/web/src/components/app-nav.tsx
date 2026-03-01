"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/records", label: "기록" },
  { href: "/settings", label: "설정" }
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="top-nav-wrap">
        <div className="top-nav-inner">
          <Link href="/dashboard" className="brand-link">
            RoutineMate
          </Link>
          <nav className="top-nav" aria-label="메인">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={isActive(pathname, tab.href) ? "top-nav-link is-active" : "top-nav-link"}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav className="bottom-nav" aria-label="모바일">
        {tabs.map((tab) => (
          <Link
            key={`m-${tab.href}`}
            href={tab.href}
            className={isActive(pathname, tab.href) ? "bottom-nav-link is-active" : "bottom-nav-link"}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
