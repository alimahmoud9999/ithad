export interface ParsedInviteCode {
  buildingPrefix: string;
  apartmentNum: string;
}

/**
 * Splits a building / apartment invite code.
 * Handles: BLD-612834 (building code), BLD-612834-3 (apartment invite code), AMAL-12, 12
 */
export function parseInviteCode(code: string): ParsedInviteCode {
  const raw = code.trim().toUpperCase();
  if (!raw) return { buildingPrefix: '', apartmentNum: '' };

  const parts = raw.split('-');
  let buildingPrefix = raw;
  let apartmentNum = '';

  if (parts[0] === 'BLD') {
    if (parts.length >= 3) {
      // e.g. BLD-612834-3 or BLD-612834-12
      buildingPrefix = `${parts[0]}-${parts[1]}`;
      apartmentNum = parts.slice(2).join('-');
    } else {
      // e.g. BLD-612834 (pure building code)
      buildingPrefix = raw;
      apartmentNum = '';
    }
  } else if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    if (/^\d{1,3}$/.test(lastPart)) {
      apartmentNum = lastPart;
      buildingPrefix = parts.slice(0, parts.length - 1).join('-');
    }
  } else if (/^\d{1,3}$/.test(raw)) {
    apartmentNum = raw;
  }

  return { buildingPrefix, apartmentNum };
}
