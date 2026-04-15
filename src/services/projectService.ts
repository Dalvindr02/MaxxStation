import axios from 'axios';
import {
  API_ENDPOINTS,
  PROJECTS_API_AUTH_TOKEN,
  buildApiUrl,
} from '../constants/api';

export type ProjectOption = {
  id: string;
  name: string;
  tasks: ProjectTaskOption[];
  raw: Record<string, unknown>;
};

export type ProjectTaskOption = {
  id: string;
  name: string;
  raw: Record<string, unknown>;
};

type ProjectListResult = {
  success: boolean;
  message: string;
  projects: ProjectOption[];
  data: Record<string, unknown> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (!isRecord(payload)) {
    return fallback;
  }

  const directMessage = payload.message ?? payload.error ?? payload.detail;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage;
  }

  return fallback;
};

const getSuccessStatus = (payload: unknown): boolean => {
  if (!isRecord(payload)) {
    return false;
  }

  const status = payload.status ?? payload.success;

  if (typeof status === 'boolean') {
    return status;
  }

  if (typeof status === 'number') {
    return status === 1;
  }

  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase();
    return normalized === 'true' || normalized === 'success' || normalized === '1';
  }

  return false;
};

const findFirstArray = (payload: unknown): Record<string, unknown>[] | null => {
  if (Array.isArray(payload)) {
    const records = payload.filter(isRecord);
    return records.length ? records : null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of ['projects', 'data', 'result', 'items', 'rows']) {
    const value = payload[key];
    if (Array.isArray(value)) {
      const records = value.filter(isRecord);
      if (records.length) {
        return records;
      }
    }
  }

  for (const value of Object.values(payload)) {
    const nested = findFirstArray(value);
    if (nested?.length) {
      return nested;
    }
  }

  return null;
};

const pickString = (
  source: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }

  return null;
};

const normalizeTask = (
  item: Record<string, unknown>,
  index: number,
): ProjectTaskOption => {
  const id =
    pickString(item, ['id', 'task_id', 'taskId', 'value', 'code']) ??
    `task-${index}`;
  const name =
    pickString(item, ['task_name', 'name', 'title', 'label', 'value']) ??
    `Task ${index + 1}`;

  return {
    id,
    name,
    raw: item,
  };
};

const normalizeProject = (item: Record<string, unknown>, index: number): ProjectOption => {
  const id =
    pickString(item, ['id', 'project_id', 'projectId', 'value', 'code']) ??
    `project-${index}`;
  const name =
    pickString(item, ['name', 'project_name', 'projectName', 'title', 'label', 'value']) ??
    `Project ${index + 1}`;
  const tasks = Array.isArray(item.tasks)
    ? item.tasks.filter(isRecord).map(normalizeTask)
    : [];

  return {
    id,
    name,
    tasks,
    raw: item,
  };
};

export const fetchProjectsRequest = async (
  authToken: string = PROJECTS_API_AUTH_TOKEN,
): Promise<ProjectListResult> => {
  try {
    const response = await axios.get(buildApiUrl(API_ENDPOINTS.getProjects), {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : {}),
      },
    });

    const payload = isRecord(response.data)
      ? (response.data as Record<string, unknown>)
      : null;
    const projectRows = findFirstArray(response.data) ?? [];
    const message =
      (payload && typeof payload.message === 'string' && payload.message.trim()) ||
      'Projects loaded.';

    return {
      success: payload ? getSuccessStatus(payload) || projectRows.length > 0 : projectRows.length > 0,
      message,
      projects: projectRows.map(normalizeProject),
      data: payload,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const payload = error.response?.data;
      const fallback = error.response?.status
        ? error.response.status === 401
          ? 'Project list API rejected the request as unauthenticated. Configure a valid project API token.'
          : `Project list request failed with status ${error.response.status}`
        : 'Unable to load projects. Please try again.';

      throw new Error(getErrorMessage(payload, fallback));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to load projects. Please try again.');
  }
};
