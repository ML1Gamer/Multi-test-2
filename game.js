// Input handling
document.addEventListener('keydown', (e) => {
    game.keys[e.key.toLowerCase()] = true;
    
    if (e.key >= '1' && e.key <= '3') {
        const index = parseInt(e.key) - 1;
        if (index < game.player.weapons.length) {
            const weapon = game.player.weapons[index];
            if (weapon && (weapon.ammo === Infinity || weapon.ammo > 0 || weapon.isMelee)) {
                game.player.currentWeaponIndex = index;
                updateUI();
            }
        }
    }

    if (e.key.toLowerCase() === 'e') {
        manualPickup();
        tryEnterDoor();
    }

    if (e.key.toLowerCase() === 'q') {
        dropCurrentWeapon();
    }

    if (e.key === 'Escape' && game.shopOpen) {
        closeShop();
    }
});

document.addEventListener('keyup', (e) => {
    game.keys[e.key.toLowerCase()] = false;
});

let mouseDown = false;

document.addEventListener('mouseup', () => {
    mouseDown = false;
});

// Delta time tracking for FPS-independent movement
let lastFrameTime = performance.now();
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

// Collision detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.w &&
           rect1.x + rect1.w > rect2.x &&
           rect1.y < rect2.y + rect2.h &&
           rect1.h + rect1.y > rect2.y;
}

function checkWallCollision(x, y, size) {
    const playerRect = { x: x - size/2, y: y - size/2, w: size, h: size };
    return game.walls.some(wall => checkCollision(playerRect, wall));
}

function checkEnemyDoorCollision(x, y, size) {
    const enemyRect = { x: x - size/2, y: y - size/2, w: size, h: size };
    return game.doors.some(door => checkCollision(enemyRect, door));
}

function checkDoorCollision(x, y, size) {
    const playerRect = { x: x - size/2, y: y - size/2, w: size, h: size };
    
    for (const door of game.doors) {
        // Create a smaller hitbox for the door collision (50% of original size, centered)
        const shrinkAmount = 0.15; // 25% off each side = 50% total size
        const smallerDoor = {
            x: door.x + (door.w * shrinkAmount),
            y: door.y + (door.h * shrinkAmount),
            w: door.w * (1 - shrinkAmount * 2),
            h: door.h * (1 - shrinkAmount * 2)
        };
        
        // Larger detection area for entering doors (150% of original size)
        const expandAmount = 0.30; // Expand by 25% on each side
        const largerDoor = {
            x: door.x - (door.w * expandAmount),
            y: door.y - (door.h * expandAmount),
            w: door.w * (1 + expandAmount * 2),
            h: door.h * (1 + expandAmount * 2)
        };
        
        // Check if player is in the larger detection area
        if (checkCollision(playerRect, largerDoor)) {
            if (!door.blocked && !game.transitioning) {
                game.nearDoor = door;
            }
        }
        
        // Check collision with smaller hitbox
        if (checkCollision(playerRect, smallerDoor)) {
            if (door.blocked) {
                return true;
            }
            // Doors are solid to prevent walking through
            return true;
        }
    }
    
    // Clear nearDoor if not in any detection area
    const isNearAnyDoor = game.doors.some(door => {
        const expandAmount = 0.25;
        const largerDoor = {
            x: door.x - (door.w * expandAmount),
            y: door.y - (door.h * expandAmount),
            w: door.w * (1 + expandAmount * 2),
            h: door.h * (1 + expandAmount * 2)
        };
        return checkCollision(playerRect, largerDoor) && !door.blocked;
    });
    
    if (!isNearAnyDoor) {
        game.nearDoor = null;
    }
    
    return false;
}

function tryEnterDoor() {
    if (game.nearDoor && !game.transitioning) {
        game.transitioning = true;
        playDoorSound();
        const directions = {
            'north': { dx: 0, dy: -1 },
            'south': { dx: 0, dy: 1 },
            'east': { dx: 1, dy: 0 },
            'west': { dx: -1, dy: 0 }
        };
        const dir = directions[game.nearDoor.direction];
        const newX = game.gridX + dir.dx;
        const newY = game.gridY + dir.dy;
        
        if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE && game.rooms[newY][newX]) {
            game.gridX = newX;
            game.gridY = newY;
            game.currentRoom = game.rooms[newY][newX];
            enterRoom(game.currentRoom);
            
            // Broadcast room change to other players
            if (multiplayer.enabled) {
                sendRoomChange(newX, newY);
            }
        }
        setTimeout(() => {
            game.transitioning = false;
        }, 100);
    }
}

// Get nearest player (for enemy AI in multiplayer)
function getNearestPlayer(enemyX, enemyY) {
    let nearestPlayer = game.player;
    let minDist = Math.hypot(game.player.x - enemyX, game.player.y - enemyY);
    
    // Check other players in multiplayer
    if (multiplayer.enabled && multiplayer.players.size > 0) {
        multiplayer.players.forEach((otherPlayer, playerId) => {
            // Only consider players in the same room
            if (otherPlayer.gridX === game.gridX && otherPlayer.gridY === game.gridY) {
                const dist = Math.hypot(otherPlayer.x - enemyX, otherPlayer.y - enemyY);
                if (dist < minDist) {
                    minDist = dist;
                    nearestPlayer = otherPlayer;
                }
            }
        });
    }
    
    return { player: nearestPlayer, distance: minDist };
}

// Main update loop with delta time
function update(deltaTime) {
    if (game.shopOpen || game.paused) return;

    // Update enemy spawn indicators
    updateEnemySpawnIndicators();

    if (mouseDown) {
        shoot();
    }

    const stats = getPlayerStats();
    const playerSpeed = (game.player.speed + stats.speedBonus) * deltaTime;

    let newX = game.player.x;
    let newY = game.player.y;

    if (game.keys['w'] || game.keys['arrowup']) newY -= playerSpeed;
    if (game.keys['s'] || game.keys['arrowdown']) newY += playerSpeed;
    if (game.keys['a'] || game.keys['arrowleft']) newX -= playerSpeed;
    if (game.keys['d'] || game.keys['arrowright']) newX += playerSpeed;

    if (!checkWallCollision(newX, game.player.y, game.player.size) && 
        !checkDoorCollision(newX, game.player.y, game.player.size)) {
        game.player.x = newX;
    }
    if (!checkWallCollision(game.player.x, newY, game.player.size) && 
        !checkDoorCollision(game.player.x, newY, game.player.size)) {
        game.player.y = newY;
    }

    game.player.angle = Math.atan2(game.mouseY - game.player.y, game.mouseX - game.player.x);

    // Multiplayer sync - FIXED VERSION
    if (multiplayer.enabled) {
        sendPlayerUpdate();
        
        // Interpolate other players' positions for smooth movement
        interpolatePlayers(deltaTime);
        
        // Host sends enemy updates, enemy bullets, items and runs enemy AI
        if (multiplayer.isHost) {
            const now = Date.now();
            
            // Send enemy positions every 100ms
            if (now - (multiplayer.lastEnemyUpdate || 0) > 100) {
                sendEnemyUpdate();
                multiplayer.lastEnemyUpdate = now;
            }
            
            // Send enemy bullets every 100ms
            if (now - (multiplayer.lastEnemyBulletUpdate || 0) > 100) {
                sendEnemyBulletsUpdate();
                multiplayer.lastEnemyBulletUpdate = now;
            }
            
            // Send items every 500ms to keep them synced
            if (now - (multiplayer.lastItemUpdate || 0) > 500) {
                sendItemsSync();
                multiplayer.lastItemUpdate = now;
            }
        } else {
            // Non-hosts interpolate enemy positions (don't run AI)
            interpolateEnemies(deltaTime);
        }
    }

    // Auto-pickup nearby items
    pickupNearbyItems();

    // Update bullets
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const bullet = game.bullets[i];
        bullet.x += bullet.vx * deltaTime;
        bullet.y += bullet.vy * deltaTime;

        if (bullet.x < 0 || bullet.x > ROOM_WIDTH || bullet.y < 0 || bullet.y > ROOM_HEIGHT) {
            game.bullets.splice(i, 1);
            continue;
        }

        const bulletRect = { x: bullet.x - 2, y: bullet.y - 2, w: 4, h: 4 };
        if (game.walls.some(wall => checkCollision(bulletRect, wall))) {
            game.bullets.splice(i, 1);
            continue;
        }

        for (let j = game.enemies.length - 1; j >= 0; j--) {
            const enemy = game.enemies[j];
            const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            
            if (dist < enemy.size) {
                enemy.health -= bullet.damage;
                
                // Lifesteal
                if (bullet.lifesteal && bullet.lifesteal > 0) {
                    game.player.health = Math.min(game.player.maxHealth, game.player.health + bullet.damage * bullet.lifesteal);
                }
                
                createParticles(bullet.x, bullet.y, enemy.color, 5);
                playHitSound();
                
                if (bullet.explosive) {
                    playExplosionSound();
                    createParticles(bullet.x, bullet.y, '#ff8c00', 30);
                    game.enemies.forEach(e => {
                        const explosionDist = Math.hypot(bullet.x - e.x, bullet.y - e.y);
                        if (explosionDist < bullet.explosionRadius) {
                            e.health -= bullet.damage * (1 - explosionDist / bullet.explosionRadius);
                            createParticles(e.x, e.y, e.color, 8);
                        }
                    });
                }
                
                if (enemy.health <= 0) {
                    handleEnemyDeath(enemy);
                }
                
                if (!bullet.penetrating) {
                    game.bullets.splice(i, 1);
                    break;
                }
            }
        }
    }

    // Update enemy bullets
    for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = game.enemyBullets[i];
        bullet.x += bullet.vx * deltaTime;
        bullet.y += bullet.vy * deltaTime;

        if (bullet.x < 0 || bullet.x > ROOM_WIDTH || bullet.y < 0 || bullet.y > ROOM_HEIGHT) {
            game.enemyBullets.splice(i, 1);
            continue;
        }

        const bulletRect = { x: bullet.x - 2, y: bullet.y - 2, w: 4, h: 4 };
        if (game.walls.some(wall => checkCollision(bulletRect, wall))) {
            game.enemyBullets.splice(i, 1);
            continue;
        }

        // Check collision with local player
        const dist = Math.hypot(bullet.x - game.player.x, bullet.y - game.player.y);
        if (dist < game.player.size) {
            const stats = getPlayerStats();
            const modifier = getDifficultyModifier();
            const baseBulletDamage = Math.max(0.5, 2 - (stats.defense * 0.02));
            const bulletDamage = baseBulletDamage * modifier.enemyDamageMult;
            
            if (Math.random() > stats.evasion) {
                game.player.health -= bulletDamage;
                createParticles(game.player.x, game.player.y, '#4ecca3', 8);
                
                if (game.player.health <= 0) {
                    resetGame();
                }
            } else {
                createParticles(game.player.x, game.player.y, '#ffffff', 5);
            }
            game.enemyBullets.splice(i, 1);
            continue;
        }

        // Check collision with other players (in multiplayer)
        if (multiplayer.enabled && multiplayer.players.size > 0) {
            multiplayer.players.forEach((otherPlayer, playerId) => {
                if (otherPlayer.gridX === game.gridX && otherPlayer.gridY === game.gridY) {
                    const otherDist = Math.hypot(bullet.x - otherPlayer.x, bullet.y - otherPlayer.y);
                    if (otherDist < game.player.size) {
                        // Notify that player about damage (they'll handle their own health)
                        createParticles(otherPlayer.x, otherPlayer.y, '#ff6b9d', 8);
                        game.enemyBullets.splice(i, 1);
                    }
                }
            });
        }
    }

    // Update enemies with delta time
    // IMPORTANT: In multiplayer, only the host runs enemy AI
    // Non-hosts just receive enemy positions from the host
    const now = Date.now();
    const shouldRunEnemyAI = !multiplayer.enabled || multiplayer.isHost;
    
    if (shouldRunEnemyAI) {
        game.enemies.forEach(enemy => {
            let moveX = 0;
            let moveY = 0;
            
            // Get nearest player (works in both single and multiplayer)
            const { player: targetPlayer, distance: distToPlayer } = getNearestPlayer(enemy.x, enemy.y);

        if (enemy.type === ENEMY_TYPES.DASHER) {
            if (enemy.state === 'idle') {
                if (now - enemy.lastDash > enemy.dashCooldown) {
                    enemy.state = 'windup';
                    enemy.windupTime = now;
                    
                    const angleToPlayer = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
                    enemy.dashDirection = {
                        x: Math.cos(angleToPlayer),
                        y: Math.sin(angleToPlayer)
                    };
                }
            } else if (enemy.state === 'windup') {
                if (now - enemy.windupTime >= enemy.windupDuration) {
                    enemy.state = 'dashing';
                    enemy.dashStartTime = now;
                    playExplosionSound(); // dash-start audio cue
                }
            } else if (enemy.state === 'dashing') {
                const dashElapsed = now - enemy.dashStartTime;
                if (dashElapsed >= enemy.dashDuration) {
                    enemy.state = 'cooldown';
                    enemy.cooldownStartTime = now;
                    enemy.lastDash = now;
                } else {
                    const dashSpeed = enemy.dashSpeed * deltaTime;
                    const newX = enemy.x + enemy.dashDirection.x * dashSpeed;
                    const newY = enemy.y + enemy.dashDirection.y * dashSpeed;
                    
                    let hitWall = false;
                    if (!checkWallCollision(newX, enemy.y, enemy.size) && !checkEnemyDoorCollision(newX, enemy.y, enemy.size)) {
                        enemy.x = newX;
                    } else {
                        hitWall = true;
                    }
                    
                    if (!checkWallCollision(enemy.x, newY, enemy.size) && !checkEnemyDoorCollision(enemy.x, newY, enemy.size)) {
                        enemy.y = newY;
                    } else {
                        hitWall = true;
                    }

                    // Wall collision: burst projectiles and end dash early
                    if (hitWall) {
                        enemy.state = 'cooldown';
                        enemy.cooldownStartTime = now;
                        enemy.lastDash = now;
                        for (let i = 0; i < 5; i++) {
                            const randomAngle = Math.random() * Math.PI * 2;
                            game.enemyBullets.push({
                                x: enemy.x, y: enemy.y,
                                vx: Math.cos(randomAngle) * 6,
                                vy: Math.sin(randomAngle) * 6,
                                color: '#ff4500', size: 6
                            });
                        }
                        playExplosionSound();
                        createParticles(enemy.x, enemy.y, '#ff4500', 25);
                    }
                }
            } else if (enemy.state === 'cooldown') {
                if (now - enemy.cooldownStartTime >= enemy.postDashCooldown) {
                    enemy.state = 'idle';
                }
            }
        } else if (enemy.type === ENEMY_TYPES.NECROMANCER) {
            if (now - enemy.lastSummon > enemy.summonCooldown && enemy.minions.length < 4) {
                enemy.lastSummon = now;
                // Summon 2 minions around the necromancer
                for (let i = 0; i < 2; i++) {
                    const spawnAngle = Math.random() * Math.PI * 2;
                    const spawnX = enemy.x + Math.cos(spawnAngle) * 50;
                    const spawnY = enemy.y + Math.sin(spawnAngle) * 50;
                    const summonType = Math.random() > 0.5 ? ENEMY_TYPES.SHOOTER : ENEMY_TYPES.CHASER;
                    spawnSummonedEnemy(spawnX, spawnY, summonType, enemy);
                }
            }
            
            const angleToPlayer = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
            if (distToPlayer < 250) {
                moveX = -Math.cos(angleToPlayer) * enemy.speed * deltaTime;
                moveY = -Math.sin(angleToPlayer) * enemy.speed * deltaTime;
            } else if (distToPlayer > 350) {
                moveX = Math.cos(angleToPlayer) * enemy.speed * deltaTime;
                moveY = Math.sin(angleToPlayer) * enemy.speed * deltaTime;
            }
        } else if (enemy.type === ENEMY_TYPES.BOSS) {
            const angleToPlayer = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
            
            if (distToPlayer > 250) {
                moveX = Math.cos(angleToPlayer) * enemy.speed * deltaTime;
                moveY = Math.sin(angleToPlayer) * enemy.speed * deltaTime;
            }
            
            if (now - enemy.lastShot > 800) {
                enemy.lastShot = now;
                const bulletSpeed = 5;
                
                for (let i = -1; i <= 1; i++) {
                    const angle = angleToPlayer + (i * 0.2);
                    game.enemyBullets.push({
                        x: enemy.x,
                        y: enemy.y,
                        vx: Math.cos(angle) * bulletSpeed,
                        vy: Math.sin(angle) * bulletSpeed,
                        color: '#8b0000',
                        size: 7
                    });
                }
            }
        } else if (enemy.type === ENEMY_TYPES.SUMMONED) {
            // Summoned enemies behave like their actual type
            const angleToPlayer = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
            
            if (enemy.actualType === ENEMY_TYPES.CHASER) {
                const randomOffset = (Math.random() - 0.5) * 1.5;
                const angle = angleToPlayer + randomOffset;
                moveX = Math.cos(angle) * enemy.speed * deltaTime;
                moveY = Math.sin(angle) * enemy.speed * deltaTime;
            } else if (enemy.actualType === ENEMY_TYPES.SHOOTER) {
                if (distToPlayer < 200) {
                    moveX = -Math.cos(angleToPlayer) * enemy.speed * deltaTime;
                    moveY = -Math.sin(angleToPlayer) * enemy.speed * deltaTime;
                } else if (distToPlayer > 300) {
                    moveX = Math.cos(angleToPlayer) * enemy.speed * deltaTime;
                    moveY = Math.sin(angleToPlayer) * enemy.speed * deltaTime;
                }
                
                if (now - enemy.lastShot > 1500 && distToPlayer < 350) {
                    enemy.lastShot = now;
                    const bulletSpeed = 4;
                    game.enemyBullets.push({
                        x: enemy.x,
                        y: enemy.y,
                        vx: Math.cos(angleToPlayer) * bulletSpeed,
                        vy: Math.sin(angleToPlayer) * bulletSpeed,
                        color: enemy.color,
                        size: 5
                    });
                }
            }
        } else if (enemy.type === ENEMY_TYPES.CHASER) {
            const angleToPlayer = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
            const randomOffset = (Math.random() - 0.5) * 1.5;
            const angle = angleToPlayer + randomOffset;
            moveX = Math.cos(angle) * enemy.speed * deltaTime;
            moveY = Math.sin(angle) * enemy.speed * deltaTime;
        } else if (enemy.type === ENEMY_TYPES.WANDERER) {
            const angleToPlayer = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
            enemy.wanderTimer++;
            if (enemy.wanderTimer > 60) {
                enemy.wanderAngle += (Math.random() - 0.5) * 0.5;
                enemy.wanderTimer = 0;
            }
            
            const orbitAngle = angleToPlayer + Math.PI / 2 + enemy.wanderAngle;
            
            if (distToPlayer < 100) {
                // Too close, move away while orbiting
                const retreatAngle = angleToPlayer + Math.PI + enemy.wanderAngle * 0.5;
                moveX = Math.cos(retreatAngle) * enemy.speed * deltaTime;
                moveY = Math.sin(retreatAngle) * enemy.speed * deltaTime;
            } else if (distToPlayer > 200) {
                // Too far, move closer while orbiting
                const approachAngle = angleToPlayer + enemy.wanderAngle * 0.3;
                moveX = Math.cos(approachAngle) * enemy.speed * deltaTime;
                moveY = Math.sin(approachAngle) * enemy.speed * deltaTime;
            } else {
                // Perfect range, orbit around player
                moveX = Math.cos(orbitAngle) * enemy.speed * deltaTime;
                moveY = Math.sin(orbitAngle) * enemy.speed * deltaTime;
            }
        } else if (enemy.type === ENEMY_TYPES.SHOOTER) {
            const angleToPlayer = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
            
            if (distToPlayer < 200) {
                moveX = -Math.cos(angleToPlayer) * enemy.speed * deltaTime;
                moveY = -Math.sin(angleToPlayer) * enemy.speed * deltaTime;
            } else if (distToPlayer > 300) {
                moveX = Math.cos(angleToPlayer) * enemy.speed * deltaTime;
                moveY = Math.sin(angleToPlayer) * enemy.speed * deltaTime;
            }
            
            if (now - enemy.lastShot > 1500 && distToPlayer < 350) {
                enemy.lastShot = now;
                const bulletSpeed = 4;
                game.enemyBullets.push({
                    x: enemy.x,
                    y: enemy.y,
                    vx: Math.cos(angleToPlayer) * bulletSpeed,
                    vy: Math.sin(angleToPlayer) * bulletSpeed,
                    color: '#ff6b6b',
                    size: 5
                });
            }
        }

        // Apply movement with collision detection (skip for Dasher, it handles its own)
        if (enemy.type !== ENEMY_TYPES.DASHER) {
            const newX = enemy.x + moveX;
            const newY = enemy.y + moveY;
            
            if (!checkWallCollision(newX, enemy.y, enemy.size) && !checkEnemyDoorCollision(newX, enemy.y, enemy.size)) {
                enemy.x = newX;
            }
            if (!checkWallCollision(enemy.x, newY, enemy.size) && !checkEnemyDoorCollision(enemy.x, newY, enemy.size)) {
                enemy.y = newY;
            }
        }

        // Check collision with local player
        if (distToPlayer < game.player.size + enemy.size && targetPlayer === game.player) {
            const stats = getPlayerStats();
            const modifier = getDifficultyModifier();
            const baseContactDamage = Math.max(0.1, 0.2 - (stats.defense * 0.005));
            const contactDamage = baseContactDamage * modifier.enemyDamageMult * deltaTime;
            game.player.health -= contactDamage;
            if (game.player.health <= 0) {
                resetGame();
            }
        }
    });
    } else {
        // Non-hosts: Enemy collision detection still runs locally
        // This prevents enemies from walking through the player on non-host clients
        game.enemies.forEach(enemy => {
            const distToPlayer = Math.hypot(game.player.x - enemy.x, game.player.y - enemy.y);
            
            if (distToPlayer < game.player.size + enemy.size) {
                const stats = getPlayerStats();
                const modifier = getDifficultyModifier();
                const baseContactDamage = Math.max(0.1, 0.2 - (stats.defense * 0.005));
                const contactDamage = baseContactDamage * modifier.enemyDamageMult * deltaTime;
                game.player.health -= contactDamage;
                if (game.player.health <= 0) {
                    resetGame();
                }
            }
        });
    }

    // Update particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.life -= deltaTime;
        if (p.life <= 0) {
            game.particles.splice(i, 1);
        }
    }

    updateUI();
}

// Apply passive health regeneration
function applyHealthRegen(deltaTime) {
    const modifier = getDifficultyModifier();
    
    // No health regen in impossible mode (1 HP cap)
    if (modifier.oneHPMode) return;
    
    const stats = getPlayerStats();
    if (stats.healthRegen > 0) {
        game.player.health = Math.min(game.player.maxHealth, game.player.health + stats.healthRegen * 0.1 * deltaTime);
    }
}

// Game loop with delta time
function gameLoop(currentTime) {
    // Calculate delta time
    const deltaTime = (currentTime - lastFrameTime) / FRAME_TIME;
    lastFrameTime = currentTime;
    
    // Clamp delta time to prevent huge jumps (e.g., when tab is inactive)
    const clampedDelta = Math.min(deltaTime, 3);
    
    update(clampedDelta);
    applyHealthRegen(clampedDelta);
    draw();
    requestAnimationFrame(gameLoop);
}

// Get mouse coordinates accounting for canvas scaling
function getScaledMouseCoordinates(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = ROOM_WIDTH / rect.width;
    const scaleY = ROOM_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
}

// Initialize and start the game when DOM is ready
function initGame() {
    // Initialize canvas references
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    minimapCanvas = document.getElementById('minimapCanvas');
    minimapCtx = minimapCanvas.getContext('2d');
    
    // Initialize audio system
    initAudio();
    
    // Setup volume controls
    document.getElementById('musicVolume').addEventListener('input', (e) => {
        setMusicVolume(e.target.value / 100);
    });
    
    document.getElementById('sfxVolume').addEventListener('input', (e) => {
        setSFXVolume(e.target.value / 100);
    });
    
    // Setup menu volume controls
    setupVolumeControls();
    
    // Setup canvas event listeners with proper scaling
    canvas.addEventListener('mousemove', (e) => {
        const coords = getScaledMouseCoordinates(e, canvas);
        game.mouseX = coords.x;
        game.mouseY = coords.y;
    });

    canvas.addEventListener('mousedown', () => {
        mouseDown = true;
    });

    canvas.addEventListener('mouseup', () => {
        mouseDown = false;
    });
    
    // Show main menu instead of starting game
    document.getElementById('mainMenu').style.display = 'flex';
    document.getElementById('gameContainer').style.display = 'none';
    
    // Initialize last frame time
    lastFrameTime = performance.now();
    
    // Start the game loop (but game will be paused until started from menu)
    requestAnimationFrame(gameLoop);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
