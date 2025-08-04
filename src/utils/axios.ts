import axios from "axios";

// true: use local Next.js API routes, false: use API Gateway/Lambda
export const isLocal: boolean = true;

const axiosInstance = axios.create({
  baseURL: isLocal
    ? `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api`
    : process.env.NEXT_PUBLIC_APP_API_GW,
  timeout: 10000, // 10 seconds
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export default axiosInstance;
