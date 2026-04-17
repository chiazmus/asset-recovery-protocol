// Sprite-based rendering for remote players in the 3D view

const SpriteRenderer = {
    renderRemotePlayer(ctx, player, gameScreen, myPlayer, world, zBuffer, robotSprite, playerWidth = 0.5, color = "cyan") {
        // Calculate relative position in world space
        const relX = player.x - myPlayer.x;
        const relY = player.y - myPlayer.y;
        
        // Calculate distance (not corrected for this positioning)
        const distance = Math.sqrt(relX * relX + relY * relY);
        
        // Don't render if too close or too far
        if (distance < 0.1 || distance > 48) return;
        
        // Calculate angle to the sprite
        const angleToSprite = Math.atan2(relY, relX);
        const playerAngleRad = myPlayer.angle * Math.PI / 180;
        let relativeAngle = angleToSprite - playerAngleRad;
        
        // Normalize angle to -PI to PI
        while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
        while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
        
        // Convert back to degrees for screen mapping
        const relativeAngleDeg = relativeAngle * 180 / Math.PI;
        
        // Don't render if too far outside FOV
        if (Math.abs(relativeAngleDeg) > myPlayer.fov / 2 + 10) return;
        
        // Map angle to screen X position based on FOV
        const screenX = (gameScreen.width / 2) + (relativeAngleDeg / myPlayer.fov) * gameScreen.width;
        const screenY = (gameScreen.height / 2);
        
        // Calculate sprite size based on distance
        const spriteHeight = Math.floor((playerWidth / distance) * gameScreen.height);
        const spriteRadius = Math.max(3, Math.floor(spriteHeight / 2));
        
        // Only render if on screen and sprite is available
        if (robotSprite && screenX > -spriteRadius * 2 && screenX < gameScreen.width + spriteRadius * 2) {
            // Draw sprite column by column, checking z-buffer for occlusion
            const spriteLeft = screenX - spriteRadius;
            const spriteRight = screenX + spriteRadius;
            const spriteTop = screenY;
            const spriteBottom = screenY + spriteRadius;
            
            for (let px = Math.max(0, Math.floor(spriteLeft)); 
                 px <= Math.min(gameScreen.width - 1, Math.floor(spriteRight)); px++) {
                
                // Check if this column is in front of the wall
                if (zBuffer[px] === undefined || distance < zBuffer[px]) {
                    // Calculate which column of the sprite image to draw
                    const normalizedPos = (px - spriteLeft) / (spriteRadius * 2);
                    const spriteCol = Math.floor(normalizedPos * robotSprite.width);
                    
                    // Draw 1 pixel wide vertical slice of the sprite
                    ctx.drawImage(
                        robotSprite,
                        spriteCol, 0, 1, robotSprite.height,  // Source: 1px column from sprite
                        px, spriteTop, 1, spriteHeight        // Destination: 1px wide column on screen
                    );
                }
            }
        }
        
        // Always reset globalAlpha to prevent affecting other drawing
        ctx.globalAlpha = 1;
    },
    
    renderRemotePlayers(ctx, remotePlayers, gameScreen, myPlayer, world, zBuffer, robotSprite) {
        for (let player of remotePlayers) {
            this.renderRemotePlayer(ctx, player, gameScreen, myPlayer, world, zBuffer, robotSprite);
        }
    },
    
    // Draw a minimap in corner showing all players
    renderMinimap(ctx, myPlayer, remotePlayers, gameScreen, mapScale = 0.25) {
        const minimapWidth = 80;
        const minimapHeight = 80;
        const minimapX = gameScreen.width - minimapWidth - 5;
        const minimapY = 5;
        
        // Draw background
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(minimapX, minimapY, minimapWidth, minimapHeight);
        
        // Draw border
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 1;
        ctx.strokeRect(minimapX, minimapY, minimapWidth, minimapHeight);
        
        // Draw my player (center)
        const centerX = minimapX + minimapWidth / 2;
        const centerY = minimapY + minimapHeight / 2;
        
        ctx.fillStyle = "lime";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw direction indicator
        const dirLength = 10;
        const dirAngle = (myPlayer.angle) * Math.PI / 180;
        const dirX = Math.cos(dirAngle) * dirLength;
        const dirY = Math.sin(dirAngle) * dirLength;
        ctx.strokeStyle = "lime";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + dirX, centerY + dirY);
        ctx.stroke();
        
        // Draw remote players
        for (let player of remotePlayers) {
            const relX = (player.x - myPlayer.x) * mapScale;
            const relY = (player.y - myPlayer.y) * mapScale;
            
            // Rotate based on my angle to align with direction indicator
            const playerAngleRad = -(myPlayer.angle+90) * Math.PI / 180;
            const rotX = relX * Math.cos(playerAngleRad) - relY * Math.sin(playerAngleRad);
            const rotY = relX * Math.sin(playerAngleRad) + relY * Math.cos(playerAngleRad);
            
            const mapX = centerX + rotX;
            const mapY = centerY + rotY;
            
            // Only draw if within minimap bounds
            if (mapX > minimapX + 2 && mapX < minimapX + minimapWidth - 2 &&
                mapY > minimapY + 2 && mapY < minimapY + minimapHeight - 2) {
                ctx.fillStyle = "cyan";
                ctx.beginPath();
                ctx.arc(mapX, mapY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
};

export { SpriteRenderer };
