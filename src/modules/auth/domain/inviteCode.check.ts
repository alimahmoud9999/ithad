// Run: npx tsx src/modules/auth/domain/inviteCode.check.ts
import { parseInviteCode } from './inviteCode';

const eq = (input: string, buildingPrefix: string, apartmentNum: string) => {
  const got = parseInviteCode(input);
  if (got.buildingPrefix !== buildingPrefix || got.apartmentNum !== apartmentNum) {
    throw new Error(`parseInviteCode(${JSON.stringify(input)}) = ${JSON.stringify(got)}`);
  }
};

eq('', '', '');
eq('bld-612834', 'BLD-612834', '');
eq('BLD-612834-3', 'BLD-612834', '3');
eq(' BLD-612834-12 ', 'BLD-612834', '12');
eq('AMAL-12', 'AMAL', '12');
eq('AMAL-TOWER', 'AMAL-TOWER', '');
eq('302', '302', '302');
console.log('inviteCode: ok');
