import axios from 'axios';
import { API_ENDPOINTS, buildApiUrl } from '../constants/api';

export interface BillableTravelPayload {
  project_id: number;
  latitude: number;
  longitude: number;
}

export const startBillableAPI = async (
  payload: BillableTravelPayload,
  token: string | null
) => {
  if (!token) throw new Error('No authentication token available.');

  console.log('[BillableTravel] API Request →', {
    endpoint: API_ENDPOINTS.startBillable,
    payload,
  });

  const response = await axios.post(
    buildApiUrl(API_ENDPOINTS.startBillable),
    payload,
    {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 15000,
    }
  );

  console.log('[BillableTravel] API Response ←', response.data);
  return response.data;
};

export const updateBillableLocationAPI = async (
  payload: BillableTravelPayload,
  token: string | null
) => {
  // Assuming the same endpoint for updates, or a similar one. 
  // The user requirement says "Call API ... start-billable" and "Continue Sending Updated Coordinates".
  // If there's no specific 'update' endpoint mentioned, we reuse 'start-billable' or log if it differs.
  return startBillableAPI(payload, token);
};
