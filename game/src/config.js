// Neon Tide — shared numbers: the size of Port Solana, its street grid, the
// tuning for feet, wheels and tempers, and the colours the city wears.
// Everything else in src/ reads its constants from here so the whole game
// can be rebalanced from one file.

// ---- The world ------------------------------------------------------------
export const WORLD_W = 3600;
export const WORLD_H = 2600;
/** The bay fills everything west of this x; the beach runs along it. */
export const WATER_X = 300;
export const BEACH_X = 392;
/** Centre lines of the avenues (vertical) and streets (horizontal). */
export const ROADS_X = [470, 1070, 1670, 2270, 2870, 3380];
export const ROADS_Y = [420, 1020, 1620, 2220];
export const ROAD_W = 96;
/** Sidewalks run this far out from a road's centre line. */
export const SIDEWALK_OFF = ROAD_W / 2 + 16;

// ---- The fixed simulation step -------------------------------------------
export const STEP = 1 / 60;

// ---- The player ------------------------------------------------------------
export const PLAYER_RADIUS = 11;
export const WALK_SPEED = 178;
export const SPRINT_SPEED = 268;
export const PLAYER_HEALTH = 100;
/** Seconds between pistol shots while the trigger is held. */
export const FIRE_INTERVAL = 0.16;
export const BULLET_SPEED = 760;
export const BULLET_RANGE = 460;
export const BULLET_DAMAGE = 22;

// ---- Wanted heat -------------------------------------------------------------
/** Heat is a float; the star count on the HUD is its ceiling, 0..5. */
export const HEAT_MAX = 5;
export const HEAT_PER_SHOT = 0.22;
export const HEAT_PER_PED_DOWN = 1.0;
export const HEAT_PER_COP_DOWN = 1.6;
export const HEAT_PER_PED_HIT_BY_CAR = 0.9;
export const HEAT_PER_THEFT = 0.55;
/** Heat bleeds off at this rate once no officer has eyes on the player. */
export const HEAT_DECAY = 0.085;
/** Seconds without being seen before the bleed starts. */
export const HEAT_HIDE_DELAY = 5;

// ---- Palette: sun-soaked Port Solana -----------------------------------------
export const COLORS = {
  water: '#177e8c',
  waterDeep: '#0f5f74',
  sand: '#ecd39e',
  grass: '#7fb069',
  parkPath: '#d9c9a3',
  pavement: '#c9c2b4',
  sidewalk: '#ded7c8',
  road: '#3a3f47',
  roadEdge: '#2e3238',
  lane: '#f2cf6b',
  crosswalk: '#e8e4da',
  palmTrunk: '#8a6b45',
  palmLeaf: '#3e8914',
  playerBody: '#0e7c86',
  playerSkin: '#e8b08a',
  cash: '#57cc5e',
  markerStory: '#ffd166',
  markerCourier: '#57cc5e',
  markerObjective: '#ff5d8f',
};

/** Roof colours, picked per building: pastel stucco under a hard sun. */
export const ROOF_COLORS = [
  '#f2a65a', '#e76f51', '#f4d35e', '#ee964b', '#90be6d',
  '#43aa8b', '#577590', '#f28482', '#84a59d', '#e07a5f',
  '#e9c46a', '#2a9d8f',
];

// ---- Cars ----------------------------------------------------------------------
export const CAR_TYPES = {
  sedan: { label: 'Marlin Sedan',     length: 46, width: 22, accel: 210, topSpeed: 305, grip: 7.5 },
  taxi:  { label: 'Solana Cab',       length: 46, width: 22, accel: 205, topSpeed: 295, grip: 7.5 },
  sport: { label: 'Comet GT',         length: 44, width: 21, accel: 320, topSpeed: 430, grip: 8.5 },
  van:   { label: 'Brisa Van',        length: 54, width: 24, accel: 165, topSpeed: 250, grip: 6.5 },
  truck: { label: 'Hauler Pickup',    length: 52, width: 24, accel: 185, topSpeed: 265, grip: 6.8 },
  cop:   { label: 'PSPD Interceptor', length: 47, width: 22, accel: 300, topSpeed: 415, grip: 8.2 },
};
export const CAR_PAINTS = ['#d64550', '#3e7cb1', '#f2f0e6', '#264653', '#e9c46a', '#6a994e', '#bc6c25', '#7209b7', '#118ab2', '#ef476f', '#8d99ae', '#06d6a0'];

// ---- People ----------------------------------------------------------------------
export const PED_SHIRTS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c77dff', '#90be6d', '#e9e4da', '#577590', '#e07a5f'];
export const PED_NAMES = ['Ana', 'Bruno', 'Carmen', 'Diego', 'Elena', 'Felix', 'Gabi', 'Hugo', 'Ines', 'Jorge', 'Kira', 'Luis', 'Marta', 'Pablo', 'Rosa', 'Tomas', 'Uma', 'Vera'];

// ---- Storage ----------------------------------------------------------------------
export const SAVE_KEY = 'neontide-save-v1';
