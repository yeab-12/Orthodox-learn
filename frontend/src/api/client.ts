import axios from "axios";

export const TOKEN_KEY = "tewahedo_token";

export const api = axios.create({
  baseURL: "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string" && message) return message;
    if (error.code === "ERR_NETWORK") return "Cannot reach the server. Make sure the API is running.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

/** Media files are served from the same origin through the Vite proxy. */
export function mediaUrl(path: string | null | undefined) {
  return path || null;
}
