import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_ENDPOINTS, buildApiUrl } from '../constants/api';
import type { RootState } from './store';

export type TravelLogStop = {
  id: number;
  travel_log_id: number;
  lat: string;
  lng: string;
  created_at: string;
  address?: string;
  polyline?: string;
};

// Type that directly mirrors the travel_logs API response (both list and detail)
export type TravelLogEntry = {
  id: number;
  project_id: number;
  project_name: string | null;
  task_name?: string;
  purpose?: string;
  user_id: number;
  start_date: string;
  start_time?: string;
  start_time_only?: string;
  end_date?: string;
  end_time?: string;
  end_time_only?: string;
  end_date_time?: string;
  distance: string;
  spent_time_minutes?: number;
  duration?: number;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  description?: string;
  notes?: string;
  mode: string;
  billable: string;
  status: string;
  log_type?: string;
  from_address?: string;
  to_address?: string;
  google_distance?: string;
  google_duration?: string;
  polyline?: string;
  stops?: TravelLogStop[];
};

type TravelLogState = {
  travelLogs: TravelLogEntry[];
  selectedLogDetail: TravelLogEntry | null;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
};

const initialState: TravelLogState = {
  travelLogs: [],
  selectedLogDetail: null,
  isLoading: false,
  isDetailLoading: false,
  error: null,
};

export const fetchTravelLogs = createAsyncThunk<
  TravelLogEntry[],
  void,
  { state: RootState; rejectValue: string }
>('travelLogs/fetchTravelLogs', async (_, { getState, rejectWithValue }) => {
  const token = getState().auth.token;
  if (!token?.trim()) {
    return rejectWithValue('No auth token found');
  }

  try {
    const response = await axios.get(buildApiUrl(API_ENDPOINTS.getManualLogList), {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Authorization: `Bearer ${token.trim()}`,
      },
    });

    const data = response.data;
    console.log('fetchTravelLogs - full response:', data);

    // Explicitly extract travel_logs array
    const travelLogs: TravelLogEntry[] = Array.isArray(data?.travel_logs)
      ? data.travel_logs
      : [];

    console.log('fetchTravelLogs - travel_logs count:', travelLogs.length);
    return travelLogs;
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
    return rejectWithValue('Failed to fetch travel logs');
  }
});

export const fetchTravelLogDetail = createAsyncThunk<
  TravelLogEntry,
  number,
  { state: RootState; rejectValue: string }
>('travelLogs/fetchTravelLogDetail', async (id, { getState, rejectWithValue }) => {
  const token = getState().auth.token;
  if (!token?.trim()) {
    return rejectWithValue('No auth token found');
  }

  try {
    const url = buildApiUrl(`${API_ENDPOINTS.travelLogDetail}/${id}`);
    console.log('fetchTravelLogDetail - request:', { url, id });

    const response = await axios.get(
      url,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Authorization': `Bearer ${token.trim()}`,
        },
      }
    );

    const data = response.data;
    console.log('fetchTravelLogDetail - response:', data);

    // Backend might return the log object directly or wrapped in 'data' or 'travel_log'
    const logDetail = data?.data || data?.travel_log || data;
    
    if (!logDetail || typeof logDetail !== 'object') {
      return rejectWithValue('Invalid log detail response');
    }

    return logDetail as TravelLogEntry;
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
    return rejectWithValue('Failed to fetch travel log detail');
  }
});

const travelLogSlice = createSlice({
  name: 'travelLogs',
  initialState,
  reducers: {
    clearSelectedLog: (state) => {
      state.selectedLogDetail = null;
      state.error = null;
    }
  },
  extraReducers: builder => {
    builder
      .addCase(fetchTravelLogs.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTravelLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.travelLogs = action.payload;
        state.error = null;
      })
      .addCase(fetchTravelLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error =
          typeof action.payload === 'string' ? action.payload : 'Something went wrong';
      })
      .addCase(fetchTravelLogDetail.pending, state => {
        state.isDetailLoading = true;
        state.error = null;
      })
      .addCase(fetchTravelLogDetail.fulfilled, (state, action) => {
        state.isDetailLoading = false;
        state.selectedLogDetail = action.payload;
        state.error = null;
      })
      .addCase(fetchTravelLogDetail.rejected, (state, action) => {
        state.isDetailLoading = false;
        state.error =
          typeof action.payload === 'string' ? action.payload : 'Something went wrong';
      });
  },
});

export const { clearSelectedLog } = travelLogSlice.actions;

export default travelLogSlice.reducer;
