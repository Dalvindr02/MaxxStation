export type ShiftWindow = {
  /** Friendly label for UI surfaces */
  name: string;
  /** 24-hour start time, e.g. 09:00 */
  start: string;
  /** 24-hour end time, e.g. 18:00 */
  end: string;
  /** Minutes after start before we raise a late warning */
  graceMinutes: number;
  /** Minutes before end when we surface wrap-up reminders */
  wrapReminderMinutes: number;
};

export const SHIFT_WINDOW: ShiftWindow = {
  name: 'Standard Day Shift',
  start: '09:00',
  end: '18:00',
  graceMinutes: 12,
  wrapReminderMinutes: 30,
};
