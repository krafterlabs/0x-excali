import { Info } from 'lucide-react';

import { WorkspacePanelLayout } from '@/components/layout/workspace-panel-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppVersion } from '@/hooks/use-app-version';

export function WorkspaceAboutPanel() {
  const version = useAppVersion();

  return (
    <WorkspacePanelLayout
      title="About"
      description="Learn more about 0x-excali and this installation."
    >
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            0x-excali
          </CardTitle>
          <CardDescription>A local-first visual workspace for diagrams and ideas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Organize drawings on your device, optionally sync them to GitHub repositories, and work
            offline whenever you need to.
          </p>
          <p>
            <span className="font-medium text-foreground">Version:</span>{' '}
            <span className="font-mono">{version}</span>
          </p>
        </CardContent>
      </Card>
    </WorkspacePanelLayout>
  );
}
