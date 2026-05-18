import axios from 'axios';
import {API_ENDPOINTS, buildApiUrl} from '../constants/api';

export interface BillableTravelPayload {
 project_id: number;
 start_lat: number;
 start_lng: number;
 end_lat: number;
 end_lng: number;
 distance: number;
 duration: number;
 start_time: string;
 end_time: string;
 mode: string;
 purpose: string;
 notes: string;
 is_billable: 1;
 billable_status: 'active' | 'complete';
 travel_log_id?: number;
}

export const submitBillableTravelLogAPI = async (
 payload: BillableTravelPayload,
 token: string | null,
) => {
 if (!token) throw new Error('No authentication token available.');

 console.log('[BillableTravel] API Request →', {
  endpoint: API_ENDPOINTS.billableTravelLogCreate,
  payload,
 });

 const response = await axios.post(
  buildApiUrl(API_ENDPOINTS.billableTravelLogCreate),
  payload,
  {
   headers: {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
   },
   timeout: 15000,
  },
 );

 console.log('[BillableTravel] API Response ←', response.data);
 return response.data;
};

export const updateBillableLocationAPI = async (
 payload: BillableTravelPayload,
 token: string | null,
) => {
 return submitBillableTravelLogAPI(payload, token);
};
