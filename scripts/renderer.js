import { SimpleRandom } from "./simpleRandom.js";

const Renderer = {
    ctx: null,
    gameScreen: null,

    clearScreen () {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.gameScreen.width, this.gameScreen.height);
    },

    drawLine (x1, y1, x2, y2, color, width) {
        this.ctx.strokeStyle = color || "white";
        this.ctx.lineWidth = width || 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    },
    
    drawBackground(playerAngle, image) {
        const modAngle = ((playerAngle % 360) + 360) % 360; 
        const imageWidth = image.width * 2;
        const imageXPos = ((360 - modAngle) / 360) * imageWidth;
        const sx = 0;
        const sy = 20;
        const sw = imageWidth/2;
        const sh = Math.floor(image.height/2)
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(image, sx, sy, sw, sh, Math.floor(imageXPos), 0, imageWidth, sh*2);
        if (imageXPos > 0){
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.drawImage(image, sx, sy, sw, sh, Math.floor(imageXPos - imageWidth), 0, imageWidth, sh*2);
        }
        else
        {
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.drawImage(image, sx, sy, sw, sh, Math.floor(imageXPos + imageWidth), 0, imageWidth, sh*2);
        }
    },

    toRadians(deg) {
        return deg * Math.PI / 180;
    },
    
    renderFloor(player, skyColor, world, floorAssetTexture) {
        const playerX = player.x;
        const playerY = player.y;
        const playerAngle = player.angle;
        const fov = player.fov;
        const screenWidth = this.gameScreen.width;
        const screenHeight = this.gameScreen.height;
        const imageData = this.ctx.createImageData(screenWidth, screenHeight);
        const data = imageData.data;

        for (let y = 0; y < screenHeight; y++) {
            const distance = (0.5 * screenHeight) / Math.abs(y - (screenHeight * 0.5));
            const raySize = (fov / 320);

            for (let x = 0; x < screenWidth; x++) {
                const relativeAngle = ((x - (320/2)) * raySize);
                const fishEyeCorrection = 1 / Math.cos(this.toRadians(relativeAngle));
                const correctedDistance = distance * fishEyeCorrection;
                const trueAngle = playerAngle + relativeAngle;
                const dx = Math.cos(this.toRadians(trueAngle));
                const dy = Math.sin(this.toRadians(trueAngle));
                const tempX = dx * correctedDistance;
                const tempY = dy * correctedDistance;

                // 1. Get the integer grid cell
                const cellX = Math.floor((tempX + playerX));
                const cellY = Math.floor((tempY + playerY));

                const internalX = Math.floor(((tempX+playerX) - cellX) * 64);
                const internalY = Math.floor(((tempY+playerY) - cellY) * 64);
                // const yHeight = ((world.heightMap[world.getIndexOf(cellX, cellY)] - player.z) / correctedDistance) + (screenHeight * 0.5);

                // 2. Determine color based on even/odd sum (checkerboard)
                // const randomNum = Math.floor(SimpleRandom.next(Number(`${cellX}${cellY}`))*100);
                // // console.log(randomNum);
                const distFade = (Math.min(Math.max((correctedDistance / 50), 0.001), 1));

                const texIndex = (internalY * 64 + internalX ) * 4;
                const redCol = floorAssetTexture[texIndex];
                const greenCol = floorAssetTexture[texIndex+1];
                const blueCol = floorAssetTexture[texIndex+2];

                const pixelIndex = (y * screenWidth + x) * 4;
                data[pixelIndex]     = ((1 - distFade) * redCol) + (distFade * skyColor.r); // R
                data[pixelIndex + 1] = ((1 - distFade) * greenCol) + (distFade * skyColor.g); // G
                data[pixelIndex + 2] = ((1 - distFade) * blueCol) + (distFade * skyColor.b); // B
                data[pixelIndex + 3] = 255;   // A (Opaque)
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    },

    renderTerrainFloor(player, skyColor, world) {
        const screenWidth = this.gameScreen.width;
        const screenHeight = this.gameScreen.height;
        const halfHeight = screenHeight / 2;
        const imageData = this.ctx.createImageData(screenWidth, screenHeight);
        const data = imageData.data;

        const raySize = (player.fov / screenWidth);

        for (let x = 0; x < screenWidth; x++) {
            const relativeAngle = (x - (screenWidth / 2)) * raySize;
            const trueAngle = player.angle + relativeAngle;
            const cosAngle = Math.cos(this.toRadians(trueAngle));
            const sinAngle = Math.sin(this.toRadians(trueAngle));
            

            let highestY = screenHeight;

            for (let z = 1; z < 50; z += 0.1) { 

                const worldX = player.x + cosAngle * z;
                const worldY = player.y + sinAngle * z;

                // 1. Get height from map
                const cellX = Math.floor(worldX);
                const cellY = Math.floor(worldY);
                const heightValue = world.heightMap[world.getIndexOf(cellX, cellY)] || 0;


                const correctedZ = z * Math.cos(this.toRadians(relativeAngle));
                // No idea why 130 works so well here, but it does.
                const yPos = Math.floor(((player.z - heightValue) * 130) / correctedZ + halfHeight);


                if (yPos < highestY) {
                    const isDark = (cellX + cellY) % 2 === 0;
                    const color = isDark ? 25 : 50;
                    const distFade = Math.min(Math.max(z / 50, 0), 1);

                    for (let screenY = Math.max(yPos, 0); screenY < highestY; screenY++) {
                        if (screenY >= screenHeight) continue;

                        const pixelIndex = ((screenY) * screenWidth + x) * 4;
                        data[pixelIndex]     = ((1 - distFade) * color) + (distFade * skyColor.r);
                        data[pixelIndex + 1] = ((1 - distFade) * (color + 50)) + (distFade * skyColor.g);
                        data[pixelIndex + 2] = ((1 - distFade) * color) + (distFade * skyColor.b);
                        data[pixelIndex + 3] = 255;
                    }
                    highestY = yPos;
                }
                
                if (highestY <= 0) break;
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
}

export {Renderer};