const API_BASE_URL = "https://nbepmasgfnqojtzmiprd.supabase.co/functions/v1";

// Helper function to handle API requests
const fetchApi = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error?.message || 'Something went wrong');
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Helper for POST requests with JSON body
export const postJson = async (endpoint, data) => {
  return fetchApi(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// Auth API
export const authApi = {
  signUp: (email, password) => 
    postJson('/auth/signup', { email, password }),
  
  signIn: (email, password) =>
    postJson('/auth/login', { email, password }),
};

// Headshot API
export const headshotApi = {
  generateHeadshot: (imageData, options = {}) =>
    postJson('/headshot/generate', { imageData, ...options }),
  
  getHistory: () =>
    fetchApi('/headshot/history'),
};

// Credits API
export const creditsApi = {
  getBalance: () =>
    fetchApi('/credits/balance'),
  
  addCredits: (amount) =>
    postJson('/credits/add', { amount }),
};
