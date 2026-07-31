import axios from 'axios';

interface ErrorResponse {
  error?: string;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    const status = error.response?.status;
    const detail = error.response?.data?.error || error.message || fallback;
    if (status === 400 || status === 403 || status === 409) return `${detail} (HTTP ${status})`;
    return detail || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export function hasHttpStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status;
}
