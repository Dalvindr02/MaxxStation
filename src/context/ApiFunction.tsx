import { useState } from 'react';

export function useApi<T>(apiCall: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);

  const fetchData = async () => {
    const result = await apiCall();
    setData(result);
  };

  return { data, fetchData };
}
