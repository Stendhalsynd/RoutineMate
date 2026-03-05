"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname } from "next/navigation";
import { clampSidebarOffset, decideSidebarState } from "@/lib/mobile-sidebar-drag";

const tabs = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/records", label: "기록" },
  { href: "/settings", label: "설정" }
];
const MOBILE_SIDEBAR_WIDTH = 280;
const MOBILE_EDGE_TRIGGER = 24;

type DragState = {
  pointerId: number;
  startX: number;
  startOffset: number;
  lastX: number;
  lastTimestamp: number;
  velocityX: number;
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarOffset, setSidebarOffset] = useState(-MOBILE_SIDEBAR_WIDTH);
  const dragStateRef = useRef<DragState | null>(null);
  const sidebarOffsetRef = useRef(-MOBILE_SIDEBAR_WIDTH);

  function resetSidebar(closed: boolean): void {
    setIsDragging(false);
    dragStateRef.current = null;
    setSidebarOffset(closed ? -MOBILE_SIDEBAR_WIDTH : 0);
  }

  function isMobileViewport(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(max-width: 680px)").matches;
  }

  useEffect(() => {
    setIsOpen(false);
    resetSidebar(true);
  }, [pathname]);

  useEffect(() => {
    sidebarOffsetRef.current = sidebarOffset;
  }, [sidebarOffset]);

  useEffect(() => {
    if (!isDragging) {
      setSidebarOffset(isOpen ? 0 : -MOBILE_SIDEBAR_WIDTH);
    }
  }, [isDragging, isOpen]);

  function closeMenu(): void {
    setIsOpen(false);
    resetSidebar(true);
  }

  function openMenu(): void {
    setIsOpen(true);
    resetSidebar(false);
  }

  function beginDrag(pointerId: number, startX: number, startOffset: number): void {
    const now = performance.now();
    dragStateRef.current = {
      pointerId,
      startX,
      startOffset,
      lastX: startX,
      lastTimestamp: now,
      velocityX: 0
    };
    setIsDragging(true);
    setSidebarOffset(startOffset);
  }

  function handleDragMove(event: ReactPointerEvent<HTMLElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    const delta = event.clientX - dragState.startX;
    const nextOffset = clampSidebarOffset(dragState.startOffset + delta, MOBILE_SIDEBAR_WIDTH);
    setSidebarOffset(nextOffset);

    const now = performance.now();
    const elapsed = Math.max(1, now - dragState.lastTimestamp);
    dragState.velocityX = (event.clientX - dragState.lastX) / elapsed;
    dragState.lastX = event.clientX;
    dragState.lastTimestamp = now;
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    const state = decideSidebarState(sidebarOffsetRef.current, dragState.velocityX, MOBILE_SIDEBAR_WIDTH);
    if (state === "open") {
      setIsOpen(true);
      resetSidebar(false);
      return;
    }
    closeMenu();
  }

  function handleEdgePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (isOpen || !isMobileViewport() || event.clientX > MOBILE_EDGE_TRIGGER) {
      return;
    }
    setIsOpen(true);
    beginDrag(event.pointerId, event.clientX, -MOBILE_SIDEBAR_WIDTH);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSidebarPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    if (!isOpen || !isMobileViewport()) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const withinDragHandle = event.clientX - rect.left >= rect.width - 40;
    if (!withinDragHandle) {
      return;
    }
    beginDrag(event.pointerId, event.clientX, 0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  const openProgress = useMemo(() => 1 - Math.abs(sidebarOffset) / MOBILE_SIDEBAR_WIDTH, [sidebarOffset]);
  const sidebarStyle = useMemo(
    () => ({
      transform: `translateX(${sidebarOffset}px)`
    }),
    [sidebarOffset]
  );
  const overlayStyle = useMemo(
    () => ({
      opacity: Number.isFinite(openProgress) ? Math.max(0, Math.min(1, openProgress)) : 0
    }),
    [openProgress]
  );

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
            onClick={() => {
              if (isOpen) {
                closeMenu();
                return;
              }
              openMenu();
            }}
            aria-label={isOpen ? "모바일 메뉴 닫기" : "모바일 메뉴 열기"}
            aria-expanded={isOpen}
          >
            {isOpen ? "메뉴 닫기" : "메뉴"}
          </button>
        </div>
      </header>

      <div className="mobile-edge-swipe-zone" onPointerDown={handleEdgePointerDown} aria-hidden />
      <div
        className={`mobile-nav-overlay ${isOpen ? "is-open" : ""}`}
        onClick={closeMenu}
        style={overlayStyle}
        aria-hidden={!isOpen}
      />
      <nav
        className={`mobile-sidebar ${isOpen ? "is-open" : ""} ${isDragging ? "is-dragging" : ""}`}
        aria-label="모바일 메뉴"
        aria-hidden={!isOpen}
        style={sidebarStyle}
        onPointerDown={handleSidebarPointerDown}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
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
        <div className="mobile-sidebar-drag-hint" aria-hidden>
          드래그하여 닫기
        </div>
      </nav>
    </>
  );
}
