import { World } from "./world.js";

const RayCaster = {
    castRayDDA(startX, startY, angle, world) {
        // Direction vector from the angle
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        // Grid position
        let currentX = Math.floor(startX);
        let currentY = Math.floor(startY);

        // How far to travel in t to cross one full grid cell
        const tDeltaX = Math.abs(1 / dirX);
        const tDeltaY = Math.abs(1 / dirY);

        const stepX = Math.sign(dirX);
        const stepY = Math.sign(dirY);

        let tMaxX, tMaxY;
        let side = 0; 

        let isOutOfGrid = false;

        // Initial tMax calculation
        if (dirX > 0) {
            tMaxX = (currentX + 1 - startX) * tDeltaX;
        } else {
            tMaxX = (startX - currentX) * tDeltaX;
        }

        if (dirY > 0) {
            tMaxY = (currentY + 1 - startY) * tDeltaY;
        } else {
            tMaxY = (startY - currentY) * tDeltaY;
        }

        // Raycasting loop
        const maxDistance = 50; // Limit range to prevent infinite loops
        for (let step = 0; step < maxDistance; step++) {
            if (tMaxX < tMaxY) {
                tMaxX += tDeltaX;
                currentX += stepX;
                side = 0;
            } else {
                tMaxY += tDeltaY;
                currentY += stepY;
                side = 1;
            }

            // Hit detection
            if (World.isWithinBounds(currentX, currentY)) {
                const index = world.getIndexOf(currentX, currentY);
                if (world.worldMap[index] > 0) break;
            } else {
                isOutOfGrid = true;
                break;
            }
        }

        // Calculate perpendicular distance to avoid fisheye effect
        let wallDist;
        if (side === 0) {
            wallDist = (tMaxX - tDeltaX);
        } else {
            wallDist = (tMaxY - tDeltaY);
        }

        if (isOutOfGrid) wallDist = 50;

        return { 
            x: currentX, 
            y: currentY, 
            side, 
            distance: wallDist 
        };
    }
}

export {RayCaster};