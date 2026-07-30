import { github } from '../../wailsjs/go/models';

export type GitHubRepository = github.Repository;

export interface AuthUser {
  username: string;
  avatar_url: string;
  email: string;
}

export interface RepoPendingStatus {
  repo_id: number;
  has_pending: boolean;
  dirty_count: number;
  pending_syncs: number;
}
