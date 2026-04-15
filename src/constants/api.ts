export const API_BASE_URL = 'https://apimaxxstation.maxxmann.info/api/';
export const PROJECTS_API_AUTH_TOKEN = '';

export const API_ENDPOINTS = {
  login: 'login',
  getProjects: 'get-project',
  createManualLog: 'create-manual-log',
  getManualLogList: 'all-log-list',
  deleteManualLog: 'delete-manual-log',
} as const;

export const buildApiUrl = (endpoint: string) => {
  const baseUrl = API_BASE_URL.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.replace(/^\/+/, '');

  if (!normalizedEndpoint) {
    return baseUrl;
  }

  return `${baseUrl}/${normalizedEndpoint}`;
};
