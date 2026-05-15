import React from 'react';
import AppRouter from '../router/AppRouter';

export const AppProvider: React.FC = () => {
  return (
    // Si más adelante agregas AuthContext o ThemeContext, envolverán al AppRouter
    <AppRouter />
  );
};