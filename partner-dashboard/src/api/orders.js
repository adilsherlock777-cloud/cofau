import axios from 'axios';

const API_BASE_URL = 'https://api.cofau.com/api/orders';

// Get PIN from localStorage
const getStoredPin = () => {
  return localStorage.getItem('partnerPin');
};

// Save PIN to localStorage
export const savePin = (pin) => {
  localStorage.setItem('partnerPin', pin);
};

// Clear PIN from localStorage
export const clearPin = () => {
  localStorage.removeItem('partnerPin');
};

// Login with PIN
export const loginWithPin = async (pin) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/partner/login`, { pin });
    if (response.data.success) {
      savePin(pin);
      return { success: true };
    }
    return { success: false, error: response.data.message };
  } catch (error) {
    return { success: false, error: error.response?.data?.message || 'Login failed' };
  }
};

// Get all orders (grouped by status)
export const getAllOrders = async () => {
  const pin = getStoredPin();
  if (!pin) {
    throw new Error('No PIN found. Please login again.');
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/partner/all`, {
      headers: {
        'X-Partner-PIN': pin
      }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      clearPin();
      throw new Error('Invalid PIN. Please login again.');
    }
    throw error;
  }
};

// Update order status
export const updateOrderStatus = async (orderId, status) => {
  const pin = getStoredPin();
  if (!pin) {
    throw new Error('No PIN found. Please login again.');
  }

  try {
    const response = await axios.patch(
      `${API_BASE_URL}/partner/${orderId}/status?status=${status}`,
      {},
      {
        headers: {
          'X-Partner-PIN': pin
        }
      }
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      clearPin();
      throw new Error('Invalid PIN. Please login again.');
    }
    throw error;
  }
};
