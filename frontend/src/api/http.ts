import axios from "axios";
import { ElMessage } from "element-plus";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";

/** 后端统一响应结构：{ code, message, data }，见设计文档第 9 章 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 10000,
});

// 请求拦截：注入 JWT
http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

// 响应拦截：解包 { code, message, data }，统一处理错误与 401
http.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResponse;
    if (body.code !== 0) {
      ElMessage.error(body.message || "请求失败");
      return Promise.reject(new Error(body.message));
    }
    // 拦截器把 AxiosResponse 解包为业务数据；axios 类型不允许改变返回类型，此处用 any 过渡
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return body.data as any;
  },
  (err) => {
    const body = err.response?.data as ApiResponse | undefined;
    if (body?.code === 40101) {
      useAuthStore().logout();
      router.push({
        path: "/login",
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
    ElMessage.error(body?.message || err.message || "网络错误");
    return Promise.reject(err);
  },
);

export default http;
