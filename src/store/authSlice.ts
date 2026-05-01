import {createAsyncThunk, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {loginRequest} from '../services/authService';

type AuthUser = Record<string, unknown> | null;
type AuthData = Record<string, unknown> | null;

type AuthState = {
 token: string | null;
 user: AuthUser;
 loginData: AuthData;
 isAuthenticated: boolean;
 isSigningIn: boolean;
};

const initialState: AuthState = {
 token: null,
 user: null,
 loginData: null,
 isAuthenticated: false,
 isSigningIn: false,
};

export const login = createAsyncThunk(
 'auth/login',
 async (
  credentials: {email: string; password: string; projectId?: string | null},
  {rejectWithValue},
 ) => {
  try {
   const result = await loginRequest(
    credentials.email,
    credentials.password,
    credentials.projectId,
   );
   console.log('Saving login data to Redux persist:', {
    token: result.token,
    user: result.user,
    loginData: result.data,
   });
   return result;
  } catch (error) {
   if (error instanceof Error) {
    return rejectWithValue(error.message);
   }

   return rejectWithValue('Unable to sign in. Please try again.');
  }
 },
);

const authSlice = createSlice({
 name: 'auth',
 initialState,
 reducers: {
  loginSuccess(
   state,
   action: PayloadAction<{
    token: string | null;
    user: AuthUser;
    loginData?: AuthData;
   }>,
  ) {
   state.token = action.payload.token;
   state.user = action.payload.user;
   state.loginData = action.payload.loginData ?? null;
   state.isAuthenticated = true;
   state.isSigningIn = false;
  },
  logout(state) {
   state.token = null;
   state.user = null;
   state.loginData = null;
   state.isAuthenticated = false;
   state.isSigningIn = false;
  },
 },
 extraReducers: builder => {
  builder
   .addCase(login.pending, state => {
    state.isSigningIn = true;
   })
   .addCase(login.fulfilled, (state, action) => {
    state.token = action.payload.token;
    state.user = action.payload.user;
    state.loginData = action.payload.data;
    state.isAuthenticated = true;
    state.isSigningIn = false;
   })
   .addCase(login.rejected, state => {
    state.isSigningIn = false;
   });
 },
});

export const {loginSuccess, logout} = authSlice.actions;
export default authSlice.reducer;
