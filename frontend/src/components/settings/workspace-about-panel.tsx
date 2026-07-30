import { ExternalLink, Info } from 'lucide-react';

import {
  WorkspacePanelLayout,
  WorkspacePanelSection,
} from '@/components/layout/workspace-panel-layout';
import {
  formatReleaseDate,
  parseReleaseNotes,
  useGitHubReleases,
} from '@/hooks/use-github-releases';
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL } from '@/lib/github-project';

function ReleaseNotesList({ body }: { body: string }) {
  const { heading, items } = parseReleaseNotes(body);

  if (items.length === 0) {
    return <p className="text-sm leading-relaxed text-muted-foreground">No release notes.</p>;
  }

  return (
    <div className="space-y-3">
      {heading && <p className="text-sm font-medium text-foreground">{heading}</p>}
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function WorkspaceAboutPanel() {
  const { releases, loading, error } = useGitHubReleases();

  return (
    <WorkspacePanelLayout
      title="About"
      description="Learn more about 0x-excali and this installation."
    >
      <WorkspacePanelSection
        title="0x-excali"
        description="A local-first visual workspace for diagrams and ideas."
        icon={<Info className="h-4 w-4 text-muted-foreground" />}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
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
      </WorkspacePanelSection>

      <WorkspacePanelSection
        title="Release notes"
        description="Recent updates from GitHub."
        className="border-t border-border/40 pt-8"
      >
        <div className="flex justify-end">
          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View all releases
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading release notes...</p>}
        {error && <p className="text-sm text-muted-foreground">{error}</p>}

        {!loading && !error && (
          <div className="space-y-6">
            {releases.map((release) => (
              <article key={release.tag_name} className="space-y-3">
                <div className="space-y-1">
                  <a
                    href={release.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
                  >
                    {release.name || release.tag_name}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatReleaseDate(release.published_at)}
                  </p>
                </div>
                <ReleaseNotesList body={release.body} />
              </article>
            ))}
          </div>
        )}
      </WorkspacePanelSection>
    </WorkspacePanelLayout>
  );
}
