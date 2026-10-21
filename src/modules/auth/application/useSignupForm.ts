import { useState } from 'react';

export function useSignupForm() {
  // Sign Up Form State (Screen 2: AUTH_SIGNUP - _26)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  return {
    fullName,
    setFullName,
    email,
    setEmail,
    phone,
    setPhone,
    signupPassword,
    setSignupPassword,
  };
}
