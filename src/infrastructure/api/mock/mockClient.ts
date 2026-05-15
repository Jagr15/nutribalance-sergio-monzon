// src/infrastructure/api/mock/mockClient.ts
export const mockApiCall = <T>(data: T, delay = 800): Promise<T> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(data);
      }, delay);
    });
  };