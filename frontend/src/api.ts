import axios from "axios";
export const API = import.meta.env.VITE_API || "http://localhost:8000";
export const api = axios.create({ baseURL: API });
