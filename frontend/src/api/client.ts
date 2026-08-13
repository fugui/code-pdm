import { createApiClient } from '@code/common';

const getBaseUrl = () => {
  if ((window as any).__POWERED_BY_PORTAL__) {
    return '/pdm/api';
  }
  return '/api';
};

const client = createApiClient(getBaseUrl);

export interface FetchOptions {
  method?: string;
  headers?: HeadersInit;
  bodyData?: any;
  [key: string]: any;
}

export const apiFetch = client.apiFetch;
