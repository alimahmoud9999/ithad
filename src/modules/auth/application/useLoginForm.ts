import { useState } from 'react';

export function useLoginForm() {
  // Login Form State (Screen 1: AUTH_LOGIN - _12)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  return {
    loginIdentifier,
    setLoginIdentifier,
    loginPassword,
    setLoginPassword,
    showPassword,
    setShowPassword,
    rememberMe,
    setRememberMe,
  };
}
