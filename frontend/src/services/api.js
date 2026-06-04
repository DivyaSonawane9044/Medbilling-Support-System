import axios from 'axios';

const API_BASE_URL = 'http://localhost:8081';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('clerk_jwt') ||
    window.Clerk?.session?.getToken() ||
    sessionStorage.getItem('clerk_session');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/sign-in';
    }
    return Promise.reject(error);
  }
);

export const downloadBlob = (response, filename) => {
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const analyticsAPI = {
  getDashboard: () => api.get('/api/analytics/dashboard'),
  getStockAlerts: (threshold = 30) => api.get(`/api/analytics/stock-alerts?threshold=${threshold}`),
  exportGstReport: () => api.get('/api/analytics/export/gst', { responseType: 'blob' }),
  exportExpiryReport: () => api.get('/api/analytics/export/expiry', { responseType: 'blob' }),
};

export const accountingAPI = {
  getSummary: (period = 'today') => api.get('/api/accounting/summary', { params: { period } }),
};

export const customersAPI = {
  getAll: (search) => api.get('/api/customers', { params: { search } }),
  getById: (id) => api.get(`/api/customers/${id}`),
  lookupByFirstName: (firstName) => api.get('/api/customers/lookup', { params: { firstName } }),
  getHistory: (id) => api.get(`/api/customers/${id}/history`),
  getPayments: (id) => api.get(`/api/customers/${id}/payments`),
  processPayment: (id, amount) => api.post(`/api/customers/${id}/pay`, { amount }),
  create: (customerData) => api.post('/api/customers', customerData),
  update: (id, customerData) => api.put(`/api/customers/${id}`, customerData),
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

export const medicinesAPI = {
  // Medicines API now proxies to the products endpoints so the billing
  // module and medicines management use the same backend resource.
  getAll: (search) => api.get('/api/products', { params: { search } }),
  getById: (id) => api.get(`/api/products/${id}`),
  create: (medicineData) => api.post('/api/products', medicineData),
  update: (id, medicineData) => api.put(`/api/products/${id}`, medicineData),
  delete: (id) => api.delete(`/api/products/${id}`),
  search: (query) => api.get('/api/products', { params: { search: query } }),
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

export const salesAPI = {
  createBill: (salesData) => api.post('/api/sales/bill', salesData),
  listInvoices: () => api.get('/api/sales/invoices'),
  getInvoice: (id) => api.get(`/api/sales/invoices/${id}`),
  notify: (id, channel = 'sms') => api.post(`/api/sales/invoices/${id}/notify`, null, { params: { channel } }),
  quickProductSearch: (query) => api.get(`/api/sales/search?query=${encodeURIComponent(query)}`),
  searchByCompany: (company) => api.get(`/api/sales/searchByCompany?company=${encodeURIComponent(company)}`),
  findByBarcode: (code) => api.get(`/api/sales/barcode?code=${encodeURIComponent(code)}`),
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
  createOrder: (data) => api.post('/api/payments/create-order', data),
  verifyPayment: (data) => api.post('/api/payments/verify-payment', data),
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
  getAlerts: (threshold = 30) => api.get(`/api/notifications/alerts?stockThreshold=${threshold}`),
};

export const prescriptionAPI = {
  getAll: () => api.get('/api/prescriptions'),
  save: (data) => api.post('/api/prescriptions', data),
};

export const inventoryAPI = {
  getAllStock: () => api.get('/api/inventory/stock-list'),
  getStockSummary: () => api.get('/api/inventory/stock-summary'),
  getNearExpiry: () => api.get('/api/inventory/near-expiry'),
  getExpired: () => api.get('/api/inventory/expired'),
  getAgingReport: () => api.get('/api/inventory/aging-report'),
  addBatch: (batchData) => api.post('/api/inventory/batch', batchData),
  processReturn: (returnData) => api.post('/api/inventory/returns', returnData),
};

export const handleApiError = (error) => {
  if (error.response) {
    const data = error.response.data;
    const message = typeof data === 'string' ? data : data?.message || error.response.statusText || 'Server error';
    return new Error(message);
  }
  if (error.request) return new Error('Network error. Please check your connection.');
  return new Error(error.message || 'An unexpected error occurred.');
};

export default api;
