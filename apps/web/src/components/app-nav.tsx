"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  function closeMenu(): void {
    setIsOpen(false);
  }

  return (
    <>
      <header className="top-nav-wrap">
        <div className="top-nav-inner">
          <Link href="/dashboard" className="brand-link" onClick={closeMenu}>
            RoutineMate
          </Link>
          <nav className="top-nav" aria-label="메인">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={isActive(pathname, tab.href) ? "top-nav-link is-active" : "top-nav-link"}
                onClick={closeMenu}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className="mobile-nav-button"
            onClick={() => setIsOpen((value) => !value)}
            aria-label={isOpen ? "모바일 메뉴 닫기" : "모바일 메뉴 열기"}
            aria-expanded={isOpen}
          >
            {isOpen ? "메뉴 닫기" : "메뉴"}
          </button>
        </div>
      </header>

      <div className={`mobile-nav-overlay ${isOpen ? "is-open" : ""}`} onClick={closeMenu} aria-hidden={!isOpen} />
      <nav className={`mobile-sidebar ${isOpen ? "is-open" : ""}`} aria-label="모바일 메뉴" aria-hidden={!isOpen}>
        {tabs.map((tab) => (
          <Link
            key={`m-${tab.href}`}
            href={tab.href}
            className={isActive(pathname, tab.href) ? "mobile-sidebar-link is-active" : "mobile-sidebar-link"}
            onClick={closeMenu}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
