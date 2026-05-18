import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@maxxstation_billable_travel_session_v1';

export type BillableTravelPersistedSession = {
 active: true;
 projectId: string;
 startLat?: number;
 startLng?: number;
 startTime?: string;
 travelLogId?: number;
 distanceMeters?: number;
 purpose?: string;
 notes?: string;
 savedAt: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
 return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

const isSession = (v: unknown): v is BillableTravelPersistedSession =>
 isRecord(v) &&
 v.active === true &&
 typeof v.projectId === 'string' &&
 v.projectId.length > 0 &&
 typeof v.savedAt === 'number';

export async function readBillableTravelSession(): Promise<BillableTravelPersistedSession | null> {
 try {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
   return null;
  }
  const parsed: unknown = JSON.parse(raw);
  return isSession(parsed) ? parsed : null;
 } catch {
  return null;
 }
}

export async function persistBillableTravelSession(
 projectId: string,
 metadata: Omit<
  Partial<BillableTravelPersistedSession>,
  'active' | 'projectId' | 'savedAt'
 > = {},
): Promise<void> {
 try {
  const payload: BillableTravelPersistedSession = {
   active: true,
   projectId,
   ...metadata,
   savedAt: Date.now(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
 } catch {
  // ignore
 }
}

export async function clearBillableTravelSession(): Promise<void> {
 try {
  await AsyncStorage.removeItem(STORAGE_KEY);
 } catch {
  // ignore
 }
}
