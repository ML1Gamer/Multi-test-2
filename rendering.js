// Rendering functions
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < ROOM_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ROOM_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < ROOM_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ROOM_WIDTH, y);
        ctx.stroke();
    }

    // Draw walls
    ctx.fillStyle = '#16213e';
    game.walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    });

    // Draw doors
    game.doors.forEach(door => {
        ctx.fillStyle = door.blocked ? 'rgba(233, 69, 96, 0.8)' : 'rgba(78, 204, 163, 0.5)';
        ctx.fillRect(door.x, door.y, door.w, door.h);
        
        if (door.blocked) {
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 3;
            ctx.strokeRect(door.x, door.y, door.w, door.h);
        }
    });

    // Draw enemy spawn indicators
    game.enemySpawnIndicators.forEach(indicator => {
        // Pulsing red circle
        const alpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
        ctx.strokeStyle = `rgba(233, 69, 96, ${alpha})`;
        ctx.fillStyle = `rgba(233, 69, 96, ${alpha * 0.3})`;
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(indicator.x, indicator.y, indicator.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw inner circle
        if (indicator.radius > 10) {
            ctx.beginPath();
            ctx.arc(indicator.x, indicator.y, indicator.radius * 0.5, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw warning symbol for boss
        if (indicator.isBoss && indicator.radius > 15) {
            ctx.fillStyle = '#e94560';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('!', indicator.x, indicator.y + 8);
        }
    });

    // Draw items
    game.items.forEach(item => {
        if (item.type === 'key') {
            ctx.fillStyle = '#ffd700';
            ctx.font = '40px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🔑', item.x, item.y + 15);
        } else if (item.type === 'miniboss_pedestal') {
            // Draw pedestal
            ctx.fillStyle = '#555';
            ctx.fillRect(item.x - item.size, item.y - item.size/2, item.size * 2, item.size);
            ctx.fillStyle = '#777';
            ctx.fillRect(item.x - item.size * 0.8, item.y - item.size/2 - 10, item.size * 1.6, 10);
            
            // Pulsing glow
            const glowAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.2;
            ctx.fillStyle = `rgba(255, 0, 255, ${glowAlpha})`;
            ctx.beginPath();
            ctx.arc(item.x, item.y - 10, item.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
            
            // Text
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Press E to Summon', item.x, item.y + item.size + 10);
            
            // Boss type indicator
            const bossName = item.miniBossType === MINIBOSS_TYPES.DASHER ? 'DASHER' : 'NECROMANCER';
            ctx.fillStyle = '#ff00ff';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(bossName, item.x, item.y - item.size - 10);
        } else if (item.type === 'locked_door') {
            ctx.fillStyle = '#666';
            ctx.fillRect(item.x - item.size/2, item.y - item.size, item.size, item.size * 2);
            ctx.font = '30px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🔒', item.x, item.y + 10);
        } else if (item.type === 'next_floor') {
            ctx.fillStyle = '#4ecca3';
            ctx.fillRect(item.x - item.size/2, item.y - item.size, item.size, item.size * 2);
            ctx.font = '30px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🚪', item.x, item.y + 10);
        } else if (item.type === 'shop') {
            ctx.fillStyle = '#4ecca3';
            ctx.fillRect(item.x - item.size, item.y - item.size, item.size * 2, item.size * 2);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.strokeRect(item.x - item.size, item.y - item.size, item.size * 2, item.size * 2);
            ctx.font = '25px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🛒', item.x, item.y + 8);
        } else if (item.type === 'gun_box') {
            ctx.fillStyle = '#d4a574';
            ctx.fillRect(item.x - item.size, item.y - item.size, item.size * 2, item.size * 2);
            ctx.strokeStyle = '#8b6f47';
            ctx.lineWidth = 3;
            ctx.strokeRect(item.x - item.size, item.y - item.size, item.size * 2, item.size * 2);
            ctx.font = '25px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('📦', item.x, item.y + 8);
        } else if (item.type === 'weapon') {
            ctx.fillStyle = '#4ecca3';
            ctx.fillRect(item.x - item.size, item.y - item.size, item.size * 2, item.size * 2);
        } else if (item.type === 'powerup') {
            ctx.fillStyle = item.data === 'health' ? '#e94560' : '#4ecca3';
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (item.type === 'money') {
            ctx.fillStyle = '#ffd700';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('💰', item.x, item.y + 7);
        } else if (item.type === 'ammo') {
            ctx.fillStyle = '#ffa500';
            ctx.fillRect(item.x - item.size, item.y - item.size/2, item.size * 2, item.size);
            ctx.fillStyle = '#ff8c00';
            ctx.fillRect(item.x - item.size + 2, item.y - item.size/2 + 2, item.size * 2 - 4, item.size - 4);
            ctx.font = '14px monospace';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('A', item.x, item.y + 4);
        } else if (item.type === 'gear') {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(item.x - item.size, item.y - item.size, item.size * 2, item.size * 2);
            ctx.strokeStyle = '#b8860b';
            ctx.lineWidth = 2;
            ctx.strokeRect(item.x - item.size, item.y - item.size, item.size * 2, item.size * 2);
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText(item.data.emoji, item.x, item.y + 7);
        }
    });

    // Draw enemies
    game.enemies.forEach(enemy => {
        // Special rendering for Dasher windup
        if (enemy.type === ENEMY_TYPES.DASHER && enemy.state === 'windup') {
            const windupProgress = (Date.now() - enemy.windupTime) / enemy.windupDuration;
            const glowSize = enemy.size + 10 + windupProgress * 20;
            const glowAlpha = 0.3 + windupProgress * 0.4;
            
            ctx.fillStyle = `rgba(255, 0, 0, ${glowAlpha})`;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, glowSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw dash direction indicator
            ctx.strokeStyle = `rgba(255, 0, 0, ${glowAlpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y);
            ctx.lineTo(
                enemy.x + enemy.dashDirection.x * 100,
                enemy.y + enemy.dashDirection.y * 100
            );
            ctx.stroke();
        }
        
        // Draw enemy body
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Special markers for mini-bosses
        if (enemy.type === ENEMY_TYPES.DASHER) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚡', enemy.x, enemy.y + 7);
        } else if (enemy.type === ENEMY_TYPES.NECROMANCER) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('☠️', enemy.x, enemy.y + 7);
        } else if (enemy.type === ENEMY_TYPES.SHOOTER) {
            ctx.fillStyle = '#333';
            ctx.fillRect(enemy.x - 5, enemy.y - 2, 10, 4);
        } else if (enemy.type === ENEMY_TYPES.BOSS) {
            // Boss crown
            ctx.fillStyle = '#ffd700';
            ctx.font = '25px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('👑', enemy.x, enemy.y - enemy.size - 5);
        } else if (enemy.type === ENEMY_TYPES.SUMMONED) {
            // Summoned indicator
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('S', enemy.x, enemy.y + 4);
        }
        
        const barWidth = (enemy.type === ENEMY_TYPES.BOSS || enemy.type === ENEMY_TYPES.DASHER || enemy.type === ENEMY_TYPES.NECROMANCER) ? 60 : 30;
        const barHeight = 4;
        ctx.fillStyle = '#333';
        ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.size - 10, barWidth, barHeight);
        ctx.fillStyle = '#e94560';
        ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.size - 10, barWidth * (enemy.health / enemy.maxHealth), barHeight);
    });

    // Draw bullets
    game.bullets.forEach(bullet => {
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw enemy bullets
    game.enemyBullets.forEach(bullet => {
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw particles
    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    // Draw laser sight - full line to edge of screen
    const angle = game.player.angle;
    const maxDistance = 2000; // Long enough to reach any edge
    const endX = game.player.x + Math.cos(angle) * maxDistance;
    const endY = game.player.y + Math.sin(angle) * maxDistance;
    
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(game.player.x, game.player.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw other players (multiplayer) - only if in same room
    if (multiplayer.enabled && multiplayer.players.size > 0) {
        multiplayer.players.forEach((otherPlayer, playerId) => {
            // Only draw if in same room
            if (otherPlayer.gridX !== game.gridX || otherPlayer.gridY !== game.gridY) {
                return; // Skip this player, they're in a different room
            }
            
            // Draw other player
            ctx.save();
            ctx.translate(otherPlayer.x, otherPlayer.y);
            ctx.rotate(otherPlayer.angle);
            
            // Different color for other players
            ctx.fillStyle = '#ff6b9d';
            ctx.fillRect(-game.player.size/2, -game.player.size/2, game.player.size, game.player.size);
            
            ctx.fillStyle = '#333';
            ctx.fillRect(game.player.size/2 - 5, -3, 15, 6);
            
            ctx.restore();
            
            // Draw health bar
            const barWidth = 40;
            const barHeight = 4;
            const healthPercent = Math.max(0, Math.min(1, otherPlayer.health / 100));
            
            ctx.fillStyle = '#333';
            ctx.fillRect(otherPlayer.x - barWidth/2, otherPlayer.y - game.player.size - 15, barWidth, barHeight);
            ctx.fillStyle = '#ff6b9d';
            ctx.fillRect(otherPlayer.x - barWidth/2, otherPlayer.y - game.player.size - 15, barWidth * healthPercent, barHeight);
            
            // Draw weapon name
            if (otherPlayer.currentWeapon) {
                ctx.fillStyle = '#fff';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(otherPlayer.currentWeapon, otherPlayer.x, otherPlayer.y - game.player.size - 20);
            }
        });
    }

    // Draw player
    ctx.save();
    ctx.translate(game.player.x, game.player.y);
    ctx.rotate(game.player.angle);
    
    ctx.fillStyle = '#4ecca3';
    ctx.fillRect(-game.player.size/2, -game.player.size/2, game.player.size, game.player.size);
    
    ctx.fillStyle = '#333';
    ctx.fillRect(game.player.size/2 - 5, -3, 15, 6);
    
    ctx.restore();
}