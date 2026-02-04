// Weapon shooting mechanics
function shoot() {
    const now = Date.now();
    const weapon = game.player.weapons[game.player.currentWeaponIndex];
    
    if (!weapon) return;
    
    const stats = getPlayerStats();
    const adjustedFireRate = weapon.fireRate * stats.reloadSpeed;
    
    if (now - game.lastShot < adjustedFireRate) return;
    
    if (weapon.ammo !== Infinity && weapon.ammo <= 0) {
        playNoAmmoSound();
        game.player.currentWeaponIndex = 0;
        updateUI();
        return;
    }
    
    game.lastShot = now;
    
    // Play shooting sound
    playShootSound(weapon);
    
    if (weapon.isMelee) {
        const meleeRange = weapon.range;
        const meleeArc = Math.PI / 3;
        
        game.enemies.forEach(enemy => {
            const dist = Math.hypot(game.player.x - enemy.x, game.player.y - enemy.y);
            if (dist < meleeRange) {
                const angleToEnemy = Math.atan2(enemy.y - game.player.y, enemy.x - game.player.x);
                let angleDiff = angleToEnemy - game.player.angle;
                
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                
                if (Math.abs(angleDiff) < meleeArc / 2) {
                    const damage = Math.floor(weapon.damage * stats.damageMult);
                    enemy.health -= damage;
                    
                    // Lifesteal
                    if (stats.lifesteal > 0) {
                        game.player.health = Math.min(game.player.maxHealth, game.player.health + damage * stats.lifesteal);
                    }
                    
                    createParticles(enemy.x, enemy.y, enemy.color, 8);
                    
                    if (enemy.health <= 0) {
                        handleEnemyDeath(enemy);
                    }
                }
            }
        });
        createParticles(
            game.player.x + Math.cos(game.player.angle) * 30,
            game.player.y + Math.sin(game.player.angle) * 30,
            '#888',
            5
        );
        return;
    }
    
    if (weapon.burstCount) {
        const bulletsToFire = weapon.bullets || 1;
        
        if (weapon.ammo !== Infinity) {
            weapon.ammo -= bulletsToFire * weapon.burstCount;
            if (weapon.ammo < 0) weapon.ammo = 0;
        }
        
        for (let burst = 0; burst < weapon.burstCount; burst++) {
            setTimeout(() => {
                for (let i = 0; i < bulletsToFire; i++) {
                    const baseSpread = weapon.spread ? (Math.random() - 0.5) * weapon.spread : 0;
                    const accuracySpread = baseSpread * stats.accuracy;
                    const angle = game.player.angle + accuracySpread;
                    
                    const damage = Math.floor(weapon.damage * stats.damageMult);
                    const bulletSpeed = weapon.bulletSpeed * stats.bulletSpeedMult;
                    
                    const bullet = {
                        x: game.player.x,
                        y: game.player.y,
                        vx: Math.cos(angle) * bulletSpeed,
                        vy: Math.sin(angle) * bulletSpeed,
                        damage: damage,
                        color: weapon.color,
                        size: 4,
                        penetrating: weapon.penetrating || stats.penetration > 0,
                        explosive: weapon.explosive,
                        explosionRadius: (weapon.explosionRadius || 0) * stats.explosiveRadiusMult,
                        lifesteal: stats.lifesteal,
                        damageOverTime: stats.damageOverTime
                    };
                    
                    game.bullets.push(bullet);
                    
                    // Send to multiplayer
                    if (multiplayer.enabled) {
                        sendShootEvent(bullet);
                    }
                }
            }, burst * weapon.burstDelay);
        }
    } else {
        const bulletsToFire = weapon.bullets || 1;
        
        if (weapon.ammo !== Infinity) {
            weapon.ammo -= bulletsToFire;
            if (weapon.ammo < 0) weapon.ammo = 0;
        }
        
        for (let i = 0; i < bulletsToFire; i++) {
            const baseSpread = weapon.spread ? (Math.random() - 0.5) * weapon.spread : 0;
            const accuracySpread = baseSpread * stats.accuracy;
            const angle = game.player.angle + accuracySpread;
            
            const damage = Math.floor(weapon.damage * stats.damageMult);
            const bulletSpeed = weapon.bulletSpeed * stats.bulletSpeedMult;
            
            const bullet = {
                x: game.player.x,
                y: game.player.y,
                vx: Math.cos(angle) * bulletSpeed,
                vy: Math.sin(angle) * bulletSpeed,
                damage: damage,
                color: weapon.color,
                size: weapon.penetrating || stats.penetration > 0 ? 6 : (weapon.explosive ? 8 : 4),
                penetrating: weapon.penetrating || stats.penetration > 0,
                explosive: weapon.explosive,
                explosionRadius: (weapon.explosionRadius || 0) * stats.explosiveRadiusMult,
                lifesteal: stats.lifesteal,
                damageOverTime: stats.damageOverTime
            };
            
            game.bullets.push(bullet);
            
            // Send to multiplayer
            if (multiplayer.enabled) {
                sendShootEvent(bullet);
            }
        }
    }
    
    updateUI();
}
