export type ReportEntry = {
 id: number;
 date: string;
 report_date: string;
 status: 'approved' | 'submitted' | 'pending' | 'rejected';
 total_hours: string;
 billable_hours?: string;
 notes: string;
 project: string;
 submitted_at?: string;
 shift_label?: string;
 focus?: string;
 remarks?: string;
 employee_name?: string;
};

export const REPORTS_API_ENABLED = false;

export const STATIC_REPORTS: ReportEntry[] = [
 {
  id: 101,
  date: '2026-04-16',
  report_date: '2026-04-16',
  status: 'pending',
  total_hours: '08h 35m',
  billable_hours: '07h 50m',
  notes:
   'Site patrols completed on schedule. Handover notes drafted and incident register reviewed for tomorrow morning briefing.',
  project: 'North Gate Operations',
  submitted_at: 'Today, 06:42 PM',
  shift_label: 'Evening shift',
  focus: 'Pending review',
  remarks: 'Draft saved while API integration is pending.',
  employee_name: 'Field Officer',
 },
 {
  id: 102,
  date: '2026-04-15',
  report_date: '2026-04-15',
  status: 'approved',
  total_hours: '09h 10m',
  billable_hours: '08h 30m',
  notes:
   'Completed perimeter inspection, visitor desk audit, and checkpoint reconciliation. Shift closed with no major incidents.',
  project: 'HQ Security Coverage',
  submitted_at: 'Apr 15, 06:18 PM',
  shift_label: 'Day shift',
  focus: 'Cleared by supervisor',
  remarks: 'Attendance and expense entries matched report totals.',
  employee_name: 'Field Officer',
 },
 {
  id: 103,
  date: '2026-04-14',
  report_date: '2026-04-14',
  status: 'submitted',
  total_hours: '08h 00m',
  billable_hours: '07h 20m',
  notes:
   'Daily patrol completed with one delayed vendor entry. Supporting log updated and escalated to admin desk.',
  project: 'Warehouse Monitoring',
  submitted_at: 'Apr 14, 06:01 PM',
  shift_label: 'Day shift',
  focus: 'Awaiting approval',
  remarks: 'Supervisor follow-up still pending.',
  employee_name: 'Field Officer',
 },
 {
  id: 104,
  date: '2026-04-13',
  report_date: '2026-04-13',
  status: 'approved',
  total_hours: '08h 45m',
  billable_hours: '08h 10m',
  notes:
   'Front desk rotation covered overtime block. Late-night access issue documented and attached for operations review.',
  project: 'Lobby & Access Desk',
  submitted_at: 'Apr 13, 07:05 PM',
  shift_label: 'Split shift',
  focus: 'Approved with note',
  remarks: 'Supervisor requested same template for future overnight handovers.',
  employee_name: 'Field Officer',
 },
 {
  id: 105,
  date: '2026-04-12',
  report_date: '2026-04-12',
  status: 'rejected',
  total_hours: '06h 50m',
  billable_hours: '06h 00m',
  notes:
   'Short shift due to network issue during patrol logging. Manual notes captured but timestamps need correction.',
  project: 'Remote Yard Watch',
  submitted_at: 'Apr 12, 05:37 PM',
  shift_label: 'Relief shift',
  focus: 'Needs correction',
  remarks: 'Please align tracked hours with attendance before resubmitting.',
  employee_name: 'Field Officer',
 },
];
