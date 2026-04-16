import axios from 'axios';
import {API_ENDPOINTS, buildApiUrl} from '../constants/api';

export type ReportSummaryData = {
 user_id: number;
 date: string;
 notes: string;
 billable?: boolean;
};

export type DailySummaryResult = {
 success: boolean;
 message: string;
 data: Record<string, unknown> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
 Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getErrorMessage = (payload: unknown, fallback: string): string => {
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

 if (isRecord(payload.errors)) {
  const firstError = Object.values(payload.errors)[0];
  if (typeof firstError === 'string' && firstError.trim()) {
   return firstError;
  }
  if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
   return firstError[0];
  }
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
  return (
   normalized === 'true' || normalized === 'success' || normalized === '1'
  );
 }

 return false;
};

export const fetchDailySummary = async (
 userId: number | string,
 date: string,
 token: string,
): Promise<DailySummaryResult> => {
 try {
  const response = await axios.post(
   buildApiUrl(API_ENDPOINTS.dailySummary),
   {
    user_id: userId,
    date: date,
    notes: '',
   },
   {
    headers: {
     Authorization: `Bearer ${token}`,
     'Content-Type': 'application/json',
    },
   },
  );

  const payload =
   response.data && typeof response.data === 'object'
    ? (response.data as Record<string, unknown>)
    : {};

  console.log('Daily Summary API response:', payload);

  const message =
   typeof payload.message === 'string' && payload.message.trim()
    ? payload.message
    : 'Daily summary fetched successfully.';
  const success = getSuccessStatus(payload);

  return {
   success,
   message,
   data: isRecord(payload.data) ? payload.data : payload,
  };
 } catch (error) {
  if (axios.isAxiosError(error)) {
   const payload = error.response?.data;
   const fallback = error.response?.status
    ? `Failed to fetch daily summary with status ${error.response.status}`
    : 'Unable to fetch daily summary. Please try again.';

   throw new Error(getErrorMessage(payload, fallback));
  }

  if (error instanceof Error) {
   throw error;
  }

  throw new Error('Unable to fetch daily summary. Please try again.');
 }
};

export const submitDailyReport = async (
 userId: number | string,
 date: string,
 notes: string,
 token: string,
 billable?: boolean,
): Promise<DailySummaryResult> => {
 try {
  const payload: ReportSummaryData = {
   user_id: typeof userId === 'string' ? parseInt(userId, 10) : userId,
   date,
   notes,
  };

  if (billable !== undefined) {
   payload.billable = billable;
  }

  const response = await axios.post(
   buildApiUrl(API_ENDPOINTS.dailySummary),
   payload,
   {
    headers: {
     Authorization: `Bearer ${token}`,
     'Content-Type': 'application/json',
    },
   },
  );

  const responsePayload =
   response.data && typeof response.data === 'object'
    ? (response.data as Record<string, unknown>)
    : {};

  console.log('Submit Report API response:', responsePayload);

  const message =
   typeof responsePayload.message === 'string' && responsePayload.message.trim()
    ? responsePayload.message
    : 'Report submitted successfully.';
  const success = getSuccessStatus(responsePayload);

  return {
   success,
   message,
   data: isRecord(responsePayload.data)
    ? responsePayload.data
    : responsePayload,
  };
 } catch (error) {
  if (axios.isAxiosError(error)) {
   const payload = error.response?.data;
   const fallback = error.response?.status
    ? `Report submission failed with status ${error.response.status}`
    : 'Unable to submit report. Please try again.';

   throw new Error(getErrorMessage(payload, fallback));
  }

  if (error instanceof Error) {
   throw error;
  }

  throw new Error('Unable to submit report. Please try again.');
 }
};

export type ReportListResult = {
 success: boolean;
 message: string;
 data: {
  data: Array<Record<string, unknown>>;
  current_page: number;
  last_page: number;
  total: number;
 } | null;
};

export type ReportDetailResult = {
 success: boolean;
 message: string;
 data: Record<string, unknown> | null;
};

export const fetchReportsList = async (
 token: string,
 page: number = 1,
): Promise<ReportListResult> => {
 try {
  const response = await axios.get(buildApiUrl(API_ENDPOINTS.reportsList), {
   params: {
    page,
   },
   headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
   },
  });

  const payload =
   response.data && typeof response.data === 'object'
    ? (response.data as Record<string, unknown>)
    : {};

  console.log('Reports List API response:', payload);

  const message =
   typeof payload.message === 'string' && payload.message.trim()
    ? payload.message
    : 'Reports fetched successfully.';
  const success = getSuccessStatus(payload);

  return {
   success,
   message,
   data: isRecord(payload.data)
    ? {
       data: Array.isArray(payload.data.data) ? payload.data.data : [],
       current_page:
        typeof payload.data.current_page === 'number'
         ? payload.data.current_page
         : 1,
       last_page:
        typeof payload.data.last_page === 'number' ? payload.data.last_page : 1,
       total: typeof payload.data.total === 'number' ? payload.data.total : 0,
      }
    : null,
  };
 } catch (error) {
  if (axios.isAxiosError(error)) {
   const payload = error.response?.data;
   const fallback = error.response?.status
    ? `Failed to fetch reports with status ${error.response.status}`
    : 'Unable to fetch reports. Please try again.';

   throw new Error(getErrorMessage(payload, fallback));
  }

  if (error instanceof Error) {
   throw error;
  }

  throw new Error('Unable to fetch reports. Please try again.');
 }
};

export const fetchReportDetail = async (
 reportId: number | string,
 token: string,
): Promise<ReportDetailResult> => {
 try {
  const response = await axios.get(
   `${buildApiUrl(API_ENDPOINTS.reportDetail)}/${reportId}`,
   {
    headers: {
     Authorization: `Bearer ${token}`,
     'Content-Type': 'application/json',
    },
   },
  );

  const payload =
   response.data && typeof response.data === 'object'
    ? (response.data as Record<string, unknown>)
    : {};

  console.log('Report Detail API response:', payload);

  const message =
   typeof payload.message === 'string' && payload.message.trim()
    ? payload.message
    : 'Report details fetched successfully.';
  const success = getSuccessStatus(payload);

  return {
   success,
   message,
   data: isRecord(payload.data) ? payload.data : payload,
  };
 } catch (error) {
  if (axios.isAxiosError(error)) {
   const payload = error.response?.data;
   const fallback = error.response?.status
    ? `Failed to fetch report with status ${error.response.status}`
    : 'Unable to fetch report details. Please try again.';

   throw new Error(getErrorMessage(payload, fallback));
  }

  if (error instanceof Error) {
   throw error;
  }

  throw new Error('Unable to fetch report details. Please try again.');
 }
};
