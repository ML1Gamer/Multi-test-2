// UI updates
function updateUI() {
    // Remove weapons with no ammo (except melee)
    for (let i = game.player.weapons.length - 1; i >= 0; i--) {
        const weapon = game.player.weapons[i];
        if (!weapon.isMelee && weapon.ammo !== Infinity && weapon.ammo <= 0) {
            game.player.weapons.splice(i, 1);
            if (game.player.currentWeaponIndex >= game.player.weapons.length) {
                game.player.currentWeaponIndex = Math.max(0, game.player.weapons.length - 1);
            }
        }
    }
    
    const healthPercent = (game.player.health / game.player.maxHealth) * 100;
    document.getElementById('healthBar').style.width = healthPercent + '%';
    document.getElementById('healthText').textContent = 
        Math.round(game.player.health) + '/' + game.player.maxHealth;
    document.getElementById('level').textContent = game.player.level;
    document.getElementById('money').textContent = game.player.money;
    document.getElementById('enemyCount').textContent = game.enemies.length;
    document.getElementById('score').textContent = game.player.score;
    document.getElementById('keyStatus').textContent = game.player.hasKey ? '🔑 Has Key!' : '🔑 No Key';
    
    const currentWeapon = game.player.weapons[game.player.currentWeaponIndex];
    if (currentWeapon) {
        const ammoDisplay = currentWeapon.ammo === Infinity ? '∞' : currentWeapon.ammo;
        document.getElementById('currentWeapon').textContent = `${currentWeapon.name} (${ammoDisplay})`;
    } else {
        document.getElementById('currentWeapon').textContent = 'None';
    }
    
    const weaponList = document.getElementById('weaponList');
    weaponList.innerHTML = game.player.weapons.map((weapon, i) => {
        const ammoDisplay = weapon.ammo === Infinity ? '∞' : weapon.ammo;
        let specialTag = '';
        if (weapon.canRefill === false) specialTag = ' <span style="color: #e94560;">[NO REFILL]</span>';
        else if (weapon.penetrating) specialTag = ' <span style="color: #ffd700;">[PIERCE]</span>';
        else if (weapon.explosive) specialTag = ' <span style="color: #ff8c00;">[EXPLOSIVE]</span>';
        else if (weapon.burstCount) specialTag = ' <span style="color: #4ecca3;">[BURST x' + weapon.burstCount + ']</span>';
        
        return `<div class="weapon-item ${i === game.player.currentWeaponIndex ? 'active-weapon' : ''}">
            ${i + 1}. ${weapon.name} - DMG: ${weapon.damage} | Ammo: ${ammoDisplay}${specialTag}
        </div>`;
    }).join('');

    // Update gear display
    const stats = getPlayerStats();
    const gearList = document.getElementById('gearList');
    const gearSlots = ['helmet', 'vest', 'gloves', 'bag', 'shoes', 'ammoType'];
    
    gearList.innerHTML = gearSlots.map(slot => {
        const gear = game.player.gear[slot];
        const slotName = slot.charAt(0).toUpperCase() + slot.slice(1).replace(/([A-Z])/g, ' $1');
        if (gear) {
            return `<div class="gear-slot equipped">
                ${gear.emoji} ${slotName}: ${gear.name}
            </div>`;
        } else {
            return `<div class="gear-slot">
                ${slotName}: Empty
            </div>`;
        }
    }).join('');
}

function updateMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    const cellSize = 35;
    const offsetX = 15;
    const offsetY = 15;

    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const room = game.rooms[y] ? game.rooms[y][x] : null;
            if (room && room.visited) {
                const px = offsetX + x * cellSize;
                const py = offsetY + y * cellSize;
                
                if (room.type === ROOM_TYPES.START) {
                    minimapCtx.fillStyle = '#4ecca3';
                } else if (room.type === ROOM_TYPES.BOSS) {
                    minimapCtx.fillStyle = '#e94560';
                } else if (room.type === ROOM_TYPES.MINIBOSS) {
                    minimapCtx.fillStyle = '#ff00ff'; // Purple for mini-boss rooms
                } else if (room.type === ROOM_TYPES.KEY) {
                    minimapCtx.fillStyle = '#ffd700';
                } else if (room.type === ROOM_TYPES.SHOP) {
                    minimapCtx.fillStyle = '#4ecca3';
                } else if (room.type === ROOM_TYPES.GUN) {
                    minimapCtx.fillStyle = '#d4a574';
                } else if (room.type === ROOM_TYPES.TREASURE) {
                    minimapCtx.fillStyle = '#9b59b6';
                } else {
                    minimapCtx.fillStyle = room.cleared ? '#555' : '#333';
                }
                
                minimapCtx.fillRect(px, py, cellSize - 5, cellSize - 5);
                
                // Highlight current player's room
                if (x === game.gridX && y === game.gridY) {
                    minimapCtx.strokeStyle = '#fff';
                    minimapCtx.lineWidth = 3;
                    minimapCtx.strokeRect(px, py, cellSize - 5, cellSize - 5);
                }
                
                // Draw other players' positions on minimap
                if (multiplayer.enabled && multiplayer.players.size > 0) {
                    multiplayer.players.forEach((otherPlayer, playerId) => {
                        if (otherPlayer.gridX === x && otherPlayer.gridY === y) {
                            minimapCtx.fillStyle = '#ff6b9d';
                            minimapCtx.beginPath();
                            minimapCtx.arc(px + (cellSize - 5) / 2, py + (cellSize - 5) / 2, 4, 0, Math.PI * 2);
                            minimapCtx.fill();
                        }
                    });
                }
                
                minimapCtx.strokeStyle = '#888';
                minimapCtx.lineWidth = 2;
                if (room.doors.north) {
                    minimapCtx.beginPath();
                    minimapCtx.moveTo(px + cellSize/2 - 2.5, py);
                    minimapCtx.lineTo(px + cellSize/2 - 2.5, py - 5);
                    minimapCtx.stroke();
                }
                if (room.doors.south) {
                    minimapCtx.beginPath();
                    minimapCtx.moveTo(px + cellSize/2 - 2.5, py + cellSize - 5);
                    minimapCtx.lineTo(px + cellSize/2 - 2.5, py + cellSize);
                    minimapCtx.stroke();
                }
                if (room.doors.east) {
                    minimapCtx.beginPath();
                    minimapCtx.moveTo(px + cellSize - 5, py + cellSize/2 - 2.5);
                    minimapCtx.lineTo(px + cellSize, py + cellSize/2 - 2.5);
                    minimapCtx.stroke();
                }
                if (room.doors.west) {
                    minimapCtx.beginPath();
                    minimapCtx.moveTo(px, py + cellSize/2 - 2.5);
                    minimapCtx.lineTo(px - 5, py + cellSize/2 - 2.5);
                    minimapCtx.stroke();
                }
            }
        }
    }
}