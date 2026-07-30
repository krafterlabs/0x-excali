import { ROUTES } from '@/lib/routes';

import type { database } from '../../wailsjs/go/models';

interface WorkspaceService {
  GetActiveWorkspace: () => Promise<database.Workspace | null>;
  SelectLocalWorkspace: () => Promise<void>;
}

export type WorkspaceBootstrapResult =
  | { kind: 'ready'; workspace: database.Workspace }
  | { kind: 'redirect'; route: string };

export async function bootstrapWorkspace(
  localOnly: boolean,
  service: WorkspaceService
): Promise<WorkspaceBootstrapResult> {
  let workspace = await service.GetActiveWorkspace();
  if (workspace) {
    return { kind: 'ready', workspace };
  }

  if (!localOnly) {
    return { kind: 'redirect', route: ROUTES.SETUP_WORKSPACE };
  }

  await service.SelectLocalWorkspace();
  workspace = await service.GetActiveWorkspace();

  if (!workspace) {
    return { kind: 'redirect', route: ROUTES.AUTH };
  }

  return { kind: 'ready', workspace };
}
