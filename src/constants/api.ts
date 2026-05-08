export const API_BASE_URL = 'https://apimaxxstation.maxxmann.info/api/android/';
export const PROJECTS_API_AUTH_TOKEN = '';

export const API_ENDPOINTS = {
 login: 'login',
 logout: 'logout',
 getProjects: 'get-project',
 createManualLog: 'create-manual-log',
 travelLogCreate: 'travel-log-create',
 getManualLogList: 'all-log-list',
 deleteManualLog: 'delete-manual-log',
 dailySummary: 'daily-summary',
 reportsList: 'reports-list',
 reportDetail: 'report-detail',
 travelLogDetail: 'travel-logs-detail',
} as const;

export const buildApiUrl = (endpoint: string) => {
 const baseUrl = API_BASE_URL.replace(/\/+$/, '');
 const normalizedEndpoint = endpoint.replace(/^\/+/, '');

 if (!normalizedEndpoint) {
  return baseUrl;
 }

 return `${baseUrl}/${normalizedEndpoint}`;
};
