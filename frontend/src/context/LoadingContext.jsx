import React, { createContext, useContext, useState } from 'react';

const LoadingContext = createContext();

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export const LoadingProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [globalError, setGlobalError] = useState(null);

  const showLoading = (message = 'Loading...') => {
    setLoadingMessage(message);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  const showError = (error) => {
    setGlobalError(error);
    setTimeout(() => setGlobalError(null), 5000); // Auto-hide after 5 seconds
  };

  const clearError = () => {
    setGlobalError(null);
  };

  const value = {
    isLoading,
    loadingMessage,
    globalError,
    showLoading,
    hideLoading,
    showError,
    clearError,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export default LoadingContext;
