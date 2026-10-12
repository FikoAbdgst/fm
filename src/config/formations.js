// Slot formasi: 11 slot pemain + 1 slot pelatih.
// accepts = subPosition yang cocok penuh; adjacent = cocok parsial (x0.95).
const DEF_4 = [
  { slotId: 'LB', accepts: ['LB', 'LWB'], adjacent: ['CB'], group: 'DEF' },
  { slotId: 'CB1', accepts: ['CB'], adjacent: ['LB', 'RB', 'CDM'], group: 'DEF' },
  { slotId: 'CB2', accepts: ['CB'], adjacent: ['LB', 'RB', 'CDM'], group: 'DEF' },
  { slotId: 'RB', accepts: ['RB', 'RWB'], adjacent: ['CB'], group: 'DEF' },
];

export const FORMATION_SLOTS = {
  '4-3-3': [
    { slotId: 'GK', accepts: ['GK'], adjacent: [], group: 'GK' },
    ...DEF_4,
    { slotId: 'CM1', accepts: ['CM', 'CDM', 'CAM'], adjacent: ['CDM', 'CAM'], group: 'MID' },
    { slotId: 'CM2', accepts: ['CM', 'CDM', 'CAM'], adjacent: ['CDM', 'CAM'], group: 'MID' },
    { slotId: 'CM3', accepts: ['CM', 'CDM', 'CAM'], adjacent: ['CDM', 'CAM'], group: 'MID' },
    { slotId: 'LW', accepts: ['LW', 'LM'], adjacent: ['ST', 'RW'], group: 'FWD' },
    { slotId: 'ST', accepts: ['ST', 'CF'], adjacent: ['LW', 'RW', 'CAM'], group: 'FWD' },
    { slotId: 'RW', accepts: ['RW', 'RM'], adjacent: ['ST', 'LW'], group: 'FWD' },
  ],
  '4-4-2': [
    { slotId: 'GK', accepts: ['GK'], adjacent: [], group: 'GK' },
    ...DEF_4,
    { slotId: 'LM', accepts: ['LM', 'LW'], adjacent: ['CM', 'LB'], group: 'MID' },
    { slotId: 'CM1', accepts: ['CM', 'CDM'], adjacent: ['CAM'], group: 'MID' },
    { slotId: 'CM2', accepts: ['CM', 'CDM'], adjacent: ['CAM'], group: 'MID' },
    { slotId: 'RM', accepts: ['RM', 'RW'], adjacent: ['CM', 'RB'], group: 'MID' },
    { slotId: 'ST1', accepts: ['ST', 'CF'], adjacent: ['CAM'], group: 'FWD' },
    { slotId: 'ST2', accepts: ['ST', 'CF'], adjacent: ['CAM'], group: 'FWD' },
  ],
  '4-2-3-1': [
    { slotId: 'GK', accepts: ['GK'], adjacent: [], group: 'GK' },
    ...DEF_4,
    { slotId: 'CDM1', accepts: ['CDM', 'CM'], adjacent: ['CM'], group: 'MID' },
    { slotId: 'CDM2', accepts: ['CDM', 'CM'], adjacent: ['CM'], group: 'MID' },
    { slotId: 'LM', accepts: ['LM', 'LW', 'CAM'], adjacent: ['CM'], group: 'MID' },
    { slotId: 'CAM', accepts: ['CAM', 'CM'], adjacent: ['ST', 'CM'], group: 'MID' },
    { slotId: 'RM', accepts: ['RM', 'RW', 'CAM'], adjacent: ['CM'], group: 'MID' },
    { slotId: 'ST', accepts: ['ST', 'CF'], adjacent: ['CAM'], group: 'FWD' },
  ],
  '3-5-2': [
    { slotId: 'GK', accepts: ['GK'], adjacent: [], group: 'GK' },
    { slotId: 'CB1', accepts: ['CB'], adjacent: ['CDM'], group: 'DEF' },
    { slotId: 'CB2', accepts: ['CB'], adjacent: ['CDM'], group: 'DEF' },
    { slotId: 'CB3', accepts: ['CB'], adjacent: ['CDM'], group: 'DEF' },
    { slotId: 'LM', accepts: ['LM', 'LWB', 'LW'], adjacent: ['CM'], group: 'MID' },
    { slotId: 'CM1', accepts: ['CM', 'CDM'], adjacent: ['CAM'], group: 'MID' },
    { slotId: 'CM2', accepts: ['CM', 'CDM'], adjacent: ['CAM'], group: 'MID' },
    { slotId: 'CM3', accepts: ['CM', 'CDM', 'CAM'], adjacent: ['CM'], group: 'MID' },
    { slotId: 'RM', accepts: ['RM', 'RWB', 'RW'], adjacent: ['CM'], group: 'MID' },
    { slotId: 'ST1', accepts: ['ST', 'CF'], adjacent: ['CAM'], group: 'FWD' },
    { slotId: 'ST2', accepts: ['ST', 'CF'], adjacent: ['CAM'], group: 'FWD' },
  ],
  '5-3-2': [
    { slotId: 'GK', accepts: ['GK'], adjacent: [], group: 'GK' },
    { slotId: 'LWB', accepts: ['LWB', 'LB', 'LM'], adjacent: ['CB'], group: 'DEF' },
    { slotId: 'CB1', accepts: ['CB'], adjacent: ['CDM'], group: 'DEF' },
    { slotId: 'CB2', accepts: ['CB'], adjacent: ['CDM'], group: 'DEF' },
    { slotId: 'CB3', accepts: ['CB'], adjacent: ['CDM'], group: 'DEF' },
    { slotId: 'RWB', accepts: ['RWB', 'RB', 'RM'], adjacent: ['CB'], group: 'DEF' },
    { slotId: 'CM1', accepts: ['CM', 'CDM'], adjacent: ['CAM'], group: 'MID' },
    { slotId: 'CM2', accepts: ['CM', 'CDM', 'CAM'], adjacent: ['CM'], group: 'MID' },
    { slotId: 'CM3', accepts: ['CM', 'CDM'], adjacent: ['CAM'], group: 'MID' },
    { slotId: 'ST1', accepts: ['ST', 'CF'], adjacent: ['CAM'], group: 'FWD' },
    { slotId: 'ST2', accepts: ['ST', 'CF'], adjacent: ['CAM'], group: 'FWD' },
  ],
};

export const COACH_SLOT = { slotId: 'COACH', role: 'COACH', group: 'COACH' };

export function slotsFor(formation) {
  const base = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3'];
  return [...base, COACH_SLOT];
}
