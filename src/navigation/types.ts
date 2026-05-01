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
 DataViewer: undefined;
};
