// Player stats and utilities
function getPlayerStats() {
    let defense = 0;
    let reloadSpeed = 1.0;
    let ammoMult = 1.0;
    let speedBonus = 0;
    let damageMult = 1.0;
    let accuracy = 1.0;
    let bulletSpeedMult = 1.0;
    let healthRegen = 0;
    let lifesteal = 0;
    let explosiveRadiusMult = 1.0;
    let evasion = 0;
    let knockback = 1.0;
    let penetration = 0;
    let damageOverTime = 0;

    // Helmet stats
    if (game.player.gear.helmet) {
        defense += game.player.gear.helmet.defense || 0;
        accuracy *= game.player.gear.helmet.accuracy || 1.0;
        bulletSpeedMult *= game.player.gear.helmet.bulletSpeed || 1.0;
        healthRegen += game.player.gear.helmet.healthRegen || 0;
    }

    // Vest stats
    if (game.player.gear.vest) {
        defense += game.player.gear.vest.defense || 0;
        reloadSpeed *= game.player.gear.vest.reload || 1.0;
        healthRegen += game.player.gear.vest.healthRegen || 0;
        ammoMult *= game.player.gear.vest.ammoMult || 1.0;
    }

    // Gloves stats
    if (game.player.gear.gloves) {
        reloadSpeed *= game.player.gear.gloves.reload || 1.0;
        damageMult *= game.player.gear.gloves.damageMult || 1.0;
        accuracy *= game.player.gear.gloves.accuracy || 1.0;
        lifesteal += game.player.gear.gloves.lifesteal || 0;
    }

    // Bag stats
    if (game.player.gear.bag) {
        ammoMult *= game.player.gear.bag.ammoMult || 1.0;
        healthRegen += game.player.gear.bag.healthRegen || 0;
        reloadSpeed *= game.player.gear.bag.reload || 1.0;
        defense += game.player.gear.bag.defense || 0;
        explosiveRadiusMult *= game.player.gear.bag.explosiveRadius || 1.0;
    }

    // Shoes stats
    if (game.player.gear.shoes) {
        speedBonus += game.player.gear.shoes.speed || 0;
        defense += game.player.gear.shoes.defense || 0;
        evasion += game.player.gear.shoes.evasion || 0;
        knockback *= game.player.gear.shoes.knockback || 1.0;
    }

    // Ammo Type stats
    if (game.player.gear.ammoType) {
        bulletSpeedMult *= game.player.gear.ammoType.bulletSpeed || 1.0;
        damageMult *= game.player.gear.ammoType.damageMult || 1.0;
        accuracy *= game.player.gear.ammoType.accuracy || 1.0;
        penetration += game.player.gear.ammoType.penetration || 0;
        damageOverTime += game.player.gear.ammoType.damageOverTime || 0;
    }

    return { 
        defense, 
        reloadSpeed, 
        ammoMult, 
        speedBonus, 
        damageMult,
        accuracy,
        bulletSpeedMult,
        healthRegen,
        lifesteal,
        explosiveRadiusMult,
        evasion,
        knockback,
        penetration,
        damageOverTime
    };
}

function dropCurrentWeapon() {
    const currentWeapon = game.player.weapons[game.player.currentWeaponIndex];
    
    if (!currentWeapon || currentWeapon.isMelee) {
        createParticles(game.player.x, game.player.y, '#e94560', 10);
        return;
    }
    
    game.items.push({
        x: game.player.x + Math.cos(game.player.angle) * 40,
        y: game.player.y + Math.sin(game.player.angle) * 40,
        type: 'weapon',
        data: { ...currentWeapon },
        size: 15
    });
    
    game.player.weapons.splice(game.player.currentWeaponIndex, 1);
    game.player.currentWeaponIndex = Math.max(0, Math.min(game.player.currentWeaponIndex, game.player.weapons.length - 1));
    
    createParticles(game.player.x, game.player.y, '#888', 10);
    updateUI();
}

function resetGame() {
    const modifier = getDifficultyModifier();
    
    // Show death message
    const deathMessage = confirm(
        `💀 GAME OVER 💀\n\n` +
        `Floor Reached: ${game.player.level}\n` +
        `Score: ${game.player.score}\n` +
        `Difficulty: ${modifier.displayName}\n\n` +
        `Click OK to restart or Cancel to quit to menu.`
    );
    
    if (!deathMessage) {
        // User chose to quit to menu
        game.paused = false;
        document.getElementById('overlay').classList.remove('active');
        document.getElementById('pauseMenu').classList.remove('active');
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'flex';
        showMainMenu();
        stopMusic();
        return;
    }
    
    // Reset player stats based on difficulty
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
}