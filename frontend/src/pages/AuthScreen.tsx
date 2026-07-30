import { Shield } from 'lucide-react';
import { useLocation } from 'wouter';

import { GitHubDeviceFlow } from '@/components/github/github-device-flow';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/lib/routes';

export function AuthScreen() {
  const [, setLocation] = useLocation();

  const handleSkip = async () => {
    try {
      const { EnableLocalMode } = await import('../../wailsjs/go/settings/Service');
      const { SelectLocalWorkspace } = await import('../../wailsjs/go/workspace/Service');
      await EnableLocalMode();
      await SelectLocalWorkspace();
      setLocation(ROUTES.WORKSPACE);
    } catch {
      void 0;
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md animate-fade-in -mt-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/50 bg-card/80 shadow-lg">
            <Shield className="h-10 w-10 text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome to 0x-Excali
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your lightweight, local-first desktop workspace for visual thinking.
          </p>
        </div>

        <Card className="border-border/50 bg-card/50 shadow-xl">
          <CardContent className="flex flex-col gap-4 p-6">
            <GitHubDeviceFlow
              onComplete={() => setLocation(ROUTES.SETUP_WORKSPACE)}
              showPrivateReposOption
            />
            <Button size="lg" variant="outline" className="w-full text-base" onClick={handleSkip}>
              Continue without GitHub
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Use offline mode to keep diagrams on this device. You can connect GitHub later in
              Settings.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
