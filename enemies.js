// Enemy spawning and AI
function spawnBoss(room) {
    // Add boss spawn indicator
    game.enemySpawnIndicators.push({
        x: ROOM_WIDTH / 2,
        y: 150,
        type: ENEMY_TYPES.BOSS,
        spawnTime: Date.now() + 2000, // Boss spawns after 2 seconds
        radius: 0,
        isBoss: true
    });
    
    // Lock doors immediately when boss spawn indicator appears
    game.doors.forEach(door => door.blocked = true);
    
    // Play boss music
    createMusicLoop('boss_spawn');
    
    // Broadcast spawn indicators to other players
    if (multiplayer.enabled && multiplayer.isHost) {
        sendSpawnIndicators();
    }
}

// Spawn mini-boss function
function spawnMiniBoss(type) {
    // In multiplayer, only host spawns mini-bosses
    if (multiplayer.enabled && !multiplayer.isHost) {
        return; // Non-hosts will receive the mini-boss via enemy sync
    }
    
    const modifier = getDifficultyModifier();
    
    game.doors.forEach(door => door.blocked = true);
    createMusicLoop('boss_spawn');
    
    if (type === MINIBOSS_TYPES.DASHER) {
        const baseHealth = 1000 + game.player.level * 100;
        const dasher = {
            x: ROOM_WIDTH / 2,
            y: 150,
            size: 30,
            health: baseHealth * modifier.enemyHealthMult,
            maxHealth: baseHealth * modifier.enemyHealthMult,
            speed: 2,
            color: '#ff4500',
            type: ENEMY_TYPES.DASHER,
            // Dasher-specific properties
            state: 'idle', // idle, windup, dashing, cooldown
            windupTime: 0,
            dashStartTime: 0,
            dashDirection: { x: 0, y: 0 },
            dashSpeed: 15,
            windupDuration: 600,
            dashDuration: 400,        // how long the dash lasts in ms
            postDashCooldown: 800,    // cooldown after a dash before next cycle
            dashCooldown: 1500,       // minimum ms between dash cycles
            lastDash: 0
        };
        game.enemies.push(dasher);
        createParticles(dasher.x, dasher.y, '#ff4500', 30);
        playEnemySpawnSound();
    } else if (type === MINIBOSS_TYPES.NECROMANCER) {
        const baseHealth = 1400 + game.player.level * 140;
        const necromancer = {
            x: ROOM_WIDTH / 2,
            y: 150,
            size: 28,
            health: baseHealth * modifier.enemyHealthMult,
            maxHealth: baseHealth * modifier.enemyHealthMult,
            speed: 1.2,
            color: '#800080',
            type: ENEMY_TYPES.NECROMANCER,
            // Necromancer-specific properties
            lastSummon: Date.now(),
            summonCooldown: 5000, // 10 seconds
            minions: [], // Track summoned minions
            healPerKill: 30 + game.player.level * 30
        };
        game.enemies.push(necromancer);
        createParticles(necromancer.x, necromancer.y, '#800080', 30);
        playEnemySpawnSound();
    }
}

function spawnEnemiesInRoom(room) {
    const numEnemies = Math.floor(Math.random() * 5) + 4;
    
    const spawnPoints = [
        { x: 100, y: 100 },
        { x: ROOM_WIDTH - 100, y: 100 },
        { x: 100, y: ROOM_HEIGHT - 100 },
        { x: ROOM_WIDTH - 100, y: ROOM_HEIGHT - 100 },
        { x: ROOM_WIDTH / 2, y: 100 },
        { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - 100 },
        { x: 100, y: ROOM_HEIGHT / 2 },
        { x: ROOM_WIDTH - 100, y: ROOM_HEIGHT / 2 }
    ];

    // Create spawn indicators
    for (let i = 0; i < numEnemies; i++) {
        const point = spawnPoints[i % spawnPoints.length];
        const spawnX = point.x + (Math.random() - 0.5) * 40;
        const spawnY = point.y + (Math.random() - 0.5) * 40;
        
        const rand = Math.random();
        let type;
        if (rand > 0.7) {
            type = ENEMY_TYPES.SHOOTER;
        } else if (rand > 0.4) {
            type = ENEMY_TYPES.WANDERER;
        } else {
            type = ENEMY_TYPES.CHASER;
        }
        
        // Add spawn indicator
        game.enemySpawnIndicators.push({
            x: spawnX,
            y: spawnY,
            type: type,
            spawnTime: Date.now() + 1500, // Spawn after 1.5 seconds
            radius: 0
        });
    }

    // Lock doors immediately when spawn indicators appear
    game.doors.forEach(door => door.blocked = true);
    
    // Broadcast spawn indicators to other players
    if (multiplayer.enabled && multiplayer.isHost) {
        sendSpawnIndicators();
    }
}

function spawnEnemy(x, y, type) {
    const modifier = getDifficultyModifier();
    const baseHealth = 30 + game.player.level * 5;
    
    const enemy = {
        x: x,
        y: y,
        size: 18,
        health: baseHealth * modifier.enemyHealthMult,
        maxHealth: baseHealth * modifier.enemyHealthMult,
        speed: type === ENEMY_TYPES.SHOOTER ? 0.8 : (type === ENEMY_TYPES.WANDERER ? 1.2 : 1.0),
        color: type === ENEMY_TYPES.SHOOTER ? '#ff6b6b' : (type === ENEMY_TYPES.WANDERER ? '#4ecdc4' : '#95e1d3'),
        type: type,
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTimer: 0,
        lastShot: 0
    };
    game.enemies.push(enemy);
}

// Summoned enemy (for necromancer)
function spawnSummonedEnemy(x, y, type, necromancer) {
    const modifier = getDifficultyModifier();
    const baseHealth = 50 + game.player.level * 10;
    
    const enemy = {
        x: x,
        y: y,
        size: 16,
        health: baseHealth * modifier.enemyHealthMult,
        maxHealth: baseHealth * modifier.enemyHealthMult,
        speed: type === ENEMY_TYPES.SHOOTER ? 0.8 : 1.0,
        color: type === ENEMY_TYPES.SHOOTER ? '#ff99cc' : '#cc99ff',
        type: ENEMY_TYPES.SUMMONED,
        actualType: type, // Store actual behavior type
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTimer: 0,
        lastShot: 0,
        master: necromancer // Reference to necromancer
    };
    game.enemies.push(enemy);
    necromancer.minions.push(enemy);
    createParticles(x, y, enemy.color, 15);
    playEnemySpawnSound();
}

function handleEnemyDeath(enemy) {
    const modifier = getDifficultyModifier();
    const index = game.enemies.indexOf(enemy);
    if (index > -1) {
        game.enemies.splice(index, 1);
        
        // If this was a summoned minion, heal the necromancer
        if (enemy.type === ENEMY_TYPES.SUMMONED && enemy.master) {
            enemy.master.health = Math.min(enemy.master.maxHealth, enemy.master.health + enemy.master.healPerKill);
            createParticles(enemy.master.x, enemy.master.y, '#00ff00', 20);
            
            // Remove from minions list
            const minionIndex = enemy.master.minions.indexOf(enemy);
            if (minionIndex > -1) {
                enemy.master.minions.splice(minionIndex, 1);
            }
        }
        
        // Play death sound
        playEnemyDeathSound(enemy.type === ENEMY_TYPES.BOSS || enemy.type === ENEMY_TYPES.DASHER || enemy.type === ENEMY_TYPES.NECROMANCER);
        
        // Mini-boss drops special loot
        if (enemy.type === ENEMY_TYPES.DASHER || enemy.type === ENEMY_TYPES.NECROMANCER) {
            game.player.score += 150;
            createParticles(enemy.x, enemy.y, enemy.color, 40);
            
            // Drop weapon
            const miniBossWeapon = getRandomWeapon(true);
            game.items.push({
                x: enemy.x - 80,
                y: enemy.y,
                type: 'weapon',
                data: miniBossWeapon,
                size: 15
            });
            
            // Drop money
            const moneyAmount = Math.floor(Math.random() * 150) + 150;
            game.items.push({
                x: enemy.x - 30,
                y: enemy.y,
                type: 'money',
                amount: moneyAmount,
                size: 10
            });
            
            // Drop ammo
            const ammoAmount = Math.floor(Math.random() * 75) + 75;
            game.items.push({
                x: enemy.x + 30,
                y: enemy.y,
                type: 'ammo',
                amount: ammoAmount,
                size: 12
            });
            
            // Drop health powerup
            game.items.push({
                x: enemy.x + 80,
                y: enemy.y,
                type: 'powerup',
                data: 'health',
                size: 15
            });
            
            // Drop random gear
            const gearSlots = ['helmet', 'vest', 'gloves', 'bag', 'shoes', 'ammoType'];
            const randomSlot = gearSlots[Math.floor(Math.random() * gearSlots.length)];
            const newGear = getRandomGear(randomSlot);
            game.items.push({
                x: enemy.x,
                y: enemy.y + 50,
                type: 'gear',
                data: newGear,
                size: 18
            });
        }
        // Boss drops special loot
        else if (enemy.type === ENEMY_TYPES.BOSS) {
            game.player.score += 100;
            createParticles(enemy.x, enemy.y, enemy.color, 30);
            
            // Drop weapon
            const bossWeapon = getRandomWeapon(true);
            game.items.push({
                x: enemy.x - 60,
                y: enemy.y,
                type: 'weapon',
                data: bossWeapon,
                size: 15
            });
            
            // Drop money
            const moneyAmount = Math.floor(Math.random() * 100) + 100;
            game.items.push({
                x: enemy.x - 20,
                y: enemy.y,
                type: 'money',
                amount: moneyAmount,
                size: 10
            });
            
            // Drop ammo
            const ammoAmount = Math.floor(Math.random() * 50) + 50;
            game.items.push({
                x: enemy.x + 20,
                y: enemy.y,
                type: 'ammo',
                amount: ammoAmount,
                size: 12
            });
            
            // Drop health powerup
            game.items.push({
                x: enemy.x + 60,
                y: enemy.y,
                type: 'powerup',
                data: 'health',
                size: 15
            });
        } else {
            game.player.score += 10;
            createParticles(enemy.x, enemy.y, enemy.color, 15);
            
            // Normal enemy drops - affected by difficulty
            if (Math.random() < (0.4 * modifier.dropRateMult)) {
                const moneyAmount = Math.floor(Math.random() * 15) + 5;
                game.items.push({
                    x: enemy.x,
                    y: enemy.y,
                    type: 'money',
                    amount: moneyAmount,
                    size: 10
                });
            }
            
            // Check if ammo should drop (IMPOSSIBLE mode: no ammo from normal enemies)
            if (!modifier.noNormalEnemyAmmo) {
                if (Math.random() < (0.15 * modifier.dropRateMult)) {
                    const ammoAmount = Math.floor(Math.random() * 20) + 10;
                    game.items.push({
                        x: enemy.x,
                        y: enemy.y,
                        type: 'ammo',
                        amount: ammoAmount,
                        size: 12
                    });
                }
            }
            
            if (Math.random() < (0.03 * modifier.dropRateMult)) {
                const droppedWeapon = getRandomWeapon(true);
                game.items.push({
                    x: enemy.x,
                    y: enemy.y,
                    type: 'weapon',
                    data: droppedWeapon,
                    size: 15
                });
            }
        }
        
        if (game.enemies.length === 0) {
            game.currentRoom.cleared = true;
            game.doors.forEach(door => door.blocked = false);
            
            // Broadcast room cleared to other players
            if (multiplayer.enabled) {
                sendRoomCleared(game.gridX, game.gridY);
            }
        }
    }
}

function updateEnemySpawnIndicators() {
    const now = Date.now();
    
    for (let i = game.enemySpawnIndicators.length - 1; i >= 0; i--) {
        const indicator = game.enemySpawnIndicators[i];
        
        // Animate the growing circle
        const timeLeft = indicator.spawnTime - now;
        const totalTime = indicator.isBoss ? 2000 : 1500;
        const progress = 1 - (timeLeft / totalTime);
        indicator.radius = Math.max(0, progress * 30);
        
        // Check if it's time to spawn
        if (now >= indicator.spawnTime) {
            // Only host actually spawns enemies - non-hosts receive them via sync
            if (!multiplayer.enabled || multiplayer.isHost) {
                // Actually spawn the enemy
                if (indicator.isBoss) {
                    const modifier = getDifficultyModifier();
                    const baseHealth = 300 + game.player.level * 50;
                    const boss = {
                        x: indicator.x,
                        y: indicator.y,
                        size: 35,
                        health: baseHealth * modifier.enemyHealthMult,
                        maxHealth: baseHealth * modifier.enemyHealthMult,
                        speed: 1.5,
                        color: '#8b0000',
                        type: ENEMY_TYPES.BOSS,
                        wanderAngle: Math.random() * Math.PI * 2,
                        wanderTimer: 0,
                        lastShot: 0,
                        shotPattern: 0
                    };
                    game.enemies.push(boss);
                } else {
                    spawnEnemy(indicator.x, indicator.y, indicator.type);
                }
            }
            
            // Create spawn particles
            createParticles(indicator.x, indicator.y, '#e94560', 20);
            
            // Play spawn sound
            playEnemySpawnSound();
            
            // Remove the indicator
            game.enemySpawnIndicators.splice(i, 1);
        }
    }
}


// Note: Dasher and Necromancer AI is handled inline in game.js update() loop