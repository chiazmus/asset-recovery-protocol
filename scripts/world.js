import { openSimplexNoise } from "./simpleNoise.js";

const World = {
    worldMap: [],
    worldWidth: null,
    worldHeight: null,
    heightMap: [],
    worldSeed: 112358132134,
    spawnPoint: {x: 1.5, y: 1.5},

    getIndexOf(x, y) {
        const index = x + y * this.worldWidth;
        return index;
    },

    isWithinBounds(x, y) {
        return x >= 0 && x <= this.worldWidth - 1 && y >= 0 && y <= this.worldHeight - 1;
    },

    fillWorld (value) {
        const zoom = 0.05;
        const openSimplex = openSimplexNoise(this.worldSeed);
        for (let x = 0; x < this.worldWidth; x++) {
            for (let y = 0; y < this.worldHeight; y++) {
                this.worldMap[this.getIndexOf(x, y)] = value;
                const noiseValue = (openSimplex.noise2D(x / zoom, y / zoom));
                this.heightMap[this.getIndexOf(x, y)] = noiseValue;
            }
        }
    }
};

export {World};