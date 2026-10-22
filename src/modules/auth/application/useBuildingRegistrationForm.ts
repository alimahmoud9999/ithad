import { useState, useMemo } from 'react';

export function useBuildingRegistrationForm() {
  // Admin Register & Building Setup (Screen 3: ADMIN_REGISTER - _30)
  const [buildingName, setBuildingName] = useState('برج الأمل السكني');
  const [buildingAddress, setBuildingAddress] = useState('التجمع الخامس - النرجس عمارات ٨٤');
  const [totalApartments, setTotalApartments] = useState('16');
  const [defaultMonthlyDues, setDefaultMonthlyDues] = useState('400');
  const [adminApartment, setAdminApartment] = useState('12');
  const [treasuryAccount, setTreasuryAccount] = useState('elamal.tower@instapay');
  const [legalDeclaration, setLegalDeclaration] = useState(true);

  // Calculate live projected monthly treasury collection (Screen 30)
  const projectedMonthlyTreasury = useMemo(() => {
    const count = parseInt(totalApartments, 10) || 0;
    const due = parseFloat(defaultMonthlyDues) || 0;
    return (count * due).toLocaleString('en-US');
  }, [totalApartments, defaultMonthlyDues]);

  return {
    buildingName,
    setBuildingName,
    buildingAddress,
    setBuildingAddress,
    totalApartments,
    setTotalApartments,
    defaultMonthlyDues,
    setDefaultMonthlyDues,
    adminApartment,
    setAdminApartment,
    treasuryAccount,
    setTreasuryAccount,
    legalDeclaration,
    setLegalDeclaration,
    projectedMonthlyTreasury,
  };
}
