import { ExternalLink, Info } from 'lucide-react';

import { WorkspacePanelLayout } from '@/components/layout/workspace-panel-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatReleaseDate,
  formatReleaseSummary,
  useGitHubReleases,
} from '@/hooks/use-github-releases';
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL } from '@/lib/github-project';

export function WorkspaceAboutPanel() {
  const { releases, loading, error } = useGitHubReleases();

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
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
          >
            krafterlabs/0x-excali
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">Release notes</h2>
          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View all
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading release notes...</p>}
        {error && <p className="text-sm text-muted-foreground">{error}</p>}

        {!loading &&
          !error &&
          releases.map((release) => (
            <Card key={release.tag_name} className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  <a
                    href={release.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    {release.name || release.tag_name}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                </CardTitle>
                <CardDescription>{formatReleaseDate(release.published_at)}</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">
                  {formatReleaseSummary(release.body)}
                </pre>
              </CardContent>
            </Card>
          ))}
      </section>
    </WorkspacePanelLayout>
  );
}
