import { World } from "./world.js";

const Dungeon = {
    createNewDungeon (width, height, map) {
        const myMap = Array.from({ length: height }, () => Array(width).fill(1));
        const digger = new ROT.Map.Digger(width, height, {
            roomWidth: [3, 7], 
            roomHeight: [3, 7],
            corridorLength: [2, 5],
            dugPercentage: 0.4 // How much of the map should be empty space
        });

        digger.create((x, y, value) => {
            myMap[y][x] = value;
        });

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                map[World.getIndexOf(x, y)] = myMap[y][x];
            }
        }
        const rooms = digger.getRooms();
        const firstRoom = rooms[0];
        const playerSpawnX = firstRoom.getCenter()[0];
        const playerSpawnY = firstRoom.getCenter()[1];
        return {x: playerSpawnX, y: playerSpawnY};
    }
};

export {Dungeon};