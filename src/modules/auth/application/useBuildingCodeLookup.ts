import React, { useState, useMemo, useEffect } from 'react';
import { isRemoteBackendEnabled } from '@/data/backend';
import type { Building, Apartment } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import { parseInviteCode } from '../domain/inviteCode';
import { repositories } from '@/data/repositories';

export function useBuildingCodeLookup({ buildingCode, setApartmentNumber, setIsInviteCodeAutoMatched, setShowAllApartments, setFloorNumber, setFullName, setPhone, setMatchedAptDetail, showAllApartments, apartmentNumber }: {
  buildingCode: string;
  setApartmentNumber: React.Dispatch<React.SetStateAction<string>>;
  setIsInviteCodeAutoMatched: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAllApartments: React.Dispatch<React.SetStateAction<boolean>>;
  setFloorNumber: React.Dispatch<React.SetStateAction<string>>;
  setFullName: React.Dispatch<React.SetStateAction<string>>;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  setMatchedAptDetail: React.Dispatch<React.SetStateAction<{ apartmentNumber: string; occupantName?: string | null; occupantPhone?: string | null; floorNumber?: string | null; } | null>>;
  showAllApartments: boolean;
  apartmentNumber: string;
}) {
  const { apartments, buildings } = useAppStore();

  // Remote building and apartment lookup from Supabase for live cross-device verification
  const [remoteBuilding, setRemoteBuilding] = useState<Building | null>(null);
  const [remoteApts, setRemoteApts] = useState<Apartment[]>([]);

  // Robust code parser for any building/apartment invite code
  // Handles: BLD-612834 (building code), BLD-612834-3 (apartment invite code), AMAL-12
  const parsedCodeInfo = useMemo(() => parseInviteCode(buildingCode), [buildingCode]);

  const [suggestedMaskedName, setSuggestedMaskedName] = useState<string | null>(null);

  // Reactively sync apartmentNumber whenever an explicit apartment code is typed
  useEffect(() => {
    if (parsedCodeInfo.apartmentNum) {
      const aptNum = parsedCodeInfo.apartmentNum;
      setApartmentNumber(aptNum);
      setIsInviteCodeAutoMatched(true);
      setShowAllApartments(false);

      // Reactively sync floor and occupant details if known from loaded apartments
      const aptList = remoteApts.length > 0 ? remoteApts : apartments;
      const matchedApt = aptList.find((a) => a.apartment_number === aptNum);
      if (matchedApt) {
        if (matchedApt.floor_number) setFloorNumber(matchedApt.floor_number);
        const occName =
          matchedApt.occupant_name ||
          (matchedApt.resident_name &&
          matchedApt.resident_name !== 'وحدة شاغرة' &&
          matchedApt.resident_name !== 'مشغول'
            ? matchedApt.resident_name
            : '');
        if (occName && !occName.includes('*')) {
          setFullName(occName);
        } else if (occName && occName.includes('*')) {
          setSuggestedMaskedName(occName);
        }
        if (matchedApt.resident_phone || matchedApt.occupant_phone) {
          setPhone(matchedApt.resident_phone || matchedApt.occupant_phone || '');
        }
      } else if (/^\d+$/.test(aptNum)) {
        setFloorNumber(
          aptNum.length >= 2 ? `الدور ${aptNum.slice(0, -1)}` : 'الدور الأول'
        );
      }
    }
  }, [parsedCodeInfo.apartmentNum, remoteApts, apartments]);

  // Lookup target building
  useEffect(() => {
    let isMounted = true;
    const fetchBuilding = async () => {
      const raw = buildingCode.trim().toUpperCase();
      const code = parsedCodeInfo.buildingPrefix || raw;
      const explicitAptNum = parsedCodeInfo.apartmentNum;

      if (code.length >= 4 && isRemoteBackendEnabled) {
        try {
          let { data: rpcData } = await repositories.onboarding.lookupBuildingApartmentsForJoin(code);

          if (!rpcData?.building_id && raw !== code) {
            const fallbackRpc = await repositories.onboarding.lookupBuildingApartmentsForJoin(raw);
            if (fallbackRpc.data?.building_id) {
              rpcData = fallbackRpc.data;
            }
          }

          if (!isMounted) return;

          if (rpcData && rpcData.building_id) {
            const mappedBuilding: Building = {
              id: rpcData.building_id,
              name: rpcData.building_name,
              address: rpcData.building_name,
              city: 'القاهرة',
              building_code: rpcData.building_code,
              admin_id: '',
              fund_balance: 0,
              default_monthly_dues: 350,
              total_apartments: rpcData.apartments?.length || 16,
              plan_code: 'pro',
              subscription_status: 'trial',
              trial_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
              subscription_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
              custom_monthly_price: null,
              max_apartments_override: null,
              features_config: {
                receipt_upload: true,
                emergency_claims: true,
                export_reports: true,
                voting: true,
                maintenance_tickets: true,
                documents_archive: true,
              },
              created_at: new Date().toISOString(),
            };

            const { data: fullBld } = await repositories.onboarding.findBuildingByCode(code);

            if (isMounted) {
              setRemoteBuilding(fullBld ? (fullBld as Building) : mappedBuilding);

              if (rpcData.apartments && rpcData.apartments.length > 0) {
                const mappedApts: Apartment[] = rpcData.apartments.map((a: any) => ({
                  id: a.id,
                  building_id: rpcData.building_id,
                  apartment_number: a.apartment_number,
                  floor_number: a.floor_number || 'الدور الأول',
                  wing_or_direction: a.wing_or_direction || 'واجهة',
                  area_sqm: 150,
                  ownership_share_percent: 10,
                  monthly_dues_override: null,
                  resident_name: a.occupant_name || (a.is_occupied ? 'مشغول' : 'وحدة شاغرة'),
                  resident_phone: a.occupant_phone || '',
                  occupant_name: a.occupant_name,
                  occupant_phone: a.occupant_phone || null,
                  resident_id: a.is_occupied ? 'occupied' : null,
                  invite_code: `${rpcData.building_code}-${a.apartment_number}`,
                  payment_status: 'paid',
                  unpaid_months_count: 0,
                  unpaid_amount: a.arrears_amount || 0,
                  arrears_amount: a.arrears_amount || 0,
                  is_active: true,
                }));
                setRemoteApts(mappedApts);

                const targetAptNum = explicitAptNum || rpcData.suggested_apartment_number;
                if (targetAptNum) {
                  const matchedApt = mappedApts.find((a) => a.apartment_number === targetAptNum);
                  const resolvedName =
                    matchedApt?.occupant_name ||
                    rpcData.suggested_occupant_name ||
                    (matchedApt?.resident_name &&
                    matchedApt.resident_name !== 'وحدة شاغرة' &&
                    matchedApt.resident_name !== 'مشغول'
                      ? matchedApt.resident_name
                      : '');
                  const resolvedPhone =
                    matchedApt?.occupant_phone ||
                    rpcData.suggested_occupant_phone ||
                    matchedApt?.resident_phone ||
                    '';
                  const resolvedFloor =
                    matchedApt?.floor_number ||
                    rpcData.suggested_floor_number ||
                    (targetAptNum && /^\d+$/.test(targetAptNum)
                      ? targetAptNum.length >= 2
                        ? `الدور ${targetAptNum.slice(0, -1)}`
                        : 'الدور الأول'
                      : '');

                  setApartmentNumber(targetAptNum);
                  if (resolvedName && !resolvedName.includes('*')) {
                    setFullName(resolvedName);
                  } else if (resolvedName && resolvedName.includes('*')) {
                    setSuggestedMaskedName(resolvedName);
                  }
                  if (resolvedPhone) setPhone(resolvedPhone);
                  if (resolvedFloor) setFloorNumber(resolvedFloor);
                  setIsInviteCodeAutoMatched(true);
                  setMatchedAptDetail({
                    apartmentNumber: targetAptNum,
                    occupantName: resolvedName || null,
                    occupantPhone: resolvedPhone || null,
                    floorNumber: resolvedFloor || null,
                  });
                }
              }
            }
            return;
          }

          // Fallback direct table query
          const { data } = await repositories.onboarding.findBuildingByCode(code);

          if (isMounted && data) {
            setRemoteBuilding(data as Building);
            const { data: aptsData } = await repositories.onboarding.listBuildingApartments(data.id);
            if (isMounted && aptsData) {
              setRemoteApts(aptsData as Apartment[]);
            }
          }
        } catch {
          // ignore lookup errors
        }
      }
    };

    fetchBuilding();
    return () => {
      isMounted = false;
    };
  }, [buildingCode]);

  // Combined matched building
  const matchedBuilding = useMemo(() => {
    const raw = buildingCode.trim().toUpperCase();
    if (!raw) return null;
    const prefix = parsedCodeInfo.buildingPrefix || raw;

    return (
      buildings.find(
        (b) =>
          b.building_code.toUpperCase() === prefix ||
          b.building_code.toUpperCase() === raw
      ) ||
      (remoteBuilding &&
      (remoteBuilding.building_code.toUpperCase() === prefix ||
        remoteBuilding.building_code.toUpperCase() === raw)
        ? remoteBuilding
        : null)
    );
  }, [buildingCode, parsedCodeInfo.buildingPrefix, buildings, remoteBuilding]);

  // Default units grid simulation if building is verified
  const displayedApartmentGrid = useMemo(() => {
    let allApts: any[] = [];
    if (remoteApts.length > 0) {
      allApts = remoteApts;
    } else if (matchedBuilding) {
      const bldApts = apartments.filter((a) => a.building_id === matchedBuilding.id);
      if (bldApts.length > 0) allApts = bldApts;
    }

    if (allApts.length === 0) {
      const count = matchedBuilding?.total_apartments || 16;
      allApts = Array.from({ length: count }, (_, i) => {
        const numStr = String(i + 1);
        return {
          id: 'apt-' + numStr,
          apartment_number: numStr,
          floor_number: `الدور ${Math.floor(i / 4) + 1}`,
          is_occupied: false,
          resident_name: '',
        };
      });
    }

    // If an apartment number is specified in the code AND user hasn't chosen to show all:
    // Only return that specific apartment! ("يجيبلي شقتي بس")
    if (parsedCodeInfo.apartmentNum && !showAllApartments) {
      const targetNum = parsedCodeInfo.apartmentNum;
      const filtered = allApts.filter((a) => a.apartment_number === targetNum);
      if (filtered.length > 0) {
        return filtered;
      }
      return [
        {
          id: 'apt-' + targetNum,
          apartment_number: targetNum,
          floor_number:
            targetNum.length >= 2
              ? `الدور ${targetNum.slice(0, -1)}`
              : 'الدور الأول',
          is_occupied: false,
          resident_name: '',
        },
      ];
    }

    return allApts;
  }, [
    remoteApts,
    apartments,
    matchedBuilding,
    parsedCodeInfo.apartmentNum,
    showAllApartments,
  ]);

  // Selected Apartment Live Details & Arrears calculation
  const selectedApartmentData = useMemo(() => {
    if (!apartmentNumber.trim()) return null;
    const target = apartmentNumber.trim();
    return (
      remoteApts.find((a) => a.apartment_number === target) ||
      apartments.find(
        (a) =>
          a.apartment_number === target &&
          (!matchedBuilding || a.building_id === matchedBuilding.id)
      ) ||
      null
    );
  }, [apartmentNumber, remoteApts, apartments, matchedBuilding]);

  const selectedAptArrears = useMemo(() => {
    if (!selectedApartmentData) return 0;
    return (
      selectedApartmentData.arrears_amount ||
      selectedApartmentData.unpaid_amount ||
      0
    );
  }, [selectedApartmentData]);

  return {
    remoteBuilding,
    setRemoteBuilding,
    remoteApts,
    setRemoteApts,
    parsedCodeInfo,
    suggestedMaskedName,
    setSuggestedMaskedName,
    matchedBuilding,
    displayedApartmentGrid,
    selectedApartmentData,
    selectedAptArrears,
  };
}
