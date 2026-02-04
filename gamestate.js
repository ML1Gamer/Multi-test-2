// Canvas setup - will be initialized when DOM is ready
let canvas, ctx, minimapCanvas, minimapCtx;

// Game state
const game = {
    difficulty: 'normal',
    paused: false,
    player: {
        x: 400,
        y: 300,
        size: 20,
        health: 100,
        maxHealth: 100,
        speed: 5,
        angle: 0,
        level: 1,
        score: 0,
        money: 0,
        weapons: [],
        currentWeaponIndex: 0,
        hasKey: false,
        gear: {
            helmet: null,
            vest: null,
            gloves: null,
            bag: null,
            shoes: null,
            ammoType: null
        }
    },
    currentRoom: null,
    rooms: [],
    enemies: [],
    enemyBullets: [],
    bullets: [],
    items: [],
    particles: [],
    walls: [],
    doors: [],
    keys: {},
    mouseX: 400,
    mouseY: 300,
    lastShot: 0,
    transitioning: false,
    nearDoor: null,
    gridX: 2,
    gridY: 2,
    visitedRooms: new Set(),
    shopOpen: false,
    burstQueue: [],
    enemySpawnIndicators: []
};

// Initialize player with melee and pistol
game.player.weapons.push({ ...weaponTypes.melee });
game.player.weapons.push({ ...weaponTypes.pistol });
game.player.currentWeaponIndex = 1; // Start with pistol
