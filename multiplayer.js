// Multiplayer client handler using Supabase Realtime
// COMPLETE FIX: Multi-room enemy tracking + map sync fix + Non-host enemy spawning

const SUPABASE_URL = 'https://gdyhdywnlnaqwqtmwadx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VQbRK1tUFZIf37baWdeAKw_E5LZm6Sg';

const multiplayer = {
    enabled: false,
    supabase: null,
    channel: null,
    roomCode: null,
    playerId: null,
    playerName: null,
    isHost: false,
    players: new Map(),
    lastUpdateSent: 0,
    updateInterval: 50,
    roomId: null,
    difficulty: null,
    lastEnemyUpdate: 0,
    lastEnemyBulletUpdate: 0,
    lastItemUpdate: 0,
    roomEnemies: new Map(), // NEW: roomKey -> enemy array (host only)
    roomEnemyBullets: new Map(), // NEW: roomKey -> bullet array (host only)  
    roomItems: new Map() // NEW: roomKey -> item array (host only)
};

// Initialize Supabase client
async function initSupabase() {
    if (multiplayer.supabase) return multiplayer.supabase;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    multiplayer.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase initialized');
    return multiplayer.supabase;
}

// Generate unique player ID
function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

// Generate room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

// Create multiplayer room
async function createMultiplayerRoom(difficulty) {
    console.log('🎮 Creating room with difficulty:', difficulty);
    multiplayer.enabled = true;
    multiplayer.playerId = generatePlayerId();
    multiplayer.playerName = prompt('Enter your name:', 'Player') || 'Player';
    multiplayer.isHost = true;
    multiplayer.roomCode = generateRoomCode();
    multiplayer.difficulty = difficulty;

    try {
        const supabase = await initSupabase();
        
        console.log('📝 Inserting room into database...');
        const { data: room, error: roomError } = await supabase
            .from('game_rooms')
            .insert({
                room_code: multiplayer.roomCode,
                difficulty: difficulty,
                host_id: multiplayer.playerId,
                status: 'waiting'
            })
            .select()
            .single();

        if (roomError) {
            console.error('❌ Room creation error:', roomError);
            throw roomError;
        }
        
        console.log('✅ Room created:', room);
        multiplayer.roomId = room.id;

        console.log('👤 Adding host as player...');
        const { error: playerError } = await supabase.from('room_players').insert({
            room_id: room.id,
            player_id: multiplayer.playerId,
            player_name: multiplayer.playerName,
            is_host: true
        });

        if (playerError) {
            console.error('❌ Player insert error:', playerError);
            throw playerError;
        }

        console.log('📡 Subscribing to room channel...');
        await subscribeToRoom(room.id);
        showMultiplayerLobby();
        
    } catch (error) {
        console.error('❌ Failed to create room:', error);
        alert('Failed to create room: ' + error.message);
        multiplayer.enabled = false;
    }
}

// Join multiplayer room
async function joinMultiplayerRoom(roomCode) {
    console.log('🚪 Joining room:', roomCode);
    multiplayer.enabled = true;
    multiplayer.playerId = generatePlayerId();
    multiplayer.playerName = prompt('Enter your name:', 'Player') || 'Player';
    multiplayer.isHost = false;
    multiplayer.roomCode = roomCode.toUpperCase();

    try {
        const supabase = await initSupabase();
        
        console.log('🔍 Looking for room...');
        const { data: room, error: roomError } = await supabase
            .from('game_rooms')
            .select('*')
            .eq('room_code', multiplayer.roomCode)
            .single();

        if (roomError || !room) {
            console.error('❌ Room not found:', roomError);
            alert('Room not found!');
            multiplayer.enabled = false;
            return;
        }

        console.log('✅ Found room:', room);
        multiplayer.roomId = room.id;
        multiplayer.difficulty = room.difficulty;

        console.log('👤 Adding player to room...');
        const { error: playerError } = await supabase.from('room_players').insert({
            room_id: room.id,
            player_id: multiplayer.playerId,
            player_name: multiplayer.playerName,
            is_host: false
        });

        if (playerError) {
            console.error('❌ Player insert error:', playerError);
            throw playerError;
        }

        console.log('📡 Subscribing to room channel...');
        await subscribeToRoom(room.id);
        
        console.log('📢 Broadcasting join...');
        multiplayer.channel.send({
            type: 'broadcast',
            event: 'player_joined',
            payload: { playerId: multiplayer.playerId, playerName: multiplayer.playerName }
        });

        showMultiplayerLobby();
        
    } catch (error) {
        console.error('❌ Failed to join room:', error);
        alert('Failed to join room: ' + error.message);
        multiplayer.enabled = false;
    }
}

// Subscribe to room channel for realtime updates
async function subscribeToRoom(roomId) {
    const supabase = await initSupabase();
    
    console.log('🔌 Creating channel for room:', roomId);
    
    multiplayer.channel = supabase.channel(`room:${roomId}`, {
        config: { 
            broadcast: { 
                self: false,  // FIXED: Don't receive own broadcasts
                ack: true
            } 
        }
    });

    return new Promise((resolve, reject) => {
        multiplayer.channel
            .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
                console.log('👋 Player joined:', payload);
                addChatMessage('System', `${payload.playerName} joined the game`);
                refreshPlayerList();
            })
            .on('broadcast', { event: 'player_left' }, ({ payload }) => {
                console.log('👋 Player left:', payload);
                addChatMessage('System', 'A player left the game');
                multiplayer.players.delete(payload.playerId);
                refreshPlayerList();
            })
            .on('broadcast', { event: 'game_started' }, ({ payload }) => {
                // FIXED: Only non-hosts respond (host starts game directly)
                if (!multiplayer.isHost) {
                    console.log('🎮 Game started broadcast received:', payload);
                    startMultiplayerGame(payload.difficulty, payload.dungeonSeed);
                }
            })
            .on('broadcast', { event: 'player_update' }, ({ payload }) => {
                if (payload.playerId !== multiplayer.playerId) {
                    updateOtherPlayer(payload);
                }
            })
            .on('broadcast', { event: 'player_shot' }, ({ payload }) => {
                if (payload.playerId !== multiplayer.playerId) {
                    if (payload.gridX === game.gridX && payload.gridY === game.gridY) {
                        handleOtherPlayerShot(payload);
                    }
                }
            })
            .on('broadcast', { event: 'enemies_sync' }, ({ payload }) => {
                if (!multiplayer.isHost && payload.gridX === game.gridX && payload.gridY === game.gridY) {
                    syncEnemies(payload.enemies);
                }
            })
            .on('broadcast', { event: 'enemy_bullets_sync' }, ({ payload }) => {
                if (!multiplayer.isHost && payload.gridX === game.gridX && payload.gridY === game.gridY) {
                    syncEnemyBullets(payload.bullets);
                }
            })
            .on('broadcast', { event: 'items_sync' }, ({ payload }) => {
                if (!multiplayer.isHost && payload.gridX === game.gridX && payload.gridY === game.gridY) {
                    syncItems(payload.items);
                }
            })
            .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
                addChatMessage(payload.playerName, payload.message);
            })
            .on('broadcast', { event: 'room_changed' }, ({ payload }) => {
                handleOtherPlayerRoomChange(payload);
            })
            .on('broadcast', { event: 'spawn_indicators' }, ({ payload }) => {
                if (payload.gridX === game.gridX && payload.gridY === game.gridY) {
                    syncSpawnIndicators(payload.indicators);
                }
            })
            .on('broadcast', { event: 'room_cleared' }, ({ payload }) => {
                if (game.rooms[payload.gridY] && game.rooms[payload.gridY][payload.gridX]) {
                    const room = game.rooms[payload.gridY][payload.gridX];
                    room.cleared = true;
                    
                    if (game.gridX === payload.gridX && game.gridY === payload.gridY) {
                        game.doors.forEach(door => door.blocked = false);
                        game.enemies = [];
                        console.log(`Room (${payload.gridX}, ${payload.gridY}) cleared by another player`);
                    }
                }
            })
            .on('broadcast', { event: 'request_enemy_sync' }, ({ payload }) => {
                // Non-host player is requesting enemy sync after spawning
                // Host should immediately spawn those enemies and start managing them
                if (multiplayer.isHost) {
                    console.log(`🎮 Host received enemy sync request from ${payload.playerId} for room (${payload.gridX}, ${payload.gridY})`);
                    
                    const roomKey = `${payload.gridX},${payload.gridY}`;
                    
                    // Check if we already have enemies for this room
                    const existingEnemies = multiplayer.roomEnemies.get(roomKey);
                    
                    if (!existingEnemies || existingEnemies.length === 0) {
                        // Create enemies from the spawn indicators
                        console.log(`📦 Host spawning enemies for room (${payload.gridX}, ${payload.gridY})`);
                        
                        const newEnemies = payload.enemies.map(indicator => {
                            const modifier = getDifficultyModifier();
                            const baseHealth = 30 + game.player.level * 5;
                            
                            return {
                                x: indicator.x,
                                y: indicator.y,
                                size: 18,
                                health: baseHealth * modifier.enemyHealthMult,
                                maxHealth: baseHealth * modifier.enemyHealthMult,
                                speed: indicator.type === ENEMY_TYPES.SHOOTER ? 0.8 : (indicator.type === ENEMY_TYPES.WANDERER ? 1.2 : 1.0),
                                color: indicator.type === ENEMY_TYPES.SHOOTER ? '#ff6b6b' : (indicator.type === ENEMY_TYPES.WANDERER ? '#4ecdc4' : '#95e1d3'),
                                type: indicator.type,
                                wanderAngle: Math.random() * Math.PI * 2,
                                wanderTimer: 0,
                                lastShot: 0
                            };
                        });
                        
                        // Store the enemies
                        multiplayer.roomEnemies.set(roomKey, newEnemies);
                        
                        // Immediately broadcast the enemy state
                        setTimeout(() => {
                            multiplayer.channel.send({
                                type: 'broadcast',
                                event: 'enemies_sync',
                                payload: {
                                    gridX: payload.gridX,
                                    gridY: payload.gridY,
                                    enemies: newEnemies.map(e => ({
                                        x: e.x,
                                        y: e.y,
                                        health: e.health,
                                        maxHealth: e.maxHealth,
                                        type: e.type,
                                        size: e.size,
                                        color: e.color,
                                        speed: e.speed,
                                        wanderAngle: e.wanderAngle,
                                        wanderTimer: e.wanderTimer,
                                        lastShot: e.lastShot
                                    }))
                                }
                            });
                            console.log(`📤 Sent ${newEnemies.length} enemies for room (${payload.gridX}, ${payload.gridY})`);
                        }, 100);
                    } else {
                        // Already have enemies, just send them
                        multiplayer.channel.send({
                            type: 'broadcast',
                            event: 'enemies_sync',
                            payload: {
                                gridX: payload.gridX,
                                gridY: payload.gridY,
                                enemies: existingEnemies.map(e => ({
                                    x: e.x,
                                    y: e.y,
                                    health: e.health,
                                    maxHealth: e.maxHealth,
                                    type: e.type,
                                    size: e.size,
                                    color: e.color,
                                    speed: e.speed,
                                    wanderAngle: e.wanderAngle,
                                    wanderTimer: e.wanderTimer,
                                    lastShot: e.lastShot,
                                    shotPattern: e.shotPattern,
                                    state: e.state,
                                    dashDirection: e.dashDirection,
                                    windupTime: e.windupTime,
                                    dashStartTime: e.dashStartTime,
                                    lastDash: e.lastDash,
                                    lastSummon: e.lastSummon,
                                    actualType: e.actualType
                                }))
                            }
                        });
                    }
                }
            })
            .on('broadcast', { event: 'enemy_sync_confirmed' }, ({ payload }) => {
                // Host confirmed it's managing enemies for this room
                console.log(`✅ Host confirmed managing enemies for room (${payload.gridX}, ${payload.gridY})`);
            })
            .subscribe((status) => {
                console.log('📡 Channel subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Successfully subscribed to channel');
                    resolve();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('❌ Subscription failed:', status);
                    reject(new Error(`Subscription failed: ${status}`));
                }
            });
    });
}

// Show multiplayer lobby
function showMultiplayerLobby() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('multiplayerLobby').style.display = 'flex';
    document.getElementById('lobbyRoomCode').textContent = multiplayer.roomCode;
    
    if (multiplayer.isHost) {
        document.getElementById('startGameButton').style.display = 'block';
    }
    
    refreshPlayerList();
}

// Refresh player list in lobby
async function refreshPlayerList() {
    if (!multiplayer.roomId) return;
    
    const supabase = await initSupabase();
    const { data: players } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', multiplayer.roomId);
    
    const listEl = document.getElementById('lobbyPlayerList');
    if (listEl && players) {
        listEl.innerHTML = players.map(p => {
            const isYou = p.player_id === multiplayer.playerId;
            const hostBadge = p.is_host ? ' 👑 HOST' : '';
            return `<div class="lobby-player ${isYou ? 'you' : ''}">
                ${p.player_name}${hostBadge}${isYou ? ' (You)' : ''}
            </div>`;
        }).join('');
    }
}

// Host starts the game
async function hostStartGame() {
    if (!multiplayer.isHost) return;
    
    console.log('🎮 Host starting game...');
    
    const dungeonSeed = Date.now() + Math.floor(Math.random() * 10000);
    
    // Update room status
    const supabase = await initSupabase();
    await supabase
        .from('game_rooms')
        .update({ status: 'playing' })
        .eq('id', multiplayer.roomId);
    
    // Broadcast to other players
    console.log('📢 Broadcasting game_started to others with seed:', dungeonSeed);
    multiplayer.channel.send({
        type: 'broadcast',
        event: 'game_started',
        payload: {
            difficulty: multiplayer.difficulty,
            dungeonSeed: dungeonSeed
        }
    });
    
    // FIXED: Start game locally for host (no waiting for broadcast)
    startMultiplayerGame(multiplayer.difficulty, dungeonSeed);
}

// Start multiplayer game for all players
function startMultiplayerGame(difficulty, dungeonSeed) {
    console.log('🎮 Starting multiplayer game...');
    console.log('Difficulty:', difficulty);
    console.log('Dungeon seed:', dungeonSeed);
    
    document.getElementById('multiplayerLobby').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    document.getElementById('multiplayerUI').style.display = 'block';
    
    game.difficulty = difficulty;
    const modifier = DIFFICULTY_MODIFIERS[difficulty];
    
    document.getElementById('difficultyDisplay').textContent = modifier.displayName;
    
    // Reset player stats
    game.player.health = modifier.oneHPMode ? 1 : 100;
    game.player.maxHealth = modifier.oneHPMode ? 1 : 100;
    game.player.level = 1;
    game.player.score = 0;
    game.player.money = 0;
    game.player.hasKey = false;
    game.player.weapons = [{ ...weaponTypes.melee }, { ...weaponTypes.pistol }];
    game.player.currentWeaponIndex = 1;
    game.player.speed = 5;
    game.player.gear = {
        helmet: null,
        vest: null,
        gloves: null,
        bag: null,
        shoes: null,
        ammoType: null
    };
    
    game.visitedRooms.clear();
    
    // CRITICAL: Use seeded dungeon generation
    console.log('🗺️ Generating synchronized dungeon with seed:', dungeonSeed);
    generateDungeonWithSeed(dungeonSeed);
    
    updateUI();
    updateMultiplayerUI();
    
    game.paused = false;
}

// NEW: Tick AI for enemies in all rooms (host only)
function tickAllRoomEnemies(deltaTime) {
    if (!multiplayer.enabled || !multiplayer.isHost) return;
    
    const now = Date.now();
    
    // Tick enemies in other rooms
    multiplayer.roomEnemies.forEach((enemies, roomKey) => {
        const [gridX, gridY] = roomKey.split(',').map(Number);
        
        // Skip current room (it's already being updated in main loop)
        if (gridX === game.gridX && gridY === game.gridY) return;
        
        // Tick each enemy's AI
        enemies.forEach(enemy => {
            // Basic AI ticking without player target
            if (enemy.type === ENEMY_TYPES.WANDERER) {
                enemy.wanderTimer++;
                if (enemy.wanderTimer > 60) {
                    enemy.wanderAngle += (Math.random() - 0.5) * 0.5;
                    enemy.wanderTimer = 0;
                }
                
                const moveX = Math.cos(enemy.wanderAngle) * enemy.speed * deltaTime * 0.5;
                const moveY = Math.sin(enemy.wanderAngle) * enemy.speed * deltaTime * 0.5;
                
                // Basic boundary checking (room bounds)
                const newX = enemy.x + moveX;
                const newY = enemy.y + moveY;
                
                if (newX > 50 && newX < ROOM_WIDTH - 50) enemy.x = newX;
                if (newY > 50 && newY < ROOM_HEIGHT - 50) enemy.y = newY;
            } else if (enemy.type === ENEMY_TYPES.DASHER) {
                // Update dasher state machine
                if (enemy.state === 'windup') {
                    if (now - enemy.windupTime >= enemy.windupDuration) {
                        enemy.state = 'dashing';
                        enemy.dashStartTime = now;
                    }
                } else if (enemy.state === 'dashing') {
                    if (now - enemy.dashStartTime >= enemy.dashDuration) {
                        enemy.state = 'cooldown';
                        enemy.cooldownStartTime = now;
                        enemy.lastDash = now;
                    }
                } else if (enemy.state === 'cooldown') {
                    if (now - enemy.cooldownStartTime >= enemy.postDashCooldown) {
                        enemy.state = 'idle';
                    }
                } else if (enemy.state === 'idle') {
                    if (now - enemy.lastDash > enemy.dashCooldown) {
                        enemy.state = 'windup';
                        enemy.windupTime = now;
                        // Random dash direction when no players in room
                        const angle = Math.random() * Math.PI * 2;
                        enemy.dashDirection = {
                            x: Math.cos(angle),
                            y: Math.sin(angle)
                        };
                    }
                }
            } else if (enemy.type === ENEMY_TYPES.NECROMANCER) {
                // Necromancer just waits for players
                // Basic idle movement
                if (Math.random() < 0.01) {
                    enemy.x += (Math.random() - 0.5) * 2;
                    enemy.y += (Math.random() - 0.5) * 2;
                }
            }
        });
        
        // Update the stored enemies
        multiplayer.roomEnemies.set(roomKey, enemies);
    });
}

// Send periodic updates for all rooms (host only)
function broadcastAllRoomEnemies() {
    if (!multiplayer.enabled || !multiplayer.isHost || !multiplayer.channel) return;
    
    const now = Date.now();
    if (now - (multiplayer.lastAllRoomsUpdate || 0) < 500) return; // Update every 500ms
    multiplayer.lastAllRoomsUpdate = now;
    
    // Broadcast enemy states for all rooms
    multiplayer.roomEnemies.forEach((enemies, roomKey) => {
        const [gridX, gridY] = roomKey.split(',').map(Number);
        
        // Skip current room (it's already being synced frequently)
        if (gridX === game.gridX && gridY === game.gridY) return;
        
        // Only broadcast if there are enemies
        if (enemies.length > 0) {
            multiplayer.channel.send({
                type: 'broadcast',
                event: 'enemies_sync',
                payload: {
                    gridX: gridX,
                    gridY: gridY,
                    enemies: enemies.map(e => ({
                        x: e.x,
                        y: e.y,
                        health: e.health,
                        maxHealth: e.maxHealth,
                        type: e.type,
                        size: e.size,
                        color: e.color,
                        speed: e.speed,
                        wanderAngle: e.wanderAngle,
                        wanderTimer: e.wanderTimer,
                        lastShot: e.lastShot,
                        shotPattern: e.shotPattern,
                        state: e.state,
                        dashDirection: e.dashDirection,
                        windupTime: e.windupTime,
                        dashStartTime: e.dashStartTime,
                        lastDash: e.lastDash,
                        lastSummon: e.lastSummon,
                        actualType: e.actualType
                    }))
                }
            });
        }
    });
}

// NEW: Store current room's enemies before leaving (host only)
function storeCurrentRoomState() {
    if (!multiplayer.enabled || !multiplayer.isHost) return;
    
    const roomKey = `${game.gridX},${game.gridY}`;
    
    // Deep copy to prevent reference issues
    multiplayer.roomEnemies.set(roomKey, game.enemies.map(e => ({ ...e })));
    multiplayer.roomEnemyBullets.set(roomKey, game.enemyBullets.map(b => ({ ...b })));
    multiplayer.roomItems.set(roomKey, game.items.map(i => ({ ...i, data: i.data ? { ...i.data } : null })));
    
    console.log(`💾 Stored state for room (${game.gridX}, ${game.gridY}):`, {
        enemies: game.enemies.length,
        bullets: game.enemyBullets.length,
        items: game.items.length
    });
}

// NEW: Load room's enemies when entering (host only)
function loadRoomState(gridX, gridY) {
    if (!multiplayer.enabled || !multiplayer.isHost) return;
    
    const roomKey = `${gridX},${gridY}`;
    
    const storedEnemies = multiplayer.roomEnemies.get(roomKey);
    const storedBullets = multiplayer.roomEnemyBullets.get(roomKey);
    const storedItems = multiplayer.roomItems.get(roomKey);
    
    if (storedEnemies) {
        game.enemies = storedEnemies.map(e => ({ ...e }));
        console.log(`📦 Loaded ${game.enemies.length} enemies for room (${gridX}, ${gridY})`);
    }
    
    if (storedBullets) {
        game.enemyBullets = storedBullets.map(b => ({ ...b }));
    }
    
    if (storedItems) {
        game.items = storedItems.map(i => ({ ...i, data: i.data ? { ...i.data } : null }));
    }
}

// Send player update
function sendPlayerUpdate() {
    if (!multiplayer.enabled || !multiplayer.channel) return;

    const now = Date.now();
    if (now - multiplayer.lastUpdateSent < multiplayer.updateInterval) return;
    multiplayer.lastUpdateSent = now;

    const weapon = game.player.weapons[game.player.currentWeaponIndex];

    multiplayer.channel.send({
        type: 'broadcast',
        event: 'player_update',
        payload: {
            playerId: multiplayer.playerId,
            x: game.player.x,
            y: game.player.y,
            angle: game.player.angle,
            health: game.player.health,
            currentWeapon: weapon ? weapon.name : 'None',
            gridX: game.gridX,
            gridY: game.gridY
        }
    });
}

// Update other player's state
function updateOtherPlayer(data) {
    let player = multiplayer.players.get(data.playerId);
    
    if (!player) {
        player = {
            x: data.x,
            y: data.y,
            angle: data.angle,
            health: data.health,
            currentWeapon: data.currentWeapon,
            gridX: data.gridX,
            gridY: data.gridY
        };
        multiplayer.players.set(data.playerId, player);
    } else {
        player.targetX = data.x;
        player.targetY = data.y;
        player.angle = data.angle;
        player.health = data.health;
        player.currentWeapon = data.currentWeapon;
        player.gridX = data.gridX;
        player.gridY = data.gridY;
    }
    
    updateMultiplayerUI();
}

// Interpolate other players' positions
function interpolatePlayers(deltaTime) {
    if (!multiplayer.enabled) return;
    
    const interpolationSpeed = 0.3;
    
    multiplayer.players.forEach((player, playerId) => {
        if (player.targetX !== undefined && player.targetY !== undefined) {
            const dx = player.targetX - player.x;
            const dy = player.targetY - player.y;
            
            player.x += dx * interpolationSpeed * deltaTime;
            player.y += dy * interpolationSpeed * deltaTime;
        }
    });
}

// Update multiplayer UI
function updateMultiplayerUI() {
    const listEl = document.getElementById('multiplayerPlayerList');
    if (!listEl) return;
    
    let html = '';
    multiplayer.players.forEach((player, playerId) => {
        const healthPercent = Math.round((player.health / 100) * 100);
        const roomInfo = `(${player.gridX},${player.gridY})`;
        html += `<div class="mp-player">
            ${player.currentWeapon || 'Unknown'} | HP: ${healthPercent}% | Room: ${roomInfo}
        </div>`;
    });
    
    listEl.innerHTML = html;
}

// Send shoot event
function sendShootEvent(bullet) {
    if (!multiplayer.enabled || !multiplayer.channel) return;

    multiplayer.channel.send({
        type: 'broadcast',
        event: 'player_shot',
        payload: {
            playerId: multiplayer.playerId,
            gridX: game.gridX,
            gridY: game.gridY,
            bullet: {
                x: bullet.x,
                y: bullet.y,
                vx: bullet.vx,
                vy: bullet.vy,
                damage: bullet.damage,
                color: bullet.color,
                size: bullet.size,
                penetrating: bullet.penetrating,
                explosive: bullet.explosive,
                explosionRadius: bullet.explosionRadius
            }
        }
    });
}

// Handle other player shooting
function handleOtherPlayerShot(data) {
    const bullet = {
        x: data.bullet.x,
        y: data.bullet.y,
        vx: data.bullet.vx,
        vy: data.bullet.vy,
        damage: data.bullet.damage,
        color: data.bullet.color,
        size: data.bullet.size,
        penetrating: data.bullet.penetrating,
        explosive: data.bullet.explosive,
        explosionRadius: data.bullet.explosionRadius,
        fromOtherPlayer: true
    };
    
    game.bullets.push(bullet);
}

// Sync spawn indicators
function syncSpawnIndicators(indicators) {
    console.log('Syncing spawn indicators:', indicators);
    game.enemySpawnIndicators = indicators.map(ind => ({
        x: ind.x,
        y: ind.y,
        type: ind.type,
        spawnTime: ind.spawnTime,
        radius: ind.radius,
        isBoss: ind.isBoss
    }));
}

// Sync enemies from host
function syncEnemies(enemiesData) {
    const existingEnemies = new Map();
    game.enemies.forEach(enemy => {
        const key = `${Math.round(enemy.x / 10)}_${Math.round(enemy.y / 10)}`;
        existingEnemies.set(key, enemy);
    });
    
    const newEnemies = enemiesData.map(eData => {
        const key = `${Math.round(eData.x / 10)}_${Math.round(eData.y / 10)}`;
        let enemy = existingEnemies.get(key);
        
        if (enemy) {
            enemy.targetX = eData.x;
            enemy.targetY = eData.y;
            enemy.health = eData.health;
            enemy.maxHealth = eData.maxHealth;
            enemy.state = eData.state;
            enemy.dashDirection = eData.dashDirection;
            enemy.windupTime = eData.windupTime;
            enemy.dashStartTime = eData.dashStartTime;
            enemy.lastDash = eData.lastDash;
            enemy.lastSummon = eData.lastSummon;
            enemy.actualType = eData.actualType;
            existingEnemies.delete(key);
        } else {
            enemy = {
                x: eData.x,
                y: eData.y,
                targetX: eData.x,
                targetY: eData.y,
                health: eData.health,
                maxHealth: eData.maxHealth,
                type: eData.type,
                size: eData.size,
                color: eData.color,
                speed: eData.speed,
                wanderAngle: eData.wanderAngle || 0,
                wanderTimer: eData.wanderTimer || 0,
                lastShot: eData.lastShot || 0,
                shotPattern: eData.shotPattern || 0,
                state: eData.state,
                dashDirection: eData.dashDirection,
                windupTime: eData.windupTime,
                dashStartTime: eData.dashStartTime,
                lastDash: eData.lastDash,
                lastSummon: eData.lastSummon,
                actualType: eData.actualType
            };
        }
        
        return enemy;
    });
    
    game.enemies = newEnemies;
}

// Sync enemy bullets
function syncEnemyBullets(bulletsData) {
    game.enemyBullets = bulletsData.map(bData => ({
        x: bData.x,
        y: bData.y,
        vx: bData.vx,
        vy: bData.vy,
        color: bData.color,
        size: bData.size
    }));
}

// Sync items
function syncItems(itemsData) {
    game.items = itemsData.map(iData => {
        const item = {
            x: iData.x,
            y: iData.y,
            type: iData.type,
            size: iData.size,
            amount: iData.amount,
            data: iData.data
        };
        
        if (iData.miniBossType) item.miniBossType = iData.miniBossType;
        
        return item;
    });
}

// Interpolate enemy positions for smooth movement (non-hosts only)
function interpolateEnemies(deltaTime) {
    if (multiplayer.isHost || !multiplayer.enabled) return;
    
    const interpolationSpeed = 0.25;
    
    game.enemies.forEach(enemy => {
        if (enemy.targetX !== undefined && enemy.targetY !== undefined) {
            const dx = enemy.targetX - enemy.x;
            const dy = enemy.targetY - enemy.y;
            
            enemy.x += dx * interpolationSpeed * deltaTime;
            enemy.y += dy * interpolationSpeed * deltaTime;
        }
    });
}

// Send enemy updates (host only)
function sendEnemyUpdate() {
    if (!multiplayer.enabled || !multiplayer.isHost || !multiplayer.channel) return;

    multiplayer.channel.send({
        type: 'broadcast',
        event: 'enemies_sync',
        payload: {
            gridX: game.gridX,
            gridY: game.gridY,
            enemies: game.enemies.map(e => ({
                x: e.x,
                y: e.y,
                health: e.health,
                maxHealth: e.maxHealth,
                type: e.type,
                size: e.size,
                color: e.color,
                speed: e.speed,
                wanderAngle: e.wanderAngle,
                wanderTimer: e.wanderTimer,
                lastShot: e.lastShot,
                shotPattern: e.shotPattern,
                state: e.state,
                dashDirection: e.dashDirection,
                windupTime: e.windupTime,
                dashStartTime: e.dashStartTime,
                lastDash: e.lastDash,
                lastSummon: e.lastSummon,
                actualType: e.actualType
            }))
        }
    });
}

// Send enemy bullets update (host only)
function sendEnemyBulletsUpdate() {
    if (!multiplayer.enabled || !multiplayer.isHost || !multiplayer.channel) return;

    const now = Date.now();
    if (now - (multiplayer.lastEnemyBulletUpdate || 0) < 100) return;
    multiplayer.lastEnemyBulletUpdate = now;

    multiplayer.channel.send({
        type: 'broadcast',
        event: 'enemy_bullets_sync',
        payload: {
            gridX: game.gridX,
            gridY: game.gridY,
            bullets: game.enemyBullets.map(b => ({
                x: b.x,
                y: b.y,
                vx: b.vx,
                vy: b.vy,
                color: b.color,
                size: b.size
            }))
        }
    });
}

// Send items sync (host only)
function sendItemsSync() {
    if (!multiplayer.enabled || !multiplayer.isHost || !multiplayer.channel) return;

    multiplayer.channel.send({
        type: 'broadcast',
        event: 'items_sync',
        payload: {
            gridX: game.gridX,
            gridY: game.gridY,
            items: game.items.map(i => ({
                x: i.x,
                y: i.y,
                type: i.type,
                size: i.size,
                amount: i.amount,
                data: i.data,
                miniBossType: i.miniBossType
            }))
        }
    });
}

// Add chat message
function addChatMessage(playerName, message) {
    const chatBox = document.getElementById('chatMessages');
    if (!chatBox) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';
    messageEl.innerHTML = `<strong>${playerName}:</strong> ${message}`;
    chatBox.appendChild(messageEl);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Send chat message
function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (message && multiplayer.enabled && multiplayer.channel) {
        multiplayer.channel.send({
            type: 'broadcast',
            event: 'chat_message',
            payload: {
                playerId: multiplayer.playerId,
                playerName: multiplayer.playerName,
                message: message
            }
        });

        addChatMessage(multiplayer.playerName, message);
        input.value = '';
    }
}

// Leave multiplayer game
async function leaveMultiplayer() {
    if (multiplayer.channel) {
        multiplayer.channel.send({
            type: 'broadcast',
            event: 'player_left',
            payload: { playerId: multiplayer.playerId }
        });
        multiplayer.channel.unsubscribe();
    }

    if (multiplayer.roomId) {
        const supabase = await initSupabase();
        await supabase
            .from('room_players')
            .delete()
            .eq('room_id', multiplayer.roomId)
            .eq('player_id', multiplayer.playerId);
        
        if (multiplayer.isHost) {
            await supabase
                .from('game_rooms')
                .delete()
                .eq('id', multiplayer.roomId);
        }
    }

    multiplayer.enabled = false;
    multiplayer.roomCode = null;
    multiplayer.playerId = null;
    multiplayer.isHost = false;
    multiplayer.players.clear();
    multiplayer.channel = null;
    multiplayer.roomId = null;
    multiplayer.roomEnemies.clear();
    multiplayer.roomEnemyBullets.clear();
    multiplayer.roomItems.clear();

    document.getElementById('multiplayerLobby').style.display = 'none';
    document.getElementById('multiplayerUI').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
    showMainMenu();
}

// Send spawn indicators (host only)
function sendSpawnIndicators() {
    if (!multiplayer.enabled || !multiplayer.channel) return;

    multiplayer.channel.send({
        type: 'broadcast',
        event: 'spawn_indicators',
        payload: {
            gridX: game.gridX,
            gridY: game.gridY,
            indicators: game.enemySpawnIndicators.map(ind => ({
                x: ind.x,
                y: ind.y,
                type: ind.type,
                spawnTime: ind.spawnTime,
                radius: ind.radius,
                isBoss: ind.isBoss
            }))
        }
    });
}

// Send room change event
function sendRoomChange(gridX, gridY) {
    if (!multiplayer.enabled || !multiplayer.channel) return;

    multiplayer.channel.send({
        type: 'broadcast',
        event: 'room_changed',
        payload: {
            playerId: multiplayer.playerId,
            gridX: gridX,
            gridY: gridY
        }
    });
}

// Send room cleared event
function sendRoomCleared(gridX, gridY) {
    if (!multiplayer.enabled || !multiplayer.channel) return;

    multiplayer.channel.send({
        type: 'broadcast',
        event: 'room_cleared',
        payload: {
            gridX: gridX,
            gridY: gridY
        }
    });
}

// Handle other player changing rooms
function handleOtherPlayerRoomChange(data) {
    console.log(`Player ${data.playerId} moved to room (${data.gridX}, ${data.gridY})`);
    const player = multiplayer.players.get(data.playerId);
    if (player) {
        player.gridX = data.gridX;
        player.gridY = data.gridY;
    }
}

console.log('✅ Multiplayer.js loaded - COMPLETE FIX: Non-host enemy spawning + AI sync');
