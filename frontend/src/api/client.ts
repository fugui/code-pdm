// 自适应 API 请求客户端
const getBaseUrl = () => {
  if ((window as any).__POWERED_BY_PORTAL__) {
    return '/pdm/api';
  }
  return '/api';
};

export interface FetchOptions extends RequestInit {
  bodyData?: any;
}

export const apiFetch = async (endpoint: string, options: FetchOptions = {}) => {
  const token = localStorage.getItem('code_shield_token');
  
  const headers: HeadersInit = {
    ...(options.bodyData ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const config: RequestInit = {
    ...options,
    headers
  };

  if (options.bodyData) {
    config.body = JSON.stringify(options.bodyData);
  }

  const response = await fetch(`${getBaseUrl()}${endpoint}`, config);

  // 处理 204 No Content
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || '请求失败，请稍后重试');
  }

  return data;
};
