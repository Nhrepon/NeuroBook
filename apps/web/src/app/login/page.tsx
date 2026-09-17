"use client";

/**
 * Login page. No middleware on this route — it is the entry gate.
 *
 * After a successful login it sets the refresh token cookie and redirects
 * to /dashboard. No client-side session storage; the cookie handles replay.
 */
import { useState } from "react";
import { loginAction } from "../actions";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await loginAction({ email, password });
    setPending(false);
    if (result.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: "1rem",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "0.875rem",
          width: "100%",
          maxWidth: "20rem",
          border: "1px solid CanvasText",
          padding: "1.5rem",
        }}
      >
        <strong style={{ fontSize: "1.25rem" }}>NeuroBook</strong>
        <p style={{ margin: 0, opacity: 0.6, fontSize: "0.875rem" }}>
          Sign in to continue
        </p>

        {error && (
          <p role="alert" style={{ color: "red", fontSize: "0.875rem", margin: 0 }}>
            {error}
          </p>
        )}

        <label style={{ display: "grid", gap: "0.25rem" }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
