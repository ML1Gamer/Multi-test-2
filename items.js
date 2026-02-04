// Item pickup and shop functionality
function pickupNearbyItems() {
    for (let i = game.items.length - 1; i >= 0; i--) {
        const item = game.items[i];
        const dist = Math.hypot(item.x - game.player.x, item.y - game.player.y);
        
        if (dist < 50) {
            // Auto-pickup for consumables only
            if (item.type === 'powerup') {
                if (item.data === 'health') {
                    const modifier = getDifficultyModifier();
                    // No healing in impossible mode
                    if (!modifier.oneHPMode) {
                        game.player.health = Math.min(game.player.maxHealth, game.player.health + 30);
                        createParticles(item.x, item.y, '#e94560', 10);
                        playPickupSound('health');
                    } else {
                        // In impossible mode, just play sound and remove
                        createParticles(item.x, item.y, '#666', 5);
                    }
                }
                game.items.splice(i, 1);
            } else if (item.type === 'money') {
                game.player.money += item.amount;
                createParticles(item.x, item.y, '#ffd700', 10);
                playPickupSound('money');
                game.items.splice(i, 1);
            } else if (item.type === 'ammo') {
                let weaponToRefill = null;
                const currentWeapon = game.player.weapons[game.player.currentWeaponIndex];
                
                if (currentWeapon && !currentWeapon.isMelee && currentWeapon.ammo !== Infinity && currentWeapon.canRefill !== false) {
                    weaponToRefill = currentWeapon;
                } else {
                    const guns = game.player.weapons.filter(w => !w.isMelee && w.ammo !== Infinity && w.canRefill !== false);
                    if (guns.length > 0) {
                        weaponToRefill = guns[Math.floor(Math.random() * guns.length)];
                    }
                }
                
                if (weaponToRefill) {
                    const stats = getPlayerStats();
                    weaponToRefill.ammo += Math.floor(item.amount * stats.ammoMult);
                    createParticles(item.x, item.y, '#ffa500', 15);
                    playPickupSound('ammo');
                } else {
                    createParticles(item.x, item.y, '#666', 10);
                }
                game.items.splice(i, 1);
            }
            
            updateUI();
        }
    }
}

function manualPickup() {
    for (let i = game.items.length - 1; i >= 0; i--) {
        const item = game.items[i];
        const dist = Math.hypot(item.x - game.player.x, item.y - game.player.y);
        
        if (dist < 50) {
            if (item.type === 'key') {
                game.player.hasKey = true;
                createParticles(item.x, item.y, '#ffd700', 20);
                playPickupSound('key');
                game.items.splice(i, 1);
            } else if (item.type === 'miniboss_pedestal') {
                // Summon mini-boss!
                spawnMiniBoss(item.miniBossType);
                game.items.splice(i, 1);
                createParticles(item.x, item.y, '#ff00ff', 30);
                playExplosionSound();
            } else if (item.type === 'next_floor') {
                nextFloor();
                return;
            } else if (item.type === 'shop') {
                openShop();
            } else if (item.type === 'gun_box') {
                if (game.player.weapons.length >= 3) {
                    createParticles(item.x, item.y, '#e94560', 10);
                    continue;
                }
                
                const newWeapon = getRandomWeapon(true);
                const existing = game.player.weapons.find(w => w.name === newWeapon.name);
                if (!existing) {
                    game.player.weapons.push(newWeapon);
                }
                createParticles(item.x, item.y, '#4ecca3', 20);
                playPickupSound('weapon');
                game.items.splice(i, 1);
            } else if (item.type === 'weapon') {
                if (game.player.weapons.length >= 3) {
                    createParticles(item.x, item.y, '#e94560', 10);
                    continue;
                }
                
                const existing = game.player.weapons.find(w => w.name === item.data.name);
                if (!existing) {
                    game.player.weapons.push(item.data);
                }
                createParticles(item.x, item.y, '#4ecca3', 10);
                playPickupSound('weapon');
                game.items.splice(i, 1);
            } else if (item.type === 'gear') {
                // Swap gear
                const gearSlot = item.data.type;
                const oldGear = game.player.gear[gearSlot];
                
                if (oldGear) {
                    // Drop old gear
                    game.items.push({
                        x: item.x,
                        y: item.y,
                        type: 'gear',
                        data: oldGear,
                        size: 18
                    });
                }
                
                game.player.gear[gearSlot] = item.data;
                createParticles(item.x, item.y, '#ffd700', 15);
                playPickupSound('gear');
                game.items.splice(i, 1);
            }
            
            updateUI();
        }
    }
}

function nextFloor() {
    const modifier = getDifficultyModifier();
    game.player.level++;
    if (!modifier.oneHPMode) {
        game.player.maxHealth += 20;
        game.player.health = game.player.maxHealth;
    }
    // In impossible mode: health and maxHealth remain at 1
    game.player.hasKey = false;
    
    // In multiplayer, host generates and broadcasts the seed for the next floor
    if (multiplayer.enabled) {
        if (multiplayer.isHost) {
            const dungeonSeed = Date.now() + Math.floor(Math.random() * 10000);
            console.log('🗺️ Host generating next floor with seed:', dungeonSeed);
            
            // Generate dungeon with seed
            generateDungeonWithSeed(dungeonSeed);
            
            // Broadcast the seed to other players
            multiplayer.channel.send({
                type: 'broadcast',
                event: 'next_floor',
                payload: {
                    level: game.player.level,
                    dungeonSeed: dungeonSeed
                }
            });
        }
        // Non-hosts wait for the host to broadcast the seed
        // (handled in multiplayer.js event listener)
    } else {
        // Singleplayer - use regular random generation
        generateDungeon();
    }
    
    updateUI();
}

function openShop() {
    game.shopOpen = true;
    document.getElementById('overlay').classList.add('active');
    document.getElementById('shopMenu').classList.add('active');
    
    const modifier = getDifficultyModifier();
    
    // Generate shop inventory if it doesn't exist yet
    if (!game.currentRoom.shopInventory) {
        const inventory = {
            weapons: [],
            gear: []
        };
        
        // Add 2 random weapons
        for (let i = 0; i < 2; i++) {
            const weapon = getRandomWeapon(true);
            inventory.weapons.push({
                data: weapon,
                price: Math.floor(100 * modifier.shopPriceMult),
                sold: false
            });
        }
        
        // Add 2 random gear items
        const gearSlots = ['helmet', 'vest', 'gloves', 'bag', 'shoes', 'ammoType'];
        for (let i = 0; i < 2; i++) {
            const randomSlot = gearSlots[Math.floor(Math.random() * gearSlots.length)];
            const gear = getRandomGear(randomSlot);
            inventory.gear.push({
                data: gear,
                price: Math.floor(150 * modifier.shopPriceMult),
                sold: false
            });
        }
        
        game.currentRoom.shopInventory = inventory;
    }
    
    let shopHTML = '<div style="margin-bottom: 20px;"><h3 style="text-align: center; color: #4ecca3; margin-bottom: 15px;">⭐ SHOP INVENTORY ⭐</h3>';
    
    // Display weapons
    shopHTML += '<div style="border: 2px solid #4ecca3; padding: 10px; margin-bottom: 10px; border-radius: 5px;">';
    shopHTML += '<strong style="color: #ffd700;">🔫 WEAPONS</strong><br>';
    game.currentRoom.shopInventory.weapons.forEach((item, index) => {
        if (!item.sold) {
            const canAfford = game.player.money >= item.price;
            const canCarry = game.player.weapons.length < 3;
            const hasWeapon = game.player.weapons.find(w => w.name === item.data.name);
            
            let statusText = '';
            let isDisabled = !canAfford || !canCarry || hasWeapon;
            
            if (hasWeapon) statusText = '<br><span style="color: #ff8c00;">Already owned!</span>';
            else if (!canCarry) statusText = '<br><span style="color: #e94560;">Inventory full!</span>';
            else if (!canAfford) statusText = '<br><span style="color: #e94560;">Not enough money!</span>';
            
            shopHTML += `<div class="shop-item ${isDisabled ? 'disabled' : ''}" onclick="${!isDisabled ? `buyShopWeapon(${index})` : ''}">
                <strong>${item.data.name}</strong> - DMG: ${item.data.damage} | Fire Rate: ${item.data.fireRate}ms - 💰${item.price}
                ${statusText}
            </div>`;
        } else {
            shopHTML += `<div class="shop-item disabled" style="opacity: 0.3;">
                <strong>${item.data.name}</strong> - <span style="color: #888;">SOLD OUT</span>
            </div>`;
        }
    });
    shopHTML += '</div>';
    
    // Display gear
    shopHTML += '<div style="border: 2px solid #ffd700; padding: 10px; margin-bottom: 10px; border-radius: 5px;">';
    shopHTML += '<strong style="color: #ffd700;">⚡ GEAR</strong><br>';
    game.currentRoom.shopInventory.gear.forEach((item, index) => {
        if (!item.sold) {
            const canAfford = game.player.money >= item.price;
            
            // Build stats display
            let statsText = '';
            if (item.data.defense) statsText += `DEF: +${item.data.defense} `;
            if (item.data.damageMult) statsText += `DMG: x${item.data.damageMult} `;
            if (item.data.reload) statsText += `Reload: x${item.data.reload} `;
            if (item.data.ammoMult) statsText += `Ammo: x${item.data.ammoMult} `;
            if (item.data.speed) statsText += `Speed: +${item.data.speed} `;
            if (item.data.accuracy) statsText += `Acc: x${item.data.accuracy} `;
            if (item.data.bulletSpeed) statsText += `B.Speed: x${item.data.bulletSpeed} `;
            if (item.data.evasion) statsText += `Evasion: +${item.data.evasion * 100}% `;
            if (item.data.healthRegen) statsText += `Regen: +${item.data.healthRegen} `;
            
            shopHTML += `<div class="shop-item ${!canAfford ? 'disabled' : ''}" onclick="${canAfford ? `buyShopGear(${index})` : ''}">
                ${item.data.emoji} <strong>${item.data.name}</strong> - ${statsText}- 💰${item.price}
                ${!canAfford ? '<br><span style="color: #e94560;">Not enough money!</span>' : ''}
            </div>`;
        } else {
            shopHTML += `<div class="shop-item disabled" style="opacity: 0.3;">
                ${item.data.emoji} <strong>${item.data.name}</strong> - <span style="color: #888;">SOLD OUT</span>
            </div>`;
        }
    });
    shopHTML += '</div></div>';
    
    // Shop exclusives section
    shopHTML += '<div style="border-top: 2px solid #888; padding-top: 15px;">';
    shopHTML += '<h3 style="text-align: center; color: #4ecca3; margin-bottom: 15px;">🛒 SHOP EXCLUSIVES 🛒</h3>';
    
    const shopExclusives = [
        { name: 'Gun Box (Random)', price: Math.floor(50 * modifier.shopPriceMult), type: 'gun_box' },
        { name: 'Ammo Pack (50 rounds)', price: Math.floor(25 * modifier.shopPriceMult), type: 'ammo' },
        { name: 'Health Pack (+50 HP)', price: Math.floor(30 * modifier.shopPriceMult), type: 'health' },
        { name: 'Random Gear Box', price: Math.floor(250 * modifier.shopPriceMult), type: 'gear_box' }
    ];
    
    shopExclusives.forEach(item => {
        const canAfford = game.player.money >= item.price;
        shopHTML += `<div class="shop-item ${!canAfford ? 'disabled' : ''}" onclick="${canAfford ? `buyItem('${item.type}', ${item.price})` : ''}">
            <strong>${item.name}</strong> - 💰${item.price}
            ${!canAfford ? '<br><span style="color: #e94560;">Not enough money!</span>' : ''}
        </div>`;
    });
    
    shopHTML += '</div>';
    
    document.getElementById('shopItems').innerHTML = shopHTML;
}

function closeShop() {
    game.shopOpen = false;
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('shopMenu').classList.remove('active');
}

function buyShopWeapon(index) {
    const item = game.currentRoom.shopInventory.weapons[index];
    if (!item || item.sold || game.player.money < item.price) return;
    
    if (game.player.weapons.length >= 3) {
        createParticles(game.player.x, game.player.y, '#e94560', 15);
        return;
    }
    
    const hasWeapon = game.player.weapons.find(w => w.name === item.data.name);
    if (hasWeapon) {
        createParticles(game.player.x, game.player.y, '#e94560', 15);
        return;
    }
    
    game.player.money -= item.price;
    game.player.weapons.push({ ...item.data });
    item.sold = true;
    
    createParticles(game.player.x, game.player.y, '#4ecca3', 20);
    playPickupSound('weapon');
    updateUI();
    openShop();
}

function buyShopGear(index) {
    const item = game.currentRoom.shopInventory.gear[index];
    if (!item || item.sold || game.player.money < item.price) return;
    
    game.player.money -= item.price;
    
    // Drop old gear if replacing
    const gearSlot = item.data.type;
    const oldGear = game.player.gear[gearSlot];
    
    if (oldGear) {
        game.items.push({
            x: game.player.x + Math.cos(game.player.angle) * 60,
            y: game.player.y + Math.sin(game.player.angle) * 60,
            type: 'gear',
            data: oldGear,
            size: 18
        });
    }
    
    game.player.gear[gearSlot] = item.data;
    item.sold = true;
    
    createParticles(game.player.x, game.player.y, '#ffd700', 20);
    playPickupSound('gear');
    updateUI();
    openShop();
}

function buyItem(type, price) {
    if (game.player.money < price) return;
    
    if (type === 'gun_box') {
        if (game.player.weapons.length >= 3) {
            createParticles(game.player.x, game.player.y, '#e94560', 15);
            return;
        }
        
        game.player.money -= price;
        const newWeapon = getRandomWeapon(true);
        const existing = game.player.weapons.find(w => w.name === newWeapon.name);
        if (!existing) {
            game.player.weapons.push(newWeapon);
        }
        createParticles(game.player.x, game.player.y, '#4ecca3', 15);
    } else if (type === 'ammo') {
        game.player.money -= price;
        let weaponToRefill = null;
        const currentWeapon = game.player.weapons[game.player.currentWeaponIndex];
        
        if (currentWeapon && !currentWeapon.isMelee && currentWeapon.ammo !== Infinity && currentWeapon.canRefill !== false) {
            weaponToRefill = currentWeapon;
        } else {
            const guns = game.player.weapons.filter(w => !w.isMelee && w.ammo !== Infinity && w.canRefill !== false);
            if (guns.length > 0) {
                weaponToRefill = guns[Math.floor(Math.random() * guns.length)];
            }
        }
        
        if (weaponToRefill) {
            weaponToRefill.ammo += 50;
            createParticles(game.player.x, game.player.y, '#ffa500', 20);
        } else {
            game.player.money += price;
            createParticles(game.player.x, game.player.y, '#e94560', 10);
        }
    } else if (type === 'health') {
        const modifier = getDifficultyModifier();
        if (modifier.oneHPMode) {
            createParticles(game.player.x, game.player.y, '#e94560', 10);
            return; // Can't buy health in impossible mode
        }
        game.player.money -= price;
        game.player.health = Math.min(game.player.maxHealth, game.player.health + 50);
        createParticles(game.player.x, game.player.y, '#e94560', 15);
    } else if (type === 'gear_box') {
        game.player.money -= price;
        // Random gear type
        const gearSlots = ['helmet', 'vest', 'gloves', 'bag', 'shoes', 'ammoType'];
        const randomSlot = gearSlots[Math.floor(Math.random() * gearSlots.length)];
        const newGear = getRandomGear(randomSlot);
        
        game.items.push({
            x: game.player.x + Math.cos(game.player.angle) * 60,
            y: game.player.y + Math.sin(game.player.angle) * 60,
            type: 'gear',
            data: newGear,
            size: 18
        });
        createParticles(game.player.x, game.player.y, '#ffd700', 20);
    }
    
    updateUI();
    openShop();
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        game.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            color,
            life: 30,
            size: Math.random() * 4 + 2
        });
    }
}