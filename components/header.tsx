"use client";

import { LogOut, Plane } from "lucide-react";

export function Header() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="border-b border-ink/10 bg-paper/86 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-harbor text-white">
            <Plane size={20} aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold">Artist Travel Finder</p>
            <p className="text-xs text-ink/56">DEN default · United preferred · no booking</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-md border border-ink/12 bg-white px-3 py-2 text-sm font-medium text-ink/72 transition hover:border-ink/22 hover:text-ink"
          title="Sign out"
        >
          <LogOut size={16} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
