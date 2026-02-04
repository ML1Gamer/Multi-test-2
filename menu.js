// Menu system and save/load functionality

function showMainMenu() {
    document.getElementById('mainMenuButtons').style.display = 'flex';
    document.getElementById('difficultyMenu').style.display = 'none';
    document.getElementById('settingsMenu').style.display = 'none';
    document.getElementById('multiplayerMenu').style.display = 'none';
    document.getElementById('createRoomMenu').style.display = 'none';
    document.getElementById('joinRoomMenu').style.display = 'none';
}

function showMultiplayerMenu() {
    document.getElementById('mainMenuButtons').style.display = 'none';
    document.getElementById('multiplayerMenu').style.display = 'block';
}

function showCreateRoomMenu() {
    document.getElementById('multiplayerMenu').style.display = 'none';
    document.getElementById('createRoomMenu').style.display = 'block';
}

function showJoinRoomMenu() {
    document.getElementById('multiplayerMenu').style.display = 'none';
    document.getElementById('joinRoomMenu').style.display = 'block';
}

function joinRoomWithCode() {
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (roomCode.length === 6) {
        joinMultiplayerRoom(roomCode);
    } else {
        alert('Please enter a valid 6-character room code');
    }
}

// hostStartGame is defined in multiplayer.js (Supabase Realtime version)

function showNewGameMenu() {
    document.getElementById('mainMenuButtons').style.display = 'none';
    document.getElementById('difficultyMenu').style.display = 'block';
}

function showSettings() {
    document.getElementById('mainMenuButtons').style.display = 'none';
    document.getElementById('settingsMenu').style.display = 'block';
    
    // Sync sliders with current settings
    const musicVolume = musicGainNode ? musicGainNode.gain.value * 100 : 30;
    const sfxVolume = sfxGainNode ? sfxGainNode.gain.value * 100 : 40;
    
    document.getElementById('menuMusicVolume').value = musicVolume;
    document.getElementById('menuSFXVolume').value = sfxVolume;
    document.getElementById('musicVolumeDisplay').textContent = Math.round(musicVolume);
    document.getElementById('sfxVolumeDisplay').textContent = Math.round(sfxVolume);
}

function startNewGame(difficulty) {
    game.difficulty = difficulty;
    const modifier = DIFFICULTY_MODIFIERS[difficulty];
    
    // Hide main menu
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    
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
    
    generateDungeon();
    updateUI();
    
    // Resume game if it was paused
    game.paused = false;
}

function serializeRooms() {
    const serializedRooms = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        serializedRooms[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            if (game.rooms[y] && game.rooms[y][x]) {
                const room = game.rooms[y][x];
                serializedRooms[y][x] = {
                    gridX: room.gridX,
                    gridY: room.gridY,
                    type: room.type,
                    cleared: room.cleared,
                    visited: room.visited,
                    bossRoomUnlocked: room.bossRoomUnlocked,
                    miniBossType: room.miniBossType,
                    shopInventory: room.shopInventory,
                    doors: { ...room.doors }
                };
            } else {
                serializedRooms[y][x] = null;
            }
        }
    }
    return serializedRooms;
}

function deserializeRooms(serializedRooms) {
    const rooms = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        rooms[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            if (serializedRooms[y] && serializedRooms[y][x]) {
                const roomData = serializedRooms[y][x];
                const room = new Room(roomData.gridX, roomData.gridY, roomData.type);
                room.cleared = roomData.cleared;
                room.visited = roomData.visited;
                room.bossRoomUnlocked = roomData.bossRoomUnlocked;
                room.miniBossType = roomData.miniBossType;
                room.shopInventory = roomData.shopInventory;
                room.doors = { ...roomData.doors };
                rooms[y][x] = room;
            } else {
                rooms[y][x] = null;
            }
        }
    }
    return rooms;
}

function loadGame() {
    const savedGame = localStorage.getItem('dungeonCrawlerSave');
    
    if (!savedGame) {
        alert('No saved game found!');
        return;
    }
    
    try {
        const saveData = JSON.parse(savedGame);
        
        // Restore difficulty
        game.difficulty = saveData.difficulty || 'normal';
        const modifier = DIFFICULTY_MODIFIERS[game.difficulty];
        
        // Restore player state - fix weapon ammo for melee
        game.player = saveData.player;
        
        // Fix melee weapon ammo if it became null/undefined
        game.player.weapons.forEach(weapon => {
            if (weapon.isMelee && (weapon.ammo === null || weapon.ammo === undefined)) {
                weapon.ammo = Infinity;
            }
        });
        
        game.gridX = saveData.gridX;
        game.gridY = saveData.gridY;
        game.visitedRooms = new Set(saveData.visitedRooms);
        
        // Restore the entire dungeon layout
        if (saveData.roomsLayout) {
            game.rooms = deserializeRooms(saveData.roomsLayout);
        } else {
            // Fallback for old saves without room layout
            generateDungeon();
            
            // Restore visited rooms state
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE; x++) {
                    if (game.rooms[y] && game.rooms[y][x]) {
                        const key = `${x},${y}`;
                        if (game.visitedRooms.has(key)) {
                            game.rooms[y][x].visited = true;
                            if (saveData.clearedRooms && saveData.clearedRooms.includes(key)) {
                                game.rooms[y][x].cleared = true;
                            }
                        }
                    }
                }
            }
        }
        
        // Hide main menu
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'flex';
        
        // Update difficulty display
        document.getElementById('difficultyDisplay').textContent = modifier.displayName;
        
        game.currentRoom = game.rooms[game.gridY][game.gridX];
        enterRoom(game.currentRoom);
        updateUI();
        updateMinimap();
        
        game.paused = false;
        
    } catch (e) {
        console.error('Failed to load game:', e);
        alert('Failed to load save file!');
    }
}

function saveGame() {
    const clearedRooms = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (game.rooms[y] && game.rooms[y][x] && game.rooms[y][x].cleared) {
                clearedRooms.push(`${x},${y}`);
            }
        }
    }
    
    const saveData = {
        difficulty: game.difficulty,
        player: game.player,
        gridX: game.gridX,
        gridY: game.gridY,
        visitedRooms: Array.from(game.visitedRooms),
        clearedRooms: clearedRooms,
        roomsLayout: serializeRooms(), // Save entire dungeon layout
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem('dungeonCrawlerSave', JSON.stringify(saveData));
        alert('Game saved successfully!');
    } catch (e) {
        console.error('Failed to save game:', e);
        alert('Failed to save game!');
    }
}

function pauseGame() {
    game.paused = true;
    document.getElementById('overlay').classList.add('active');
    document.getElementById('pauseMenu').classList.add('active');
}

function resumeGame() {
    game.paused = false;
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('pauseMenu').classList.remove('active');
}

function pauseShowSettings() {
    // Hide pause menu, show settings in pause mode
    document.getElementById('pauseMenu').classList.remove('active');
    
    // Sync sliders
    const musicVolume = musicGainNode ? musicGainNode.gain.value * 100 : 30;
    const sfxVolume = sfxGainNode ? sfxGainNode.gain.value * 100 : 40;
    
    document.getElementById('musicVolume').value = musicVolume;
    document.getElementById('sfxVolume').value = sfxVolume;
}

function quitToMenu() {
    if (confirm('Are you sure you want to quit to menu? Unsaved progress will be lost!')) {
        // Reset game state
        game.paused = false;
        document.getElementById('overlay').classList.remove('active');
        document.getElementById('pauseMenu').classList.remove('active');
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'flex';
        showMainMenu();
        
        // Stop music
        stopMusic();
    }
}

// Setup volume sliders
function setupVolumeControls() {
    // Main menu sliders
    document.getElementById('menuMusicVolume').addEventListener('input', (e) => {
        setMusicVolume(e.target.value / 100);
        document.getElementById('musicVolumeDisplay').textContent = e.target.value;
    });
    
    document.getElementById('menuSFXVolume').addEventListener('input', (e) => {
        setSFXVolume(e.target.value / 100);
        document.getElementById('sfxVolumeDisplay').textContent = e.target.value;
    });
}

// Get difficulty modifier
function getDifficultyModifier() {
    return DIFFICULTY_MODIFIERS[game.difficulty] || DIFFICULTY_MODIFIERS.normal;
}