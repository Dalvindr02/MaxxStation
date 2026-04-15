import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';
import {
  fetchProjectsRequest,
  ProjectOption,
} from '../services/projectService';
import type { RootState } from './store';

/* =========================
   TYPES
========================= */

type ProjectsState = {
  items: ProjectOption[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
};

/* =========================
   INITIAL STATE
========================= */

const initialState: ProjectsState = {
  items: [],
  selectedProjectId: null,
  isLoading: false,
  error: null,
};

/* =========================
   THUNK (SAFE + TYPED)
========================= */

export const fetchProjects = createAsyncThunk<
  { projects: ProjectOption[] }, // expected API shape
  void,
  { state: RootState; rejectValue: string }
>('projects/fetchProjects', async (_, { getState, rejectWithValue }) => {
  const state = getState();
  const token = state.auth.token;

  // 🔥 Prevent useless API call
  if (!token) {
    return rejectWithValue('No auth token found');
  }

  try {
    const response = await fetchProjectsRequest(token);

    // 🔥 Handle multiple API formats safely
    const projects = Array.isArray(response?.projects)
      ? response.projects
      : Array.isArray(response?.data)
      ? response.data
      : [];

    return { projects };
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
    return rejectWithValue('Unable to load projects. Please try again.');
  }
});

/* =========================
   SLICE
========================= */

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setSelectedProject(state, action: PayloadAction<string | null>) {
      state.selectedProjectId = action.payload;
    },

    clearProjects(state) {
      state.items = [];
      state.selectedProjectId = null;
      state.isLoading = false;
      state.error = null;
    },
  },

  extraReducers: builder => {
    builder
      /* ===== FETCH START ===== */
      .addCase(fetchProjects.pending, state => {
        state.isLoading = true;
        state.error = null;
      })

      /* ===== FETCH SUCCESS ===== */
      .addCase(fetchProjects.fulfilled, (state, action) => {
        const projects = Array.isArray(action.payload?.projects)
          ? action.payload.projects
          : [];

        state.items = projects;
        state.isLoading = false;
        state.error = null;

        // 🔥 Keep existing selection if valid
        const exists = projects.find(p => p.id === state.selectedProjectId);

        if (!exists) {
          state.selectedProjectId = projects[0]?.id ?? null;
        }
      })

      /* ===== FETCH ERROR ===== */
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error =
          typeof action.payload === 'string'
            ? action.payload
            : 'Unable to load projects. Please try again.';
      })

      /* ===== LOGOUT CLEANUP ===== */
      .addCase(logout, state => {
        state.items = [];
        state.selectedProjectId = null;
        state.isLoading = false;
        state.error = null;
      });
  },
});

/* =========================
   EXPORTS
========================= */

export const { setSelectedProject, clearProjects } = projectsSlice.actions;

export default projectsSlice.reducer;
