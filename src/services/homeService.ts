import axios from 'axios';
import {API_ENDPOINTS, buildApiUrl} from '../constants/api';

export const fetchHomeScreenData = async (token: string) => {
  try {
    const response = await axios.get(buildApiUrl(API_ENDPOINTS.homeScreen), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    console.log('[HomeService] Home screen API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[HomeService] Error fetching home screen data:', error);
    throw error;
  }
};
