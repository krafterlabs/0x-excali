export const ROUTES = {
  HOME: '/',
  LOADING: '/loading',
  AUTH: '/auth',
  SETUP_WORKSPACE: '/setup-workspace',
  WORKSPACE: '/workspace',
  WORKSPACE_SETTINGS: '/workspace/settings',
  WORKSPACE_ABOUT: '/workspace/about',
} as const;

/** @deprecated Use ROUTES.WORKSPACE_SETTINGS */
export const LEGACY_SETTINGS_PATH = '/settings';

export const QUERY_PARAMS = {
  LINK: 'link',
} as const;

export const QUERY_VALUES = {
  LINK_ENABLED: '1',
} as const;

export function settingsLinkGitHubPath(): string {
  return ROUTES.WORKSPACE_SETTINGS;
}

export function workspaceFilePath(filePath: string): string {
  return `${ROUTES.WORKSPACE}/${encodeURIComponent(filePath)}`;
}

const WORKSPACE_ROUTE_PREFIX = `${ROUTES.WORKSPACE}/`;

const RESERVED_WORKSPACE_SEGMENTS = new Set(['settings', 'about']);

export function workspaceFilePathFromLocation(location: string): string {
  if (!location.startsWith(WORKSPACE_ROUTE_PREFIX)) {
    return '';
  }
  const segment = decodeURIComponent(location.slice(WORKSPACE_ROUTE_PREFIX.length));
  if (!segment || RESERVED_WORKSPACE_SEGMENTS.has(segment)) {
    return '';
  }
  return segment;
}

export function isLinkGitHubQuery(searchParams: URLSearchParams): boolean {
  return searchParams.get(QUERY_PARAMS.LINK) === QUERY_VALUES.LINK_ENABLED;
}
