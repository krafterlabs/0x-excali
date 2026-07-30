import { useCallback, useEffect, useRef, useState } from 'react';

import { CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TIMING } from '@/lib/timing';

interface GitHubDeviceFlowProps {
  onComplete: () => void;
  onCancel?: () => void;
  showPrivateReposOption?: boolean;
  embedded?: boolean;
}

export function GitHubDeviceFlow({
  onComplete,
  onCancel,
  showPrivateReposOption = true,
  embedded = false,
}: GitHubDeviceFlowProps) {
  const [userCode, setUserCode] = useState('');
  const [verificationURI, setVerificationURI] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [requestPrivateAccess, setRequestPrivateAccess] = useState(false);
  const [flowStarted, setFlowStarted] = useState(false);
  const flowActiveRef = useRef(false);

  const stopFlow = useCallback(async () => {
    flowActiveRef.current = false;
    setIsPolling(false);
    try {
      const { CancelDeviceFlow } = await import('../../../wailsjs/go/github/AuthService');
      await CancelDeviceFlow();
    } catch {
      void 0;
    }
  }, []);

  const startFlow = useCallback(async () => {
    setIsStarting(true);
    setError('');
    setFlowStarted(true);
    flowActiveRef.current = true;

    try {
      const { StartDeviceFlow, PollForToken } = await import('../../../wailsjs/go/github/AuthService');
      const result = await StartDeviceFlow(requestPrivateAccess);

      if (!flowActiveRef.current) return;

      setUserCode(result.user_code);
      setVerificationURI(result.verification_uri);
      setIsStarting(false);

      PollForToken(result.device_code, result.interval, result.expires_in);
      setIsPolling(true);
    } catch (err) {
      if (!flowActiveRef.current) return;
      setError(
        err instanceof Error ? err.message : 'GitHub authorization failed. Please try again.'
      );
      setIsStarting(false);
    }
  }, [requestPrivateAccess]);

  useEffect(() => {
    let removeComplete: (() => void) | undefined;
    let removeError: (() => void) | undefined;

    async function setupListeners() {
      try {
        const { EventsOn } = await import('../../../wailsjs/runtime/runtime');

        removeComplete = EventsOn('auth:complete', () => {
          if (!flowActiveRef.current) return;
          setIsPolling(false);
          setTimeout(() => {
            if (flowActiveRef.current) onComplete();
          }, TIMING.AUTH_COMPLETE_REDIRECT_MS);
        });

        removeError = EventsOn('auth:error', (errorMsg: string) => {
          if (!flowActiveRef.current) return;
          setIsPolling(false);
          setError(errorMsg);
        });
      } catch {
        void 0;
      }
    }

    void setupListeners();
    return () => {
      removeComplete?.();
      removeError?.();
    };
  }, [onComplete]);

  useEffect(() => {
    return () => {
      void stopFlow();
    };
  }, [stopFlow]);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), TIMING.CLIPBOARD_FEEDBACK_MS);
    } catch {
      void 0;
    }
  }, [userCode]);

  const handleOpenGitHub = useCallback(async () => {
    try {
      const { OpenVerificationURL } = await import('../../../wailsjs/go/github/AuthService');
      OpenVerificationURL(verificationURI);
    } catch {
      window.open(verificationURI, '_blank');
    }
  }, [verificationURI]);

  const handleCancel = useCallback(async () => {
    await stopFlow();
    setFlowStarted(false);
    setUserCode('');
    setVerificationURI('');
    setIsStarting(false);
    setError('');
    onCancel?.();
  }, [onCancel, stopFlow]);

  const resetFlow = useCallback(async () => {
    await stopFlow();
    setError('');
    setFlowStarted(false);
    setUserCode('');
    setVerificationURI('');
    setIsStarting(false);
  }, [stopFlow]);

  const shellClass = embedded ? 'space-y-4' : 'space-y-4';

  if (!flowStarted && !error) {
    return (
      <div className={shellClass}>
        {showPrivateReposOption && (
          <div className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
            <div className="mt-0.5 flex h-5 items-center">
              <input
                id="github-private-access"
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
                checked={requestPrivateAccess}
                onChange={(e) => setRequestPrivateAccess(e.target.checked)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="github-private-access"
                className="cursor-pointer text-sm font-medium leading-none"
              >
                Include private repositories
              </label>
              <p className="text-xs text-muted-foreground">
                You can enable this later if you only need public repos for now.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={startFlow} className="gap-2">
            Continue with GitHub
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isStarting && !error) {
    return (
      <div className={embedded ? 'py-6 text-center' : ''}>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Connecting to GitHub...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetFlow}>
              Try again
            </Button>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Step 1
            </Badge>
            <span className="text-sm text-muted-foreground">Copy this code</span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="group w-full rounded-lg border border-border/50 bg-background/80 p-3 text-center transition-all hover:border-primary/30"
          >
            <code className="text-2xl font-mono font-bold tracking-[0.25em]">{userCode}</code>
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

      <Card className="border-border/50 bg-card/50">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Step 2
            </Badge>
            <span className="text-sm text-muted-foreground">Enter it on GitHub</span>
          </div>
          <Button onClick={handleOpenGitHub} className="w-full gap-2">
            <ExternalLink className="h-4 w-4" />
            Open GitHub Device Activation
          </Button>
        </CardContent>
      </Card>

      {isPolling && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Waiting for authorization...</span>
        </div>
      )}

      {onCancel && (
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}
