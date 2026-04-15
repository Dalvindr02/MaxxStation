import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { todayKey } from '../utils/date';
import { LatLng, WorkLocation } from '../constants/workLocation';

export type AttendanceStatus = 'Present' | 'Late' | 'Absent';

export type AttendanceLocationStatus = 'at' | 'outside' | 'pending';

export type AttendanceEntry = {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  clockIn?: string;
  clockOut?: string;
  locationStatus?: AttendanceLocationStatus;
  reason?: string;
};

type AttendanceContextValue = {
  entries: AttendanceEntry[];
  todayEntry: AttendanceEntry | null;
  markPresence: (options: {
    date?: string;
    clockTime?: string;
    locationStatus: AttendanceLocationStatus;
    workLocation: WorkLocation;
    distanceMeters: number | null;
  }) => void;
};

const STORAGE_KEY = 'attendance_entries_v1';

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setEntries(parsed);
          }
        }
      } catch {
        // ignore read errors for now
      }
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(
      () => null,
    );
  }, [entries]);

  const markPresence: AttendanceContextValue['markPresence'] = useCallback(
    ({ date, clockTime, locationStatus, workLocation, distanceMeters }) => {
      const dateKey = date ?? todayKey();
      const time =
        clockTime ??
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

      setEntries(prev => {
        const existing = prev.find(entry => entry.date === dateKey);
        const baseStatus: AttendanceStatus =
          locationStatus === 'at' ? 'Present' : 'Late';

        if (!existing) {
          const created: AttendanceEntry = {
            date: dateKey,
            status: baseStatus,
            clockIn: time,
            locationStatus,
            reason:
              distanceMeters != null
                ? `Marked at ${Math.round(distanceMeters)} m from ${
                    workLocation.label
                  }`
                : undefined,
          };
          return [created, ...prev];
        }

        const updated: AttendanceEntry = {
          ...existing,
          status: existing.status ?? baseStatus,
          clockIn: existing.clockIn ?? time,
          clockOut: existing.clockOut ?? time,
          locationStatus: locationStatus ?? existing.locationStatus,
        };

        return prev.map(entry => (entry.date === dateKey ? updated : entry));
      });
    },
    [],
  );

  const todayEntry = useMemo(() => {
    const key = todayKey();
    return entries.find(entry => entry.date === key) ?? null;
  }, [entries]);

  const value = useMemo<AttendanceContextValue>(
    () => ({
      entries,
      todayEntry,
      markPresence,
    }),
    [entries, markPresence, todayEntry],
  );

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within AttendanceProvider');
  }
  return context;
};
