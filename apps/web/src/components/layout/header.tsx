"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "../../lib/auth-client";
import { cn } from "../../lib/utils";

function AuthControls() {
  const { data: session, isPending } = authClient.useSession();
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  if (isPending) return null;

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {session.user.email}
        </span>
        <button
          onClick={() => authClient.signOut()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!showAuth) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setIsSignUp(false);
            setShowAuth(true);
          }}
          className="rounded-md border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Sign In
        </button>
        <button
          onClick={() => {
            setIsSignUp(true);
            setShowAuth(true);
          }}
          className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
        >
          Register
        </button>
      </div>
    );
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isSignUp) {
      const result = await authClient.signUp.email({
        email,
        password,
        name: name || email.split("@")[0]!,
      });
      if (result.error) setError(result.error.message ?? "Sign up failed");
    } else {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) setError(result.error.message ?? "Sign in failed");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowAuth(false)}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
      <form
        onSubmit={handleAuth}
        className="absolute right-0 top-10 z-50 w-72 rounded-lg border border-border bg-background p-4 shadow-lg flex flex-col gap-2"
      >
        {isSignUp && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={8}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
        >
          {isSignUp ? "Sign Up" : "Sign In"}
        </button>
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {isSignUp ? "Have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </form>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-background">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-brand text-xs font-bold text-white">
            O
          </div>
          <h1 className="font-bold text-foreground">Orys</h1>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Auctions
          </Link>
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2">
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
