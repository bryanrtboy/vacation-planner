"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      setMessage(data?.message ?? "Unable to sign in.");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("next") || "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-md border border-ink/10 bg-white/82 p-6 shadow-soft"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-harbor text-white">
            <LockKeyhole size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Artist Travel Finder</h1>
            <p className="text-sm text-ink/62">Private research workspace</p>
          </div>
        </div>

        <label className="block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none ring-harbor/25 transition focus:ring-4"
          autoComplete="current-password"
          required
        />

        {message ? <p className="mt-3 text-sm text-clay">{message}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-harbor disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
