// Gear types and stats - Each item now has unique effects!
const gearTypes = {
    helmet: {
        tank: { name: 'Millitary Helmet', defense: 20, emoji: '🪖' },
        focus: { name: 'Focus Headband', accuracy: 0.7, emoji: '🎯' },
        vision: { name: 'Night Vision', bulletSpeed: 1.2, emoji: '🔭' },
    },
    vest: {
        armored: { name: 'Armored Vest', defense: 25, emoji: '🛡️' },
        tactical: { name: 'Bandolier', reload: 0.75, emoji: '⚔️' },
    },
    gloves: {
        quick: { name: 'Quick Draw Gloves', reload: 0.65, emoji: '💫' },
        power: { name: 'Power Gloves', damageMult: 1.2, emoji: '💪' },
        tank: { name: 'Millitary Gloves', defense: 15, emoji: '💪' },
        steady: { name: 'Steady Hands', accuracy: 0.5, emoji: '🤝' },
    },
    bag: {
        ammo: { name: 'Ammo Pack', ammoMult: 2, emoji: '🎒' },
        medical: { name: 'Medical Kit', healthRegen: 1.5, emoji: '💊' },
        utility: { name: 'Utility Belt', reload: 0.85, defense: 10, emoji: '🔧' },
    },
    shoes: {
        runner: { name: 'Running Shoes', speed: 1.0, emoji: '👟' },
        tank: { name: 'Millitary Boots', defense: 15, emoji: '🥾' },
        dodge: { name: 'Ninja Boots', speed: 0.6, evasion: 0.15, emoji: '🦘' },
    },
    ammoType: {
        velocity: { name: 'High Velocity', bulletSpeed: 1.4, accuracy: 1.5, emoji: '🚀' },
        hollow: { name: 'Hollow Point', damageMult: 1.15, accuracy: 0.8, emoji: '💥' },
        explosive: { name: 'Explosive', damageMult: 0.85, explosionRadius: 0.5, emoji: '💥' },
        pierce: { name: 'Armor Piercing', damageMult: 1.3, emoji: '🎯' },
        incendiary: { name: 'Incendiary', damageOverTime: 2, damageMult: 1.05, emoji: '🔥' }
    }
};

// Weapon types
const weaponTypes = {
    melee: { name: 'Knife', damage: 15, fireRate: 400, bulletSpeed: 0, color: '#888', spread: 0, ammo: Infinity, range: 80, isMelee: true },
    pistol: { name: 'Pistol', damage: 20, fireRate: 300, bulletSpeed: 8, color: '#888', spread: 0.1, ammo: 60 },
    shotgun: { name: 'Shotgun', damage: 15, fireRate: 700, bulletSpeed: 7, color: '#d4a574', spread: 0.5, bullets: 5, ammo: 250 },
    glock18C: { name: 'Glock18', damage: 10, fireRate: 1000, bulletSpeed: 10, color: '#d4a574', spread: 0.2,  burstCount: 20, burstDelay: 5, ammo: 800},
    dualPistol: { name: 'DualPistol', damage: 20, fireRate: 450, bulletSpeed: 8, color: '#d4a574', spread: 0.2, burstCount: 2, burstDelay: 150, ammo: 120 },
    doubleBarrelShotgun: { name: 'DoubleBarrel', damage: 15, fireRate: 1400, bulletSpeed: 12, color: '#d4a574', spread: 0.75, bullets: 5, burstCount: 2, burstDelay: 120, ammo: 200 },
    combatShotgun: { name: 'CombatShotgun', damage: 20, fireRate: 1000, bulletSpeed: 10, color: '#d4a574', spread: 0.4, bullets: 20, ammo: 200, canRefill: false },
    rifle: { name: 'Rifle', damage: 25, fireRate: 150, bulletSpeed: 12, color: '#4a4a4a', spread: 0.05, ammo: 120 },
    sniper: { name: 'Sniper', damage: 100, fireRate: 1200, bulletSpeed: 15, color: '#2e5c3e', spread: 0.05, ammo: 20 },
    smg: { name: 'SMG', damage: 15, fireRate: 75, bulletSpeed: 9, color: '#5a4fcf', spread: 0.2, ammo: 300 },
    famas: { name: 'FAMAS', damage: 22, fireRate: 600, bulletSpeed: 11, color: '#3a5f8f', spread: 0.08, ammo: 90, burstCount: 3, burstDelay: 80 },
    dmr: { name: 'DMR', damage: 60, fireRate: 500, bulletSpeed: 14, color: '#5d4e37', spread: 0.07, ammo: 40 },
    bmg50: { name: '.50 Cal BMG', damage: 200, fireRate: 1800, bulletSpeed: 25, color: '#8b0000', spread: 0, ammo: 25, penetrating: true, canRefill: false },
    grenadeLauncher: { name: 'Grenade Launcher', damage: 50, fireRate: 1000, bulletSpeed: 6, color: '#2d5016', spread: 0.3, ammo: 15, explosive: true, explosionRadius: 120 },
    rpg: { name: 'Rocket Launcher', damage: 70, fireRate: 2000, bulletSpeed: 7, color: '#2d5016', spread: 0.05, ammo: 15, explosive: true, explosionRadius: 500 }
};

function getRandomGear(type) {
    const gearCategory = gearTypes[type];
    const gearKeys = Object.keys(gearCategory);
    const randomKey = gearKeys[Math.floor(Math.random() * gearKeys.length)];
    return { type: type, ...gearCategory[randomKey], tier: randomKey };
}

function getRandomWeapon(excludePistol = false) {
    const weaponKeys = Object.keys(weaponTypes);
    const availableWeapons = weaponKeys.filter(k => k !== 'pistol' && k !== 'melee' && k !== 'bmg50');
    
    // 5% chance to get the rare .50 cal
    if (Math.random() < 0.05) {
        return { ...weaponTypes.bmg50 };
    }
    
    const randomKey = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
    return { ...weaponTypes[randomKey] };
}
