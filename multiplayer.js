// Multiplayer client handler using Supabase Realtime
// Fixed version with position interpolation and proper enemy sync

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
    lastEnemyUpdate: 0
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
        
        // Create room in database
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

        // Add host as player
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

        // Subscribe to room channel
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
        
        // Find room
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

        // Add player to room
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

        // Subscribe to room channel
        console.log('📡 Subscribing to room channel...');
        await subscribeToRoom(room.id);
        
        // Notify others via broadcast
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
    
    // IMPORTANT: Enable self-receive for broadcasts so host can see their own game_started event
    multiplayer.channel = supabase.channel(`room:${roomId}`, {
        config: { 
            broadcast: { 
                self: true,  // host receives their own broadcasts
                ack: true    // request acknowledgment
            } 
        }
    });

    // Return a Promise that resolves only once the channel is truly SUBSCRIBED.
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
                console.log('🎮 Game started broadcast received:', payload);
                startMultiplayerGame(payload.difficulty, payload.dungeonSeed);
            })
            .on('broadcast', { event: 'player_update' }, ({ payload }) => {
                if (payload.playerId !== multiplayer.playerId) {
                    updateOtherPlayer(payload);
                }
            })
            .on('broadcast', { event: 'player_shot' }, ({ payload }) => {
                if (payload.playerId !== multiplayer.playerId) {
                    // Only show bullets if player is in same room
                    if (payload.gridX === game.gridX && payload.gridY === game.gridY) {
                        handleOtherPlayerShot(payload);
                    }
                }
            })
            .on('broadcast', { event: 'enemies_sync' }, ({ payload }) => {
                // Non-hosts receive enemy positions from host
                if (!multiplayer.isHost && payload.gridX === game.gridX && payload.gridY === game.gridY) {
                    syncEnemies(payload.enemies);
                }
            })
            .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
                addChatMessage(payload.playerName, payload.message);
            })
            .on('broadcast', { event: 'room_changed' }, ({ payload }) => {
                // Sync room state (visited/cleared) FIRST, before other player enters
                if (payload.roomState && game.rooms[payload.gridY] && game.rooms[payload.gridY][payload.gridX]) {
                    const room = game.rooms[payload.gridY][payload.gridX];
                    room.visited = payload.roomState.visited;
                    room.cleared = payload.roomState.cleared;
                    
                    // Also sync visited rooms set
                    if (payload.visitedRooms) {
                        payload.visitedRooms.forEach(roomKey => {
                            game.visitedRooms.add(roomKey);
                        });
                    }
                    
                    updateMinimap();
                }
                
                // Update other player's position
                if (payload.playerId !== multiplayer.playerId) {
                    handleOtherPlayerRoomChange(payload);
                    
                    // If host and another player entered the same room as us, sync enemies
                    if (multiplayer.isHost && payload.gridX === game.gridX && payload.gridY === game.gridY) {
                        console.log('👥 Teammate entered our room, syncing enemies...');
                        setTimeout(() => {
                            sendEnemyUpdate();
                        }, 150);
                    }
                }
            })
            .on('broadcast', { event: 'room_cleared' }, ({ payload }) => {
                // Mark room as cleared for all players
                if (game.rooms[payload.gridY] && game.rooms[payload.gridY][payload.gridX]) {
                    const room = game.rooms[payload.gridY][payload.gridX];
                    room.cleared = true;
                    
                    // If in this room, unlock doors
                    if (payload.gridX === game.gridX && payload.gridY === game.gridY) {
                        game.doors.forEach(door => door.blocked = false);
                    }
                    
                    updateMinimap();
                }
            })
            .on('broadcast', { event: 'spawn_indicators' }, ({ payload }) => {
                // Non-hosts receive spawn indicators from host
                if (!multiplayer.isHost && payload.gridX === game.gridX && payload.gridY === game.gridY) {
                    game.enemySpawnIndicators = payload.indicators;
                }
            })
            .on('broadcast', { event: 'next_floor' }, ({ payload }) => {
                // Non-hosts receive floor transition from host
                if (!multiplayer.isHost) {
                    console.log('🗺️ Received next floor seed from host:', payload.dungeonSeed);
                    const modifier = getDifficultyModifier();
                    
                    // Update level
                    game.player.level = payload.level;
                    if (!modifier.oneHPMode) {
                        game.player.maxHealth += 20;
                        game.player.health = game.player.maxHealth;
                    }
                    game.player.hasKey = false;
                    
                    // Generate dungeon with same seed as host
                    generateDungeonWithSeed(payload.dungeonSeed);
                    updateUI();
                }
            })
            .subscribe((status) => {
                console.log('📡 Channel status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Successfully subscribed to channel');
                    resolve();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.error('❌ Channel subscription failed:', status);
                    reject(new Error(`Channel subscription failed: ${status}`));
                }
            });
    });
}

// Show multiplayer lobby
async function showMultiplayerLobby() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('multiplayerLobby').style.display = 'flex';
    document.getElementById('lobbyRoomCode').textContent = multiplayer.roomCode;

    if (multiplayer.isHost) {
        document.getElementById('startGameButton').style.display = 'block';
    }

    await refreshPlayerList();
}

// Refresh player list in lobby
async function refreshPlayerList() {
    const supabase = await initSupabase();
    const { data: players } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', multiplayer.roomId);

    const playerListDiv = document.getElementById('lobbyPlayerList');
    if (players && playerListDiv) {
        playerListDiv.innerHTML = players.map(p => `
            <div class="lobby-player ${p.player_id === multiplayer.playerId ? 'you' : ''}">
                ${p.is_host ? '👑 ' : ''}${p.player_name}${p.player_id === multiplayer.playerId ? ' (You)' : ''}
            </div>
        `).join('');
    }
}

// Host starts the game
async function hostStartGame() {
    if (!multiplayer.isHost) return;

    console.log('🎮 Host starting game...');

    // Update room status
    const supabase = await initSupabase();
    await supabase
        .from('game_rooms')
        .update({ status: 'playing' })
        .eq('id', multiplayer.roomId);

    // Generate dungeon seed for synchronized dungeon across all players
    const dungeonSeed = Date.now() + Math.floor(Math.random() * 10000);
    
    // Broadcast game start with dungeon seed
    console.log('📢 Broadcasting game_started event with seed:', dungeonSeed);
    multiplayer.channel.send({
        type: 'broadcast',
        event: 'game_started',
        payload: { 
            difficulty: multiplayer.difficulty,
            dungeonSeed: dungeonSeed
        }
    });
}

// Start multiplayer game (called when receiving game_started event)
function startMultiplayerGame(difficulty, dungeonSeed) {
    console.log('🎮 Starting multiplayer game with difficulty:', difficulty, 'seed:', dungeonSeed);
    
    document.getElementById('multiplayerLobby').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    document.getElementById('multiplayerUI').style.display = 'block';

    game.difficulty = difficulty;
    const modifier = DIFFICULTY_MODIFIERS[difficulty];
    
    // Update difficulty display
    document.getElementById('difficultyDisplay').textContent = modifier.displayName;
    
    // Reset player stats for new game
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
    
    // Use seeded dungeon generation so all players get the same map!
    if (dungeonSeed) {
        console.log('🗺️ Generating synchronized dungeon with seed:', dungeonSeed);
        generateDungeonWithSeed(dungeonSeed);
    } else {
        // Fallback for older versions
        console.warn('⚠️ No dungeon seed provided, using random generation (maps will differ!)');
        generateDungeon();
    }
    
    updateUI();
    updateMultiplayerUI();
    
    // Resume game if it was paused
    game.paused = false;
}

// Update multiplayer player list in game
function updateMultiplayerUI() {
    const playerListDiv = document.getElementById('multiplayerPlayerList');
    if (!playerListDiv) return;

    let html = `<div class="mp-player" style="border-left-color: #4ecca3;">
        ${multiplayer.playerName} (You) - HP: ${Math.round(game.player.health)}
    </div>`;

    multiplayer.players.forEach((player, playerId) => {
        html += `<div class="mp-player">
            ${player.name} - HP: ${Math.round(player.health)}
        </div>`;
    });

    playerListDiv.innerHTML = html;
}

// Send player update with interpolation support
function sendPlayerUpdate() {
    if (!multiplayer.enabled || !multiplayer.channel) return;

    const now = Date.now();
    if (now - multiplayer.lastUpdateSent < multiplayer.updateInterval) return;
    multiplayer.lastUpdateSent = now;

    const currentWeapon = game.player.weapons[game.player.currentWeaponIndex];
    
    multiplayer.channel.send({
        type: 'broadcast',
        event: 'player_update',
        payload: {
            playerId: multiplayer.playerId,
            x: game.player.x,
            y: game.player.y,
            angle: game.player.angle,
            health: game.player.health,
            currentWeapon: currentWeapon ? currentWeapon.name : 'None',
            gridX: game.gridX,
            gridY: game.gridY,
            timestamp: now
        }
    });
}

// Update other player with smooth interpolation
function updateOtherPlayer(data) {
    let player = multiplayer.players.get(data.playerId);
    
    if (!player) {
        // New player - create with interpolation properties
        player = {
            name: data.playerName || 'Player',
            x: data.x,
            y: data.y,
            targetX: data.x,
            targetY: data.y,
            angle: data.angle,
            health: data.health,
            currentWeapon: data.currentWeapon,
            gridX: data.gridX,
            gridY: data.gridY,
            lastUpdate: Date.now()
        };
        multiplayer.players.set(data.playerId, player);
    } else {
        // Update existing player with interpolation
        player.targetX = data.x;
        player.targetY = data.y;
        player.angle = data.angle;
        player.health = data.health;
        player.currentWeapon = data.currentWeapon;
        player.gridX = data.gridX;
        player.gridY = data.gridY;
        player.lastUpdate = Date.now();
    }
    
    updateMultiplayerUI();
}

// Interpolate player positions for smooth movement
function interpolatePlayers(deltaTime) {
    if (!multiplayer.enabled) return;
    
    const interpolationSpeed = 0.3; // Adjust for smoothness (0-1, higher = faster)
    
    multiplayer.players.forEach((player, playerId) => {
        // Smoothly move towards target position
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        
        player.x += dx * interpolationSpeed * deltaTime;
        player.y += dy * interpolationSpeed * deltaTime;
    });
}

// Handle other player shooting
function handleOtherPlayerShot(data) {
    // Add bullet from other player
    if (data.bullet) {
        game.bullets.push({
            ...data.bullet,
            fromOtherPlayer: true
        });
    }
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

// Sync enemies from host (non-hosts only)
function syncEnemies(enemiesData) {
    // Don't override if we're the host
    if (multiplayer.isHost) return;
    
    // Update or create enemies based on host data
    // We'll match by position similarity since we don't have unique IDs
    
    // First, mark all current enemies as "not synced"
    game.enemies.forEach(e => e._synced = false);
    
    enemiesData.forEach(eData => {
        // Try to find matching enemy by position and type
        let enemy = game.enemies.find(e => 
            !e._synced && 
            e.type === eData.type &&
            Math.hypot(e.x - eData.x, e.y - eData.y) < 50
        );
        
        if (enemy) {
            // Update existing enemy with interpolation
            enemy.targetX = eData.x;
            enemy.targetY = eData.y;
            enemy.health = eData.health;
            enemy.maxHealth = eData.maxHealth;
            enemy.wanderAngle = eData.wanderAngle;
            enemy.wanderTimer = eData.wanderTimer;
            enemy.lastShot = eData.lastShot;
            
            // Boss-specific
            if (enemy.type === ENEMY_TYPES.BOSS) {
                enemy.shotPattern = eData.shotPattern;
            }
            
            // Dasher-specific
            if (enemy.type === ENEMY_TYPES.DASHER) {
                enemy.state = eData.state;
                enemy.dashDirection = eData.dashDirection;
                enemy.windupTime = eData.windupTime;
                enemy.dashStartTime = eData.dashStartTime;
                enemy.lastDash = eData.lastDash;
            }
            
            // Necromancer-specific
            if (enemy.type === ENEMY_TYPES.NECROMANCER) {
                enemy.lastSummon = eData.lastSummon;
            }
            
            // Summoned-specific
            if (enemy.type === ENEMY_TYPES.SUMMONED) {
                enemy.actualType = eData.actualType;
            }
            
            enemy._synced = true;
        } else {
            // Create new enemy
            const newEnemy = {
                x: eData.x,
                y: eData.y,
                targetX: eData.x,
                targetY: eData.y,
                size: eData.size,
                health: eData.health,
                maxHealth: eData.maxHealth,
                speed: eData.speed,
                color: eData.color,
                type: eData.type,
                wanderAngle: eData.wanderAngle || Math.random() * Math.PI * 2,
                wanderTimer: eData.wanderTimer || 0,
                lastShot: eData.lastShot || 0,
                _synced: true
            };
            
            // Boss-specific
            if (eData.type === ENEMY_TYPES.BOSS) {
                newEnemy.shotPattern = eData.shotPattern || 0;
            }
            
            // Dasher-specific
            if (eData.type === ENEMY_TYPES.DASHER) {
                newEnemy.state = eData.state || 'idle';
                newEnemy.dashDirection = eData.dashDirection || { x: 0, y: 0 };
                newEnemy.dashSpeed = 15;
                newEnemy.windupDuration = 600;
                newEnemy.dashDuration = 400;
                newEnemy.postDashCooldown = 800;
                newEnemy.dashCooldown = 1500;
                newEnemy.windupTime = eData.windupTime || 0;
                newEnemy.dashStartTime = eData.dashStartTime || 0;
                newEnemy.lastDash = eData.lastDash || 0;
            }
            
            // Necromancer-specific
            if (eData.type === ENEMY_TYPES.NECROMANCER) {
                newEnemy.lastSummon = eData.lastSummon || Date.now();
                newEnemy.summonCooldown = 5000;
                newEnemy.minions = [];
                newEnemy.healPerKill = 30 + (game.player?.level || 1) * 30;
            }
            
            // Summoned-specific
            if (eData.type === ENEMY_TYPES.SUMMONED) {
                newEnemy.actualType = eData.actualType;
                newEnemy.master = null; // Will be rebuilt by necromancer logic
            }
            
            game.enemies.push(newEnemy);
        }
    });
    
    // Remove enemies that weren't synced (they were killed on host)
    game.enemies = game.enemies.filter(e => e._synced);
    
    // Clean up sync flag
    game.enemies.forEach(e => delete e._synced);
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
                // Boss-specific
                shotPattern: e.shotPattern,
                // Dasher-specific
                state: e.state,
                dashDirection: e.dashDirection,
                windupTime: e.windupTime,
                dashStartTime: e.dashStartTime,
                lastDash: e.lastDash,
                // Necromancer-specific
                lastSummon: e.lastSummon,
                // Summoned-specific
                actualType: e.actualType
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

    // Remove from database
    if (multiplayer.roomId) {
        const supabase = await initSupabase();
        await supabase
            .from('room_players')
            .delete()
            .eq('room_id', multiplayer.roomId)
            .eq('player_id', multiplayer.playerId);
        
        // If host leaves, delete the room
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

    document.getElementById('multiplayerLobby').style.display = 'none';
    document.getElementById('multiplayerUI').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
    showMainMenu();
}

// Send spawn indicators (host only)
function sendSpawnIndicators() {
    if (!multiplayer.enabled || !multiplayer.isHost || !multiplayer.channel) return;

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

    const room = game.rooms[gridY] && game.rooms[gridY][gridX];
    multiplayer.channel.send({
        type: 'broadcast',
        event: 'room_changed',
        payload: {
            playerId: multiplayer.playerId,
            gridX: gridX,
            gridY: gridY,
            roomState: room ? {
                visited: room.visited,
                cleared: room.cleared
            } : null,
            visitedRooms: Array.from(game.visitedRooms) // Share all visited rooms
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
    // Update other player's room position if tracking
    const player = multiplayer.players.get(data.playerId);
    if (player) {
        player.gridX = data.gridX;
        player.gridY = data.gridY;
    }
}

console.log('✅ Multiplayer.js loaded - With position interpolation and proper enemy sync');