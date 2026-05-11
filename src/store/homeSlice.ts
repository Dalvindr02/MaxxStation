import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {fetchHomeScreenData} from '../services/homeService';

interface HomeState {
  data: any;
  isLoading: boolean;
  error: string | null;
}

const initialState: HomeState = {
  data: null,
  isLoading: false,
  error: null,
};

export const fetchHomeData = createAsyncThunk(
  'home/fetchData',
  async (token: string, {rejectWithValue}) => {
    try {
      const response = await fetchHomeScreenData(token);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch home data');
    }
  },
);

const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    clearHomeData: (state) => {
      state.data = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHomeData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchHomeData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
      })
      .addCase(fetchHomeData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {clearHomeData} = homeSlice.actions;
export default homeSlice.reducer;
