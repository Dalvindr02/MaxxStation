import axios from 'axios';
import {API_BASE_URL} from '../constants/api';

export const createExpenseRequest = async (
 formData: FormData,
 token: string | null,
) => {
 if (!token) {
  throw new Error('No authentication token available.');
 }

 try {
  const response = await axios.post(`${API_BASE_URL}expense/add`, formData, {
   headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'multipart/form-data',
   },
  });
  console.log('Expense submitted successfully', response.data);
  return response.data;
 } catch (error: any) {
  console.log('Expense submitted failed', error);
  const errorMsg =
   error?.response?.data?.message ||
   error.message ||
   'Failed to submit expense.';
  throw new Error(errorMsg);
 }
};

export const fetchExpenseCategories = async (token: string | null) => {
 if (!token) throw new Error('No authentication token available.');
 try {
  const response = await axios.get(`${API_BASE_URL}expense/category-list`, {
   headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
   },
  });
  return response.data;
 } catch (error: any) {
  const errorMsg =
   error.response?.data?.message || 'Failed to fetch categories.';
  throw new Error(errorMsg);
 }
};

export const fetchExpenseList = async (
 token: string | null,
 page: number = 1,
) => {
 if (!token) throw new Error('No authentication token available.');
 try {
  const response = await axios.get(`${API_BASE_URL}expense/list?page=${page}`, {
   headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
   },
  });
  return response.data;
 } catch (error: any) {
  const errorMsg =
   error.response?.data?.message || 'Failed to fetch expense list.';
  throw new Error(errorMsg);
 }
};

export const deleteExpenseRequest = async (
 token: string | null,
 expenseId: string | number,
) => {
 if (!token) {
  throw new Error('No authentication token available.');
 }
 if (
  expenseId === null ||
  expenseId === undefined ||
  String(expenseId).trim() === ''
 ) {
  throw new Error('Expense id is required.');
 }

 try {
  const normalizedId = String(expenseId).trim();
  const headers = {
   Authorization: `Bearer ${token}`,
   Accept: 'application/json',
  };
  const encodedId = encodeURIComponent(normalizedId);
  const candidateUrls = [
   `${API_BASE_URL}expense/delete/${encodedId}`,
   `${API_BASE_URL}expense/${encodedId}`,
   `${API_BASE_URL}expense/delete?id=${encodedId}`,
   `${API_BASE_URL}expense-delete/${encodedId}`,
  ];

  let lastError: any = null;
  for (const url of candidateUrls) {
   try {
    const response = await axios.delete(url, {headers});
    console.log('Expense deleted successfully via', url, response.data);
    return response.data;
   } catch (error: any) {
    lastError = error;
    const status = error?.response?.status;
    if (status && status !== 404) {
     break;
    }
   }
  }

  const errorMsg =
   lastError?.response?.data?.message ||
   lastError?.message ||
   'Failed to delete expense.';
  throw new Error(errorMsg);
 } catch (error: any) {
  const errorMsg =
   error?.response?.data?.message ||
   error.message ||
   'Failed to delete expense.';
  throw new Error(errorMsg);
 }
};

export const updateExpenseRequest = async (
 token: string | null,
 expenseId: string | number,
 formData: FormData,
) => {
 if (!token) {
  throw new Error('No authentication token available.');
 }
 if (
  expenseId === null ||
  expenseId === undefined ||
  String(expenseId).trim() === ''
 ) {
  throw new Error('Expense id is required.');
 }

 const normalizedId = encodeURIComponent(String(expenseId).trim());
 const urls = [
  `https://apimaxxstation.maxxmann.info/expense/update/${normalizedId}`,
  `${API_BASE_URL}expense/update/${normalizedId}`,
 ];

 let lastError: any = null;
 for (const url of urls) {
  try {
   const response = await axios.post(url, formData, {
    headers: {
     Authorization: `Bearer ${token}`,
     'Content-Type': 'multipart/form-data',
     Accept: 'application/json',
    },
   });
   return response.data;
  } catch (error: any) {
   lastError = error;
   const status = error?.response?.status;
   if (status && status !== 404) {
    break;
   }
  }
 }

 const errorMsg =
  lastError?.response?.data?.message ||
  lastError?.message ||
  'Failed to update expense.';
 throw new Error(errorMsg);
};
