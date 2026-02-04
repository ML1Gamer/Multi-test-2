// Seeded random number generator for synchronized dungeon generation
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// Generate dungeon with seed for multiplayer synchronization
function generateDungeonWithSeed(seed) {
    const rng = new SeededRandom(seed);
    
    game.rooms = [];
    game.visitedRooms.clear();
    
    // Create grid
    const roomGrid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        roomGrid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            roomGrid[y][x] = null;
        }
    }

    // Start in center
    const startX = 2;
    const startY = 2;
    roomGrid[startY][startX] = new Room(startX, startY, ROOM_TYPES.START);
    
    const roomsToCreate = 14;
    let roomsCreated = 1;
    const frontier = [{ x: startX, y: startY }];

    // Generate connected rooms using seeded random
    while (roomsCreated < roomsToCreate && frontier.length > 0) {
        const current = frontier[Math.floor(rng.next() * frontier.length)];
        const directions = [
            { dx: 0, dy: -1, door: 'north', opposite: 'south' },
            { dx: 0, dy: 1, door: 'south', opposite: 'north' },
            { dx: 1, dy: 0, door: 'east', opposite: 'west' },
            { dx: -1, dy: 0, door: 'west', opposite: 'east' }
        ];

        // Shuffle directions using seeded random
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(rng.next() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        let added = false;
        for (const dir of directions) {
            const newX = current.x + dir.dx;
            const newY = current.y + dir.dy;

            if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE && !roomGrid[newY][newX]) {
                const newRoom = new Room(newX, newY, ROOM_TYPES.NORMAL);
                roomGrid[newY][newX] = newRoom;
                
                roomGrid[current.y][current.x].doors[dir.door] = true;
                newRoom.doors[dir.opposite] = true;
                
                frontier.push({ x: newX, y: newY });
                roomsCreated++;
                added = true;
                break;
            }
        }

        if (!added) {
            frontier.splice(frontier.indexOf(current), 1);
        }
    }

    // Assign special rooms using seeded random
    const normalRooms = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (roomGrid[y][x] && roomGrid[y][x].type === ROOM_TYPES.NORMAL) {
                normalRooms.push(roomGrid[y][x]);
            }
        }
    }

    // Check if this is a boss floor (every 5th floor)
    const isBossFloor = game.player.level % 5 === 0;

    if (isBossFloor && normalRooms.length > 0) {
        let farthestRoom = normalRooms[0];
        let maxDist = 0;
        normalRooms.forEach(room => {
            const dist = Math.abs(room.gridX - startX) + Math.abs(room.gridY - startY);
            if (dist > maxDist) {
                maxDist = dist;
                farthestRoom = room;
            }
        });
        farthestRoom.type = ROOM_TYPES.BOSS;
        normalRooms.splice(normalRooms.indexOf(farthestRoom), 1);
    } else {
        if (normalRooms.length > 0) {
            let farthestRoom = normalRooms[0];
            let maxDist = 0;
            normalRooms.forEach(room => {
                const dist = Math.abs(room.gridX - startX) + Math.abs(room.gridY - startY);
                if (dist > maxDist) {
                    maxDist = dist;
                    farthestRoom = room;
                }
            });
            farthestRoom.type = ROOM_TYPES.BOSS;
            normalRooms.splice(normalRooms.indexOf(farthestRoom), 1);
        }

        if (normalRooms.length > 0) {
            const keyRoom = normalRooms[Math.floor(rng.next() * normalRooms.length)];
            keyRoom.type = ROOM_TYPES.KEY;
            normalRooms.splice(normalRooms.indexOf(keyRoom), 1);
        }
    }

    // ALWAYS add a mini-boss room on every floor
    if (normalRooms.length > 0) {
        const miniBossRoom = normalRooms[Math.floor(rng.next() * normalRooms.length)];
        miniBossRoom.type = ROOM_TYPES.MINIBOSS;
        const miniBossTypes = Object.values(MINIBOSS_TYPES);
        miniBossRoom.miniBossType = miniBossTypes[Math.floor(rng.next() * miniBossTypes.length)];
        normalRooms.splice(normalRooms.indexOf(miniBossRoom), 1);
    }

    // 25% chance for gun room
    if (normalRooms.length > 0 && rng.next() < 0.25) {
        const gunRoom = normalRooms[Math.floor(rng.next() * normalRooms.length)];
        gunRoom.type = ROOM_TYPES.GUN;
        normalRooms.splice(normalRooms.indexOf(gunRoom), 1);
    }

    // Always add a shop room
    if (normalRooms.length > 0) {
        const shopRoom = normalRooms[Math.floor(rng.next() * normalRooms.length)];
        shopRoom.type = ROOM_TYPES.SHOP;
        normalRooms.splice(normalRooms.indexOf(shopRoom), 1);
    }

    if (normalRooms.length > 0) {
        const treasureRoom = normalRooms[Math.floor(rng.next() * normalRooms.length)];
        treasureRoom.type = ROOM_TYPES.TREASURE;
    }

    game.rooms = roomGrid;
    game.gridX = startX;
    game.gridY = startY;
    game.currentRoom = roomGrid[startY][startX];
    
    enterRoom(game.currentRoom);
}

// Dungeon generation and room entry
function generateDungeon() {
    game.rooms = [];
    game.visitedRooms.clear();
    
    // Create grid
    const roomGrid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        roomGrid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            roomGrid[y][x] = null;
        }
    }

    // Start in center
    const startX = 2;
    const startY = 2;
    roomGrid[startY][startX] = new Room(startX, startY, ROOM_TYPES.START);
    
    const roomsToCreate = 14;
    let roomsCreated = 1;
    const frontier = [{ x: startX, y: startY }];

    // Generate connected rooms
    while (roomsCreated < roomsToCreate && frontier.length > 0) {
        const current = frontier[Math.floor(Math.random() * frontier.length)];
        const directions = [
            { dx: 0, dy: -1, door: 'north', opposite: 'south' },
            { dx: 0, dy: 1, door: 'south', opposite: 'north' },
            { dx: 1, dy: 0, door: 'east', opposite: 'west' },
            { dx: -1, dy: 0, door: 'west', opposite: 'east' }
        ];

        directions.sort(() => Math.random() - 0.5);

        let added = false;
        for (const dir of directions) {
            const newX = current.x + dir.dx;
            const newY = current.y + dir.dy;

            if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE && !roomGrid[newY][newX]) {
                const newRoom = new Room(newX, newY, ROOM_TYPES.NORMAL);
                roomGrid[newY][newX] = newRoom;
                
                roomGrid[current.y][current.x].doors[dir.door] = true;
                newRoom.doors[dir.opposite] = true;
                
                frontier.push({ x: newX, y: newY });
                roomsCreated++;
                added = true;
                break;
            }
        }

        if (!added) {
            frontier.splice(frontier.indexOf(current), 1);
        }
    }

    // Assign special rooms
    const normalRooms = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (roomGrid[y][x] && roomGrid[y][x].type === ROOM_TYPES.NORMAL) {
                normalRooms.push(roomGrid[y][x]);
            }
        }
    }

    // Check if this is a boss floor (every 5th floor)
    const isBossFloor = game.player.level % 5 === 0;

    if (isBossFloor && normalRooms.length > 0) {
        // On boss floors, make the farthest room the boss room
        let farthestRoom = normalRooms[0];
        let maxDist = 0;
        normalRooms.forEach(room => {
            const dist = Math.abs(room.gridX - startX) + Math.abs(room.gridY - startY);
            if (dist > maxDist) {
                maxDist = dist;
                farthestRoom = room;
            }
        });
        farthestRoom.type = ROOM_TYPES.BOSS;
        normalRooms.splice(normalRooms.indexOf(farthestRoom), 1);
    } else {
        // Non-boss floors: add key room
        if (normalRooms.length > 0) {
            let farthestRoom = normalRooms[0];
            let maxDist = 0;
            normalRooms.forEach(room => {
                const dist = Math.abs(room.gridX - startX) + Math.abs(room.gridY - startY);
                if (dist > maxDist) {
                    maxDist = dist;
                    farthestRoom = room;
                }
            });
            farthestRoom.type = ROOM_TYPES.BOSS;
            normalRooms.splice(normalRooms.indexOf(farthestRoom), 1);
        }

        if (normalRooms.length > 0) {
            const keyRoom = normalRooms[Math.floor(Math.random() * normalRooms.length)];
            keyRoom.type = ROOM_TYPES.KEY;
            normalRooms.splice(normalRooms.indexOf(keyRoom), 1);
        }
    }

    // ALWAYS add a mini-boss room on every floor
    if (normalRooms.length > 0) {
        const miniBossRoom = normalRooms[Math.floor(Math.random() * normalRooms.length)];
        miniBossRoom.type = ROOM_TYPES.MINIBOSS;
        // Pick a random mini-boss type
        const miniBossTypes = Object.values(MINIBOSS_TYPES);
        miniBossRoom.miniBossType = miniBossTypes[Math.floor(Math.random() * miniBossTypes.length)];
        normalRooms.splice(normalRooms.indexOf(miniBossRoom), 1);
    }

    // 25% chance for gun room
    if (normalRooms.length > 0 && Math.random() < 0.25) {
        const gunRoom = normalRooms[Math.floor(Math.random() * normalRooms.length)];
        gunRoom.type = ROOM_TYPES.GUN;
        normalRooms.splice(normalRooms.indexOf(gunRoom), 1);
    }

    // Always add a shop room
    if (normalRooms.length > 0) {
        const shopRoom = normalRooms[Math.floor(Math.random() * normalRooms.length)];
        shopRoom.type = ROOM_TYPES.SHOP;
        normalRooms.splice(normalRooms.indexOf(shopRoom), 1);
    }

    if (normalRooms.length > 0) {
        const treasureRoom = normalRooms[Math.floor(Math.random() * normalRooms.length)];
        treasureRoom.type = ROOM_TYPES.TREASURE;
    }

    game.rooms = roomGrid;
    game.gridX = startX;
    game.gridY = startY;
    game.currentRoom = roomGrid[startY][startX];
    
    enterRoom(game.currentRoom);
}

function enterRoom(room) {
    if (!room) return;

    game.player.x = ROOM_WIDTH / 2;
    game.player.y = ROOM_HEIGHT / 2;
    game.enemies = [];
    game.enemyBullets = [];
    game.items = [];
    game.doors = [];
    game.walls = [];
    game.enemySpawnIndicators = []; // Clear spawn indicators

    // Play appropriate music for room type
    if (room.type === ROOM_TYPES.SHOP) {
        createMusicLoop(ROOM_TYPES.SHOP);
    } else if (room.type === ROOM_TYPES.START) {
        createMusicLoop(ROOM_TYPES.START);
    } else if (room.type === ROOM_TYPES.BOSS || room.type === ROOM_TYPES.MINIBOSS) {
        if (room.visited && !room.cleared) {
            createMusicLoop(ROOM_TYPES.BOSS);
        } else {
            createMusicLoop(ROOM_TYPES.NORMAL);
        }
    } else {
        createMusicLoop(ROOM_TYPES.NORMAL);
    }

    // Create room walls
    game.walls.push({ x: 0, y: 0, w: ROOM_WIDTH, h: 20 });
    game.walls.push({ x: 0, y: ROOM_HEIGHT - 20, w: ROOM_WIDTH, h: 20 });
    game.walls.push({ x: 0, y: 0, w: 20, h: ROOM_HEIGHT });
    game.walls.push({ x: ROOM_WIDTH - 20, y: 0, w: 20, h: ROOM_HEIGHT });

    // Create doors
    const shouldBlockDoors = room.visited && !room.cleared && (room.type === ROOM_TYPES.NORMAL || room.type === ROOM_TYPES.MINIBOSS);
    
    if (room.doors.north) {
        game.doors.push({ 
            x: ROOM_WIDTH / 2 - DOOR_SIZE / 2, 
            y: 0, 
            w: DOOR_SIZE, 
            h: 30, 
            direction: 'north',
            blocked: shouldBlockDoors
        });
        game.walls = game.walls.filter(w => !(w.y === 0 && w.h === 20));
        game.walls.push({ x: 0, y: 0, w: ROOM_WIDTH / 2 - DOOR_SIZE / 2, h: 20 });
        game.walls.push({ x: ROOM_WIDTH / 2 + DOOR_SIZE / 2, y: 0, w: ROOM_WIDTH / 2 - DOOR_SIZE / 2, h: 20 });
    }
    if (room.doors.south) {
        game.doors.push({ 
            x: ROOM_WIDTH / 2 - DOOR_SIZE / 2, 
            y: ROOM_HEIGHT - 30, 
            w: DOOR_SIZE, 
            h: 30, 
            direction: 'south',
            blocked: shouldBlockDoors
        });
        game.walls = game.walls.filter(w => !(w.y === ROOM_HEIGHT - 20 && w.h === 20));
        game.walls.push({ x: 0, y: ROOM_HEIGHT - 20, w: ROOM_WIDTH / 2 - DOOR_SIZE / 2, h: 20 });
        game.walls.push({ x: ROOM_WIDTH / 2 + DOOR_SIZE / 2, y: ROOM_HEIGHT - 20, w: ROOM_WIDTH / 2 - DOOR_SIZE / 2, h: 20 });
    }
    if (room.doors.east) {
        game.doors.push({ 
            x: ROOM_WIDTH - 30, 
            y: ROOM_HEIGHT / 2 - DOOR_SIZE / 2, 
            w: 30, 
            h: DOOR_SIZE, 
            direction: 'east',
            blocked: shouldBlockDoors
        });
        game.walls = game.walls.filter(w => !(w.x === ROOM_WIDTH - 20 && w.w === 20));
        game.walls.push({ x: ROOM_WIDTH - 20, y: 0, w: 20, h: ROOM_HEIGHT / 2 - DOOR_SIZE / 2 });
        game.walls.push({ x: ROOM_WIDTH - 20, y: ROOM_HEIGHT / 2 + DOOR_SIZE / 2, w: 20, h: ROOM_HEIGHT / 2 - DOOR_SIZE / 2 });
    }
    if (room.doors.west) {
        game.doors.push({ 
            x: 0, 
            y: ROOM_HEIGHT / 2 - DOOR_SIZE / 2, 
            w: 30, 
            h: DOOR_SIZE, 
            direction: 'west',
            blocked: shouldBlockDoors
        });
        game.walls = game.walls.filter(w => !(w.x === 0 && w.w === 20));
        game.walls.push({ x: 0, y: 0, w: 20, h: ROOM_HEIGHT / 2 - DOOR_SIZE / 2 });
        game.walls.push({ x: 0, y: ROOM_HEIGHT / 2 + DOOR_SIZE / 2, w: 20, h: ROOM_HEIGHT / 2 - DOOR_SIZE / 2 });
    }

    // MULTIPLAYER FIX: Check if room was visited BY THIS CLIENT
    // In multiplayer, room.visited can be true from other players, but this client hasn't entered yet
    const roomKey = `${room.gridX},${room.gridY}`;
    const wasVisitedByMe = game.visitedRooms.has(roomKey);
    
    if (!wasVisitedByMe) {
        // Mark as visited by this client
        room.visited = true;
        game.visitedRooms.add(roomKey);

        // Spawn content based on room type
        const isBossFloor = game.player.level % 5 === 0;
        
        if (room.type === ROOM_TYPES.NORMAL) {
            // MULTIPLAYER FIX: Any player can spawn enemies when entering an uncleared room
            // But only if no enemies currently exist (to prevent duplicate spawns)
            const shouldSpawn = !room.cleared && game.enemies.length === 0;
            
            if (!multiplayer.enabled) {
                // Singleplayer: always spawn
                spawnEnemiesInRoom(room);
            } else if (shouldSpawn) {
                // Multiplayer: spawn only if room needs enemies
                // Host or non-host can trigger, but check prevents duplicates
                spawnEnemiesInRoom(room);
                
                // If host, will sync to others. If non-host, host will override shortly
                // This prevents the "waiting for host" issue
                if (multiplayer.isHost) {
                    // Host immediately broadcasts spawn indicators
                    setTimeout(() => {
                        if (game.enemySpawnIndicators.length > 0) {
                            sendSpawnIndicators();
                        }
                    }, 100);
                }
            }
        } else if (room.type === ROOM_TYPES.MINIBOSS) {
            // Add pedestal to summon mini-boss
            game.items.push({
                x: ROOM_WIDTH / 2,
                y: ROOM_HEIGHT / 2,
                type: 'miniboss_pedestal',
                miniBossType: room.miniBossType,
                size: 30
            });
            room.cleared = false; // Room not cleared until mini-boss defeated
        } else if (room.type === ROOM_TYPES.BOSS) {
            if (isBossFloor) {
                // Boss floor - spawn boss immediately
                // In multiplayer, only host spawns boss
                if (!multiplayer.enabled || multiplayer.isHost) {
                    spawnBoss(room);
                }
            } else {
                // Regular floor - need key first
                if (game.player.hasKey) {
                    room.bossRoomUnlocked = true;
                    spawnBossRoom(room);
                } else {
                    game.items.push({
                        x: ROOM_WIDTH / 2,
                        y: ROOM_HEIGHT / 2,
                        type: 'locked_door',
                        size: 40
                    });
                }
            }
        } else if (room.type === ROOM_TYPES.KEY) {
            game.items.push({
                x: ROOM_WIDTH / 2,
                y: ROOM_HEIGHT / 2,
                type: 'key',
                size: 20
            });
            room.cleared = true;
        } else if (room.type === ROOM_TYPES.SHOP) {
            game.items.push({
                x: ROOM_WIDTH / 2,
                y: ROOM_HEIGHT / 2,
                type: 'shop',
                size: 30
            });
            room.cleared = true;
        } else if (room.type === ROOM_TYPES.GUN) {
            game.items.push({
                x: ROOM_WIDTH / 2,
                y: ROOM_HEIGHT / 2,
                type: 'gun_box',
                size: 25
            });
            room.cleared = true;
        } else if (room.type === ROOM_TYPES.TREASURE) {
            const randomWeapon = getRandomWeapon();
            game.items.push({
                x: ROOM_WIDTH / 2 - 50,
                y: ROOM_HEIGHT / 2,
                type: 'weapon',
                data: randomWeapon,
                size: 15
            });
            game.items.push({
                x: ROOM_WIDTH / 2 + 50,
                y: ROOM_HEIGHT / 2,
                type: 'powerup',
                data: 'health',
                size: 15
            });
            room.cleared = true;
        } else if (room.type === ROOM_TYPES.START) {
            room.cleared = true;
        }
    } else {
        // Re-entering room (already visited by this client)
        const isBossFloor = game.player.level % 5 === 0;
        
        if (room.type === ROOM_TYPES.MINIBOSS) {
            if (room.cleared) {
                // Mini-boss already defeated, show loot
                // Loot is handled when mini-boss dies
            } else {
                // Show pedestal again
                game.items.push({
                    x: ROOM_WIDTH / 2,
                    y: ROOM_HEIGHT / 2,
                    type: 'miniboss_pedestal',
                    miniBossType: room.miniBossType,
                    size: 30
                });
            }
        } else if (room.type === ROOM_TYPES.BOSS) {
            if (isBossFloor) {
                // Boss floor - check if boss was defeated
                if (room.cleared) {
                    game.items.push({
                        x: ROOM_WIDTH / 2,
                        y: ROOM_HEIGHT / 2,
                        type: 'next_floor',
                        size: 40
                    });
                } else {
                    // Respawn boss if not cleared
                    // In multiplayer, only host spawns boss
                    if (!multiplayer.enabled || multiplayer.isHost) {
                        spawnBoss(room);
                    }
                }
            } else {
                // Regular floor
                if (game.player.hasKey && !room.bossRoomUnlocked) {
                    room.bossRoomUnlocked = true;
                    spawnBossRoom(room);
                } else if (room.bossRoomUnlocked) {
                    game.items.push({
                        x: ROOM_WIDTH / 2,
                        y: ROOM_HEIGHT / 2,
                        type: 'next_floor',
                        size: 40
                    });
                } else {
                    game.items.push({
                        x: ROOM_WIDTH / 2,
                        y: ROOM_HEIGHT / 2,
                        type: 'locked_door',
                        size: 40
                    });
                }
            }
        } else if (room.type === ROOM_TYPES.SHOP) {
            game.items.push({
                x: ROOM_WIDTH / 2,
                y: ROOM_HEIGHT / 2,
                type: 'shop',
                size: 30
            });
        }
    }

    updateMinimap();
    
    // MULTIPLAYER FIX: Request enemy sync after entering room
    if (multiplayer.enabled && !multiplayer.isHost) {
        // Delay request slightly to ensure room change is processed
        setTimeout(() => {
            requestRoomEnemySync(game.gridX, game.gridY);
        }, 200);
    }
}

function spawnBossRoom(room) {
    game.items.push({
        x: ROOM_WIDTH / 2,
        y: ROOM_HEIGHT / 2,
        type: 'next_floor',
        size: 40
    });
    room.cleared = true;
}
