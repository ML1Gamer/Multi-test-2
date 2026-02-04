// Game constants
const ROOM_WIDTH = 800;
const ROOM_HEIGHT = 600;
const DOOR_SIZE = 80;
const GRID_SIZE = 5;

// Difficulty settings
const DIFFICULTY = {
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard',
    IMPOSSIBLE: 'impossible'
};

const DIFFICULTY_MODIFIERS = {
    easy: {
        enemyHealthMult: 0.5,
        enemyDamageMult: 0.5,
        shopPriceMult: 0.5,
        dropRateMult: 2.0,
        displayName: 'EASY'
    },
    normal: {
        enemyHealthMult: 1.0,
        enemyDamageMult: 1.0,
        shopPriceMult: 1.0,
        dropRateMult: 1.0,
        displayName: 'NORMAL'
    },
    hard: {
        enemyHealthMult: 2.0,
        enemyDamageMult: 2.0,
        shopPriceMult: 1,
        dropRateMult: 0.5,
        displayName: 'HARD'
    },
    impossible: {
        enemyHealthMult: 2.0,
        enemyDamageMult: 2.0,
        shopPriceMult: 1,
        dropRateMult: 1,
        displayName: 'IMPOSSIBLE',
        oneHPMode: true,
        noNormalEnemyAmmo: true
    }
};

// Enemy types
const ENEMY_TYPES = {
    CHASER: 'chaser',
    WANDERER: 'wanderer',
    SHOOTER: 'shooter',
    BOSS: 'boss',
    // New enemy types
    DASHER: 'dasher',
    NECROMANCER: 'necromancer',
    SUMMONED: 'summoned' // Enemies summoned by necromancer
};

// Room types
const ROOM_TYPES = {
    NORMAL: 'normal',
    START: 'start',
    BOSS: 'boss',
    TREASURE: 'treasure',
    KEY: 'key',
    SHOP: 'shop',
    GUN: 'gun',
    MINIBOSS: 'miniboss' // New mini-boss room type
};

// Mini-boss types
const MINIBOSS_TYPES = {
    DASHER: 'dasher',
    NECROMANCER: 'necromancer'
};
