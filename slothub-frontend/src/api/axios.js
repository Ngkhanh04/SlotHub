import axios from 'axios';

const api = axios.create({
    baseURL: 'https://slothub-toivoa.onrender.com/api',
});

// Tự động đính kèm Token khi gọi API
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;