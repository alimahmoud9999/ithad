import React, { useState } from 'react';
import type { AuthScreenMode } from '../domain/auth.types';
import { useLoginForm } from '../application/useLoginForm';
import { useSignupForm } from '../application/useSignupForm';
import { useResidentJoinForm } from '../application/useResidentJoinForm';
import { useBuildingRegistrationForm } from '../application/useBuildingRegistrationForm';
import { useBuildingCodeLookup } from '../application/useBuildingCodeLookup';
import { LoginStep } from './components/LoginStep';
import { SignupStep } from './components/SignupStep';
import { ResidentSelectStep } from './components/ResidentSelectStep';
import { AdminRegisterStep } from './components/AdminRegisterStep';
import { CreatedSuccessStep } from './components/CreatedSuccessStep';
import { WelcomeSuccessStep } from './components/WelcomeSuccessStep';

/**
 * Authentication & Onboarding Flow (Track 1)
 * Faithfully implementing all 6 screens from Developer Handover Specs v2.4:
 * - Screen 1: AUTH_LOGIN (design/_12)
 * - Screen 2: AUTH_SIGNUP (design/_26)
 * - Screen 3: ADMIN_REGISTER (design/_30)
 * - Screen 4: RESIDENT_SELECT (design/_6 & _15)
 * - Screen 5: INVITE_LANDING (design/302)
 * - Screen 6: WELCOME_SUCCESS (design/_25)
 *
 * All backend RPCs, Supabase lookup, data matching, and session management are 100% preserved.
 */
export const AuthAndOnboardingScreen: React.FC<{ onClose?: () => void }> = ({
  onClose,
}) => {
  const [mode, setMode] = useState<AuthScreenMode>('login');
  const [selectedRoleTab, setSelectedRoleTab] = useState<'resident' | 'admin'>('resident');

  const loginForm = useLoginForm();

  const signupForm = useSignupForm();
  const {
    setFullName,
    setPhone,
  } = signupForm;

  const joinForm = useResidentJoinForm();
  const {
    buildingCode,
    apartmentNumber,
    setApartmentNumber,
    setFloorNumber,
    setIsInviteCodeAutoMatched,
    setMatchedAptDetail,
    showAllApartments,
    setShowAllApartments,
  } = joinForm;

  const adminForm = useBuildingRegistrationForm();

  const [submitting, setSubmitting] = useState(false);
  const [createdBuildingCode, setCreatedBuildingCode] = useState<string | null>(null);
  const [justSubmittedJoin, setJustSubmittedJoin] = useState(false);

  const lookup = useBuildingCodeLookup({
    buildingCode,
    setApartmentNumber,
    setIsInviteCodeAutoMatched,
    setShowAllApartments,
    setFloorNumber,
    setFullName,
    setPhone,
    setMatchedAptDetail,
    showAllApartments,
    apartmentNumber,
  });

  // --------------------------------------------------------------------------
  // SCREEN 6: WELCOME SUCCESS & DIGITAL MEMBERSHIP CARD (design/_25)
  // --------------------------------------------------------------------------
  if (mode === 'welcome_success') {
    return (
      <WelcomeSuccessStep
        onClose={onClose}
        setMode={setMode}
        signupForm={signupForm}
        joinForm={joinForm}
        lookup={lookup}
      />
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: CREATED BUILDING SUCCESS BANNER & WHATSAPP INVITE (design/302)
  // --------------------------------------------------------------------------
  if (mode === 'created_success' && createdBuildingCode) {
    return (
      <CreatedSuccessStep
        onClose={onClose}
        adminForm={adminForm}
        createdBuildingCode={createdBuildingCode}
      />
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 3: ADMIN REGISTER & BUILDING SETUP (design/_30)
  // --------------------------------------------------------------------------
  if (mode === 'admin_register') {
    return (
      <AdminRegisterStep
        setMode={setMode}
        signupForm={signupForm}
        adminForm={adminForm}
        setSubmitting={setSubmitting}
        submitting={submitting}
        setCreatedBuildingCode={setCreatedBuildingCode}
      />
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 4: RESIDENT SELECT APARTMENT & JOIN (design/_6 & _15)
  // --------------------------------------------------------------------------
  if (mode === 'resident_select') {
    return (
      <ResidentSelectStep
        setMode={setMode}
        loginForm={loginForm}
        signupForm={signupForm}
        joinForm={joinForm}
        setSubmitting={setSubmitting}
        submitting={submitting}
        setJustSubmittedJoin={setJustSubmittedJoin}
        lookup={lookup}
      />
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 2: AUTH SIGNUP (design/_26)
  // --------------------------------------------------------------------------
  if (mode === 'signup') {
    return (
      <SignupStep
        setMode={setMode}
        selectedRoleTab={selectedRoleTab}
        setSelectedRoleTab={setSelectedRoleTab}
        loginForm={loginForm}
        signupForm={signupForm}
      />
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 1: AUTH LOGIN (design/_12) - DEFAULT VIEW
  // --------------------------------------------------------------------------
  return (
    <LoginStep
      onClose={onClose}
      setMode={setMode}
      selectedRoleTab={selectedRoleTab}
      setSelectedRoleTab={setSelectedRoleTab}
      loginForm={loginForm}
      setSubmitting={setSubmitting}
      submitting={submitting}
    />
  );
};

