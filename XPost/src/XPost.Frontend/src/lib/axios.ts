import axios from 'axios';
import toast from 'react-hot-toast';

export const API_BASE_URL = import.meta.env.VITE_API_URL || (() => {
    if (import.meta.env.PROD) return '';
    const { hostname, protocol, origin } = window.location;
    if (hostname.includes('ngrok-free.dev') || hostname.includes('vercel.app') || hostname.includes('mangxuyenviet.vn')) {
        return origin;
    }
    if (hostname === 'local.xpost.com') {
        return `${protocol}//local-api.xpost.com:5243`;
    }
    return `${protocol}//${hostname}:5243`;
})();

const api = axios.create({
    baseURL: `${API_BASE_URL}/api`, // Matches launchSettings.json profile
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Skip ngrok browser warning page for API calls
    config.headers['ngrok-skip-browser-warning'] = 'true';
    return config;
});

let isRedirecting = false;
let isLoggingOut = false;

export const setLoggingOut = () => { isLoggingOut = true; };

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            // Bỏ qua nếu đang logout chủ động
            if (isLoggingOut) return new Promise(() => { });

            // Don't redirect to login if we're already on the login/register endpoint
            const requestUrl = error.config?.url || '';
            if (!requestUrl.includes('/auth/login') && !requestUrl.includes('/auth/register')) {
                if (!isRedirecting) {
                    isRedirecting = true;
                    localStorage.removeItem('token');
                    const msg = error.response?.data?.message || 'Phiên đăng nhập đã hết hạn hoặc tài khoản bị khóa.';
                    toast.error(msg, { duration: 3000 });

                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 1500);
                }

                // Return a never-resolving promise to prevent local catch blocks from firing
                // and throwing duplicate error toasts while redirecting
                return new Promise(() => { });
            }
        }
        return Promise.reject(error);
    }
);

export default api;
