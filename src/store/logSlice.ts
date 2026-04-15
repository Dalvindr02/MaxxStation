import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { LogEntry } from '../context/LogsContext';
import { fetchManualLogListRequest } from '../services/manualLogService';
import type { RootState } from './store';

type LogsState = {
  logs: LogEntry[];
  isLoading: boolean;
  error: string | null;
};

const initialState: LogsState = {
  logs: [],
  isLoading: false,
  error: null,
};

export const fetchLogs = createAsyncThunk<
  { message: string; data: LogEntry[] },
  void,
  { state: RootState; rejectValue: string }
>('logs/fetchLogs', async (_, { getState, rejectWithValue }) => {
  const state = getState();
  const token = state.auth.token;

  if (!token?.trim()) {
    return rejectWithValue('No auth token found');
  }

  try {
    const result = await fetchManualLogListRequest(token);

    console.log('logSlice fetchLogs normalized response:', {
      message: result.message,
      count: result.data.length,
      firstLog: result.data ?? null,
    });

    return {
      message: result.message,
      data: result.data,
    };
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }

    return rejectWithValue('Failed to fetch logs');
  }
});

const logsSlice = createSlice({
  name: 'logs',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchLogs.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.logs = Array.isArray(action.payload.data)
          ? action.payload.data
          : [];
        state.error = null;
      })
      .addCase(fetchLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error =
          typeof action.payload === 'string'
            ? action.payload
            : 'Something went wrong';
      });
  },
});

export default logsSlice.reducer;
