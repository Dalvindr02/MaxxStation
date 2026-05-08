import type {LogEntry} from '../context/LogsContext';

export type RootStackParamList = {
 Auth: undefined;
 Main: undefined;
 Report: undefined;
 AttendanceHistory: undefined;
 AttendanceTravel:
  | {
     mode?: 'billable' | 'manual';
     fromCoords?: {latitude: number; longitude: number} | null;
     toCoords?: {latitude: number; longitude: number} | null;
    }
  | undefined;
 ReportList: undefined;
 ReportDetail: {report: Record<string, unknown>} | undefined;
 TravelLogs: undefined;
 TravelLogDetail: {id?: number; log?: LogEntry} | undefined;
 DataViewer: undefined;
};
