import { useState } from 'react';

export function useResidentJoinForm() {
  // Resident Join / Select State (Screen 4: RESIDENT_SELECT - _6 / _15)
  const [buildingCode, setBuildingCode] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [residentRoleType, setResidentRoleType] = useState<'مالك مقيم' | 'مستأجر'>('مالك مقيم');
  const [dismissedAptMatch, setDismissedAptMatch] = useState(false);
  const [isInviteCodeAutoMatched, setIsInviteCodeAutoMatched] = useState(false);
  const [matchedAptDetail, setMatchedAptDetail] = useState<{
    apartmentNumber: string;
    occupantName?: string | null;
    occupantPhone?: string | null;
    floorNumber?: string | null;
  } | null>(null);

  // Resident Account Credentials (Password x2) & Arrears Transfer
  const [residentPassword, setResidentPassword] = useState('');
  const [residentConfirmPassword, setResidentConfirmPassword] = useState('');
  const [showResidentPassword, setShowResidentPassword] = useState(false);
  const [acceptArrearsTransfer, setAcceptArrearsTransfer] = useState(true);
  const [showAllApartments, setShowAllApartments] = useState(false);

  return {
    buildingCode,
    setBuildingCode,
    apartmentNumber,
    setApartmentNumber,
    floorNumber,
    setFloorNumber,
    residentRoleType,
    setResidentRoleType,
    dismissedAptMatch,
    setDismissedAptMatch,
    isInviteCodeAutoMatched,
    setIsInviteCodeAutoMatched,
    matchedAptDetail,
    setMatchedAptDetail,
    residentPassword,
    setResidentPassword,
    residentConfirmPassword,
    setResidentConfirmPassword,
    showResidentPassword,
    setShowResidentPassword,
    acceptArrearsTransfer,
    setAcceptArrearsTransfer,
    showAllApartments,
    setShowAllApartments,
  };
}
