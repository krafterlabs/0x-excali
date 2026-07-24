import { useEffect, useState } from "react";
import { useLocation } from "wouter";

/**
 * LoadingScreen — Boot splash displayed while the app initializes.
 * Pings the Go backend for auth status and auto-routes to the
 * appropriate screen.
 */
export function LoadingScreen() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        setStatus("Connecting to backend...");

        // Dynamic import of Wails bindings (generated at build time)
        const { GetAuthStatus } = await import(
          "../../wailsjs/go/github/AuthService"
        );
        const result = await GetAuthStatus();

        if (cancelled) return;

        if (result.authenticated) {
          setStatus("Welcome back, " + result.username);
          // Check if workspace is configured
          const { GetActiveWorkspace } = await import(
            "../../wailsjs/go/workspace/Service"
          );
          const workspace = await GetActiveWorkspace();

          if (cancelled) return;

          if (workspace) {
            // Short delay for the welcome animation
            setTimeout(() => !cancelled && setLocation("/workspace"), 800);
          } else {
            setTimeout(
              () => !cancelled && setLocation("/setup-workspace"),
              800
            );
          }
        } else {
          setStatus("Authentication required");
          setTimeout(() => !cancelled && setLocation("/auth"), 600);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("Starting up...");
          // In dev mode or if Wails bindings aren't available yet, retry
          setTimeout(() => checkAuth(), 1000);
        }
      }
    }

    // Small initial delay for the animation to start
    const timer = setTimeout(checkAuth, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setLocation]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background">
      {/* Animated logo */}
      <div className="relative mb-8">
        {/* Outer glow ring */}
        <div className="absolute inset-0 animate-pulse-slow rounded-2xl bg-gradient-to-r from-violet-500/20 via-transparent to-cyan-500/20 blur-xl" />

        {/* Logo mark */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-xl">
          <img src="/logo.png" alt="0x" className="h-full w-full object-cover" />
        </div>
      </div>

      {/* App name */}
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-foreground">
        0x-excali
      </h1>
      <p className="text-sm text-muted-foreground">{status}</p>

      {/* Loading bar */}
      <div className="mt-6 h-0.5 w-48 overflow-hidden rounded-full bg-border/30">
        <div className="h-full animate-loading-bar rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" />
      </div>
    </div>
  );
}
