import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Loader2, CheckCircle2, Shield } from "lucide-react";

/**
 * AuthScreen — GitHub Device Authorization Grant flow.
 * 
 * 1. Calls StartDeviceFlow() → displays user_code
 * 2. User opens github.com/login/device and enters code
 * 3. Backend polls for token in background
 * 4. On success → navigates to /setup-workspace
 */
export function AuthScreen() {
  const [, setLocation] = useLocation();
  const [userCode, setUserCode] = useState("");
  const [verificationURI, setVerificationURI] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [requestPrivateAccess, setRequestPrivateAccess] = useState(false);
  const [flowStarted, setFlowStarted] = useState(false);

  const startFlow = useCallback(async () => {
    setIsStarting(true);
    setError("");
    setFlowStarted(true);

    try {
      const { StartDeviceFlow } = await import(
        "../../wailsjs/go/github/AuthService"
      );
      // Pass the boolean to Go
      const result = await StartDeviceFlow(requestPrivateAccess);

      setUserCode(result.user_code);
      setVerificationURI(result.verification_uri);
      setIsStarting(false);

      // Start polling
      const { PollForToken } = await import(
        "../../wailsjs/go/github/AuthService"
      );
      PollForToken(result.device_code, result.interval, result.expires_in);
      setIsPolling(true);
    } catch (err: any) {
      setError(err?.message || "Failed to start authentication");
      setIsStarting(false);
    }
  }, [requestPrivateAccess]);

  // Listen for auth completion/error events from Wails
  useEffect(() => {
    let cancelled = false;

    async function setupListeners() {
      try {
        const { EventsOn } = await import("../../wailsjs/runtime/runtime");

        EventsOn("auth:complete", () => {
          if (!cancelled) {
            setIsPolling(false);
            // Brief success state before redirect
            setTimeout(() => {
              if (!cancelled) setLocation("/setup-workspace");
            }, 1000);
          }
        });

        EventsOn("auth:error", (errorMsg: string) => {
          if (!cancelled) {
            setIsPolling(false);
            setError(errorMsg);
          }
        });
      } catch {
        // Wails runtime not available (dev mode)
      }
    }

    setupListeners();
    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for clipboard errors
    }
  }, [userCode]);

  const handleOpenGitHub = useCallback(async () => {
    try {
      const { OpenVerificationURL } = await import(
        "../../wailsjs/go/github/AuthService"
      );
      OpenVerificationURL(verificationURI);
    } catch {
      // Fallback: try window.open
      window.open(verificationURI, "_blank");
    }
  }, [verificationURI]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/50 bg-card/80 shadow-lg">
            <Shield className="h-10 w-10 text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome to 0x-Excali
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your lightweight, local-first desktop experience for Excalidraw diagrams.
          </p>
        </div>

        {/* Error state */}
        {error && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setError("");
                  setFlowStarted(false);
                }}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Initial setup state */}
        {!flowStarted && !error && (
          <Card className="border-border/50 bg-card/50 shadow-xl">
            <CardContent className="p-6 flex flex-col gap-4">
              <Button 
                size="lg" 
                className="w-full text-base font-semibold" 
                onClick={startFlow}
              >
                Sign up / Sign in with GitHub
              </Button>

              <div className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-background/50">
                <div className="flex h-5 items-center mt-0.5">
                  <input
                    id="private-access"
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
                    checked={requestPrivateAccess}
                    onChange={(e) => setRequestPrivateAccess(e.target.checked)}
                  />
                </div>
                <div className="flex flex-col">
                  <label
                    htmlFor="private-access"
                    className="text-sm font-medium leading-none cursor-pointer text-foreground/90"
                  >
                    Request access to private repositories
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isStarting && !error && (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex flex-col items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Connecting to GitHub...
              </p>
            </CardContent>
          </Card>
        )}

        {/* User code display */}
        {userCode && !error && (
          <div className="space-y-4">
            {/* Step 1: Copy code */}
            <Card className="border-border/50 bg-card/50 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    Step 1
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Copy this code
                  </span>
                </div>

                {/* Code display */}
                <button
                  onClick={handleCopyCode}
                  className="group w-full rounded-lg border border-border/50 bg-background/80 p-4 text-center transition-all hover:border-primary/30 hover:bg-background"
                >
                  <code className="text-3xl font-mono font-bold tracking-[0.3em] text-foreground">
                    {userCode}
                  </code>
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    {copied ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Click to copy</span>
                      </>
                    )}
                  </div>
                </button>
              </CardContent>
            </Card>

            {/* Step 2: Open GitHub */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    Step 2
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Enter it on GitHub
                  </span>
                </div>

                <Button
                  onClick={handleOpenGitHub}
                  className="w-full gap-2"
                  size="lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open GitHub Device Activation
                </Button>
              </CardContent>
            </Card>

            {/* Polling indicator */}
            {isPolling && (
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-xs text-muted-foreground">
                  Waiting for authorization...
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
