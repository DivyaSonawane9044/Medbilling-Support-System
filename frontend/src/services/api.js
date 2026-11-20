import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the current Clerk session token. getToken() is async and refreshes
// short-lived tokens automatically, so it must be awaited on every request.
// A stalled token refresh must not hang requests forever: give up after TOKEN_WAIT_MS and send the
// request without a token (the backend then answers 401 and the page shows a sign-in message).
const TOKEN_WAIT_MS = 8000;
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

api.interceptors.request.use(async (config) => {
  const session = window.Clerk?.session;
  if (session) {
    const token = await withTimeout(session.getToken().catch(() => null), TOKEN_WAIT_MS);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Turn error bodies (including Blob bodies from file downloads) into readable messages.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const data = error.response?.data;
    if (data instanceof Blob && data.type?.includes('json')) {
      try {
        error.response.data = JSON.parse(await data.text());
      } catch {
        /* keep original body */
      }
    }
    if (error.response?.status === 401) {
      error.message = 'Your session has expired or is not authorised. Please sign in again.';
    }
    return Promise.reject(error);
  }
);

const filenameFrom = (response, fallback) => {
  const header = response.headers?.['content-disposition'] || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : fallback;
};

export const downloadBlob = (response, fallbackName) => {
  const type = response.headers?.['content-type'] || 'application/octet-stream';
  const url = window.URL.createObjectURL(new Blob([response.data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filenameFrom(response, fallbackName));
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const analyticsAPI = {
  getDashboard: () => api.get('/api/analytics/dashboard'),
  getStockAlerts: (threshold = 30) => api.get('/api/analytics/stock-alerts', { params: { threshold } }),
  exportGstReport: () => api.get('/api/analytics/export/gst', { responseType: 'blob' }),
  exportExpiryReport: () => api.get('/api/analytics/export/expiry', { responseType: 'blob' }),
};

export const accountingAPI = {
  // period: 'today' | 'month' | 'year'
  getSummary: (period = 'today') => api.get('/api/accounting/summary', { params: { period } }),
};

export const customersAPI = {
  getAll: (search) => api.get('/api/customers', { params: { search } }),
  getById: (id) => api.get(`/api/customers/${id}`),
  lookupByFirstName: (firstName) => api.get('/api/customers/lookup', { params: { firstName } }),
  getHistory: (id) => api.get(`/api/customers/${id}/history`),
  getPayments: (id) => api.get(`/api/customers/${id}/payments`),
  // Settles part of the customer's outstanding balance
  processPayment: (id, amount, paymentMethod = 'Cash') => api.post(`/api/customers/${id}/pay`, { amount, paymentMethod }),
  create: (customerData) => api.post('/api/customers', customerData),
  update: (id, customerData) => api.put(`/api/customers/${id}`, customerData),
  delete: (id) => api.delete(`/api/customers/${id}`),
  savePrescriptionImage: (id, imageUrl) => api.post(`/api/customers/${id}/prescription-image`, { imageUrl }),
};

export const suppliersAPI = {
  getAll: (search) => api.get('/api/suppliers', { params: { search } }),
  getById: (id) => api.get(`/api/suppliers/${id}`),
  getHistory: (id) => api.get(`/api/suppliers/${id}/history`),
  create: (supplierData) => api.post('/api/suppliers', supplierData),
  update: (id, supplierData) => api.put(`/api/suppliers/${id}`, supplierData),
  processPayment: (id, amount) => api.post(`/api/suppliers/${id}/pay`, { amount }),
};

export const productsAPI = {
  getAll: (search) => api.get('/api/products', { params: { search } }),
  search: (query) => api.get('/api/products', { params: { search: query } }),
  getById: (id) => api.get(`/api/products/${id}`),
  create: (data) => api.post('/api/products', data),
  update: (id, data) => api.put(`/api/products/${id}`, data),
  delete: (id) => api.delete(`/api/products/${id}`),
  getAlternatives: (id) => api.get(`/api/products/${id}/alternatives`),
};

// Kept as an alias: older pages call it medicinesAPI
export const medicinesAPI = productsAPI;

export const salesAPI = {
  quote: (salesData) => api.post('/api/sales/quote', salesData),
  createBill: (salesData) => api.post('/api/sales/bill', salesData),
  listInvoices: () => api.get('/api/sales/invoices'),
  getInvoice: (id) => api.get(`/api/sales/invoices/${id}`),
  notify: (id, channel = 'sms') => api.post(`/api/sales/invoices/${id}/notify`, null, { params: { channel } }),
  quickProductSearch: (query) => api.get('/api/sales/search', { params: { query } }),
  searchByCompany: (company) => api.get('/api/sales/searchByCompany', { params: { company } }),
  findByBarcode: (code) => api.get('/api/sales/barcode', { params: { code } }),
};

export const purchasesAPI = {
  getAll: () => api.get('/api/purchases'),
  getPending: () => api.get('/api/purchases/pending'),
  createOrder: (data) => api.post('/api/purchases/order', data),
  receiveStock: (data) => api.post('/api/purchases/receive', data),
};

export const paymentsAPI = {
  getAll: () => api.get('/api/payments'),
  getConfig: () => api.get('/api/payments/config'),
  getReceipt: (paymentId) => api.get(`/api/payments/receipt/${paymentId}`),
  // Body: { invoiceId } — the server charges the invoice's outstanding amount
  createOrder: (invoiceId) => api.post('/api/payments/create-order', { invoiceId }),
  verifyPayment: (data) => api.post('/api/payments/verify-payment', data),
  reportFailure: (orderId, reason) => api.post('/api/payments/failed', { razorpay_order_id: orderId, reason }),
  // Body: { invoiceId, paymentMethod, amount? } — omit amount to pay the full outstanding
  recordPayment: (data) => api.post('/api/payments/record', data),
};

export const reportsAPI = {
  daily: () => api.get('/api/reports/daily', { responseType: 'blob' }),
  monthly: () => api.get('/api/reports/monthly', { responseType: 'blob' }),
  yearly: () => api.get('/api/reports/yearly', { responseType: 'blob' }),
  stock: () => api.get('/api/reports/stock', { responseType: 'blob' }),
  expiry: () => api.get('/api/reports/expiry', { responseType: 'blob' }),
  profitLoss: () => api.get('/api/reports/profit-loss', { responseType: 'blob' }),
  purchases: () => api.get('/api/reports/purchases', { responseType: 'blob' }),
  medicines: () => api.get('/api/reports/medicines', { responseType: 'blob' }),
  customer: (customerId) => api.get(`/api/reports/customer/${customerId}`, { responseType: 'blob' }),
  gstMonthly: () => api.get('/api/reports/gst/monthly', { responseType: 'blob' }),
  gstYearly: () => api.get('/api/reports/gst/yearly', { responseType: 'blob' }),
};

export const notificationsAPI = {
  getAlerts: (threshold = 30) => api.get('/api/notifications/alerts', { params: { stockThreshold: threshold } }),
};

export const prescriptionAPI = {
  getAll: (customerId) => api.get('/api/prescriptions', { params: { customerId } }),
  save: (data) => api.post('/api/prescriptions', data),
};

export const inventoryAPI = {
  getAllStock: () => api.get('/api/inventory/stock-list'),
  getStockSummary: () => api.get('/api/inventory/stock-summary'),
  getNearExpiry: () => api.get('/api/inventory/near-expiry'),
  getExpired: () => api.get('/api/inventory/expired'),
  getAgingReport: () => api.get('/api/inventory/aging-report'),
  processReturn: (returnData) => api.post('/api/inventory/returns', returnData),
  writeOff: (batchId, data = {}) => api.post(`/api/inventory/batches/${batchId}/write-off`, data),
};

export const handleApiError = (error) => {
  if (error.response) {
    const data = error.response.data;
    const message = typeof data === 'string' && data
      ? data
      : data?.message || (error.response.status === 401 ? error.message : null)
        || error.response.statusText || `Request failed (${error.response.status})`;
    return new Error(message);
  }
  if (error.request) return new Error('Cannot reach the server. Check that the backend is running.');
  return new Error(error.message || 'An unexpected error occurred.');
};

export default api;
