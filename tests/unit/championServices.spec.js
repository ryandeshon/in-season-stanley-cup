import { beforeEach, describe, expect, it } from 'vitest';
import { ApiClientError } from '@/services/apiClient';
import {
  isContractEndpointUnavailableError,
  shouldUseContractFallback,
} from '@/services/championServices';

describe('championServices endpoint fallback classification', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  it('treats status 0 network/cors errors as contract-unavailable', () => {
    const error = new ApiClientError('Network request failed', {
      status: 0,
      method: 'GET',
      url: 'https://example.com/season/meta?season=season2',
    });

    expect(isContractEndpointUnavailableError(error)).toBe(true);
    expect(shouldUseContractFallback(error)).toBe(true);
  });

  it('treats 404 responses as contract-unavailable', () => {
    const error = new ApiClientError('Request failed with status 404', {
      status: 404,
      method: 'GET',
      url: 'https://example.com/champion/history?season=season2&limit=6',
      details: { message: 'Not Found' },
    });

    expect(isContractEndpointUnavailableError(error)).toBe(true);
    expect(shouldUseContractFallback(error)).toBe(true);
  });

  it('treats missing-auth-token 403 responses as contract-unavailable', () => {
    const error = new ApiClientError('Request failed with status 403', {
      status: 403,
      method: 'GET',
      url: 'https://example.com/champion/history?season=season2&limit=6',
      details: { message: 'MissingAuthenticationTokenException' },
    });

    expect(isContractEndpointUnavailableError(error)).toBe(true);
    expect(shouldUseContractFallback(error)).toBe(true);
  });

  it('does not classify unrelated server errors as contract-unavailable', () => {
    const error = new ApiClientError('Request failed with status 500', {
      status: 500,
      method: 'GET',
      url: 'https://example.com/champion/history?season=season2&limit=6',
      details: { error: 'Internal Server Error' },
    });

    expect(isContractEndpointUnavailableError(error)).toBe(false);
    expect(shouldUseContractFallback(error)).toBe(false);
  });
});
