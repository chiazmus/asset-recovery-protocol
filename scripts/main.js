const gameScreen = document.getElementById('screen');
const ctx = gameScreen.getContext("2d");
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
import { Renderer } from "./renderer.js";
import { World } from "./world.js";
import { RayCaster } from "./rayCaster.js";
import { Player } from "./player.js";
import { Dungeon } from "./dungeon.js";
import { MultiplayerManager } from "./multiplayer.js";
import { SpriteRenderer } from "./spriteRenderer.js";

let inputEvents = {"mouseDeltaX": 0, "KeyW": false, "KeyS": false, "KeyA": false, "KeyD": false};
const mouseSensitivity = 0.2;
const turnSpeed = 4;
const skyCol = {r: 20, g: 20, b: 25};

// Multiplayer variables
let multiplayerManager = null;
let isMultiplayer = false;
let networkUpdateInterval = null;

// Z-buffer for wall depth testing (one entry per screen column)
let wallZBuffer = new Array(320);

gameScreen.width = 320;
gameScreen.height = 240;

let myAssets = {};

const loadImage = (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = url;
    });
};

function toRadians(deg) {
    return deg * Math.PI / 180;
}

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function renderWalls() {

    const raysToCast = 320;
    const raySize = (Player.fov / raysToCast);

    for (let i = 0; i < raysToCast; i++) {
        const relativeAngle = ((i - (raysToCast/2)) * raySize)
        const tempAngle = Player.angle + relativeAngle;
        const rayCastResult = RayCaster.castRayDDA(Player.x, Player.y, toRadians(tempAngle), World);

        const distance = Math.max(rayCastResult.distance, 0.01);
        const correctedDistance = distance * Math.cos(toRadians(relativeAngle));
        
        // Store in z-buffer for sprite depth testing
        wallZBuffer[i] = correctedDistance;
        
        const lineHeight = Math.min(Math.floor((1 / correctedDistance) * gameScreen.height), gameScreen.height * 2);
        const xLoc = Math.floor((i / raysToCast) * gameScreen.width)+0.5;
        const lineBottom = Math.floor((gameScreen.height / 2) + (lineHeight / 2));
        const dirX = Math.cos(toRadians(tempAngle));
        const dirY = Math.sin(toRadians(tempAngle));

        let textureCoord;
        if (rayCastResult.side === 0) {
            // Vertical wall - find the exact Y where ray hit
            const hitY = Player.y + rayCastResult.distance * dirY;
            textureCoord = hitY % 1;
        } else {
            // Horizontal wall - find the exact X where ray hit
            const hitX = Player.x + rayCastResult.distance * dirX;
            textureCoord = hitX % 1;
        }

        const sx = Math.min(Math.max(textureCoord * myAssets.wallPanel.width, 0), 63);

        let color = rayCastResult.side == 0 ? 0 : 0.25;
        color = color + (1 - Math.max(5 / distance, 0.001));
        color = Math.min(color, 1);
        if (distance < 48) {
            ctx.drawImage(myAssets.wallPanel, sx, 0, 1, 64, xLoc, lineBottom - lineHeight, 1, lineHeight);
            Renderer.drawLine(xLoc, lineBottom, xLoc, lineBottom - lineHeight, `rgba(20, 20, 25, ${color})`, (1/raysToCast * (gameScreen.width))+0.1);
        }
    }
}

function updatePlayer() {

    if (World.worldMap[World.getIndexOf(Math.floor(Player.x), Math.floor(Player.y))] != 0) {
        Player.x = World.spawnPoint.x;
        Player.y = World.spawnPoint.y;
    }

    if (inputEvents.mouseDeltaX !== 0) {
        Player.angle += (inputEvents.mouseDeltaX * mouseSensitivity);
        inputEvents.mouseDeltaX = 0;
    }

    let dx = 0;
    let dy = 0;

    if (inputEvents.KeyW) {
        dx = Math.cos(toRadians(Player.angle)) * Player.speed;
        dy = Math.sin(toRadians(Player.angle)) * Player.speed;
    } else if (inputEvents.KeyS) {
        dx = -Math.cos(toRadians(Player.angle)) * Player.speed;
        dy = -Math.sin(toRadians(Player.angle)) * Player.speed;
    }

    if (inputEvents.KeyA) {
        dx = Math.cos(toRadians(Player.angle - 90)) * Player.speed;
        dy = Math.sin(toRadians(Player.angle - 90)) * Player.speed;
    } else if (inputEvents.KeyD) {
        dx = Math.cos(toRadians(Player.angle + 90)) * Player.speed;
        dy = Math.sin(toRadians(Player.angle + 90)) * Player.speed;
    }

    // Collision detection
    const collisionBuffer = 0;
    const newX = Player.x + dx;
    const newY = Player.y + dy;
    
    const cellX = Math.floor(newX);
    const cellY = Math.floor(newY);
    
    if (World.isWithinBounds(cellX, cellY)) {
        const index = World.getIndexOf(cellX, cellY);
        if (World.worldMap[index] === 0) {  // Only move if no wall
            Player.x = newX;
            Player.y = newY;
        }
    }

    const worldZ = World.heightMap[World.getIndexOf(Math.floor(Player.x), Math.floor(Player.y))];
    Player.z = worldZ + 1;
}

function startNetworkUpdateLoop() {
    if (networkUpdateInterval) {
        clearInterval(networkUpdateInterval);
    }
    
    networkUpdateInterval = setInterval(() => {
        if (isMultiplayer && multiplayerManager) {
            multiplayerManager.updateMyPlayer({
                x: Player.x,
                y: Player.y,
                z: Player.z,
                angle: Player.angle
            });
        }
    }, 50); // Send updates every 50ms
}

function extractImageData(img) {
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;

    return imageData
}

async function loadAssets() {

    const [ backgroundFiller, woodWall, floorPanel, wallPanel, robotSprite
    ] = await Promise.all([
        loadImage('./assets/backgroundPlaceFiller.png'), 
        loadImage('./assets/woodWall.png'),
        loadImage('./assets/floorTile.png'),
        loadImage('./assets/wallPanel.png'),
        loadImage('./assets/robotSprite.png'),
    ]);

    myAssets = {backgroundFiller, woodWall, floorPanel, 'floorPanelTexture': extractImageData(floorPanel), wallPanel, robotSprite}; 
}

async function setupMultiplayer() {
    multiplayerManager = new MultiplayerManager();
    
    // Wait for peer ID
    await new Promise((resolve) => {
        const checkId = () => {
            if (multiplayerManager.myPlayerId) {
                resolve();
            } else {
                setTimeout(checkId, 100);
            }
        };
        checkId();
    });
    
    // Setup UI
    const hostButton = document.getElementById('hostButton');
    const joinButton = document.getElementById('joinButton');
    const hostIdInput = document.getElementById('hostIdInput');
    const peerStatus = document.getElementById('peerStatus');
    const myPeerId = document.getElementById('myPeerId');
    
    myPeerId.textContent = 'Your ID: ' + multiplayerManager.myPlayerId;
    
    hostButton.onclick = async () => {
        isMultiplayer = true;
        await multiplayerManager.startHost({
            x: Player.x,
            y: Player.y,
            z: Player.z,
            angle: Player.angle
        }, { 
            worldMap: World.worldMap,
            heightMap: World.heightMap,
            spawnPoint: {x: Player.x, y: Player.y}
        });
        
        hostButton.textContent = 'Hosting - ID: ' + multiplayerManager.myPlayerId;
        hostButton.disabled = true;
        joinButton.disabled = true;
        hostIdInput.disabled = true;
        peerStatus.textContent = 'Hosting Game';
        
        // Copy to clipboard
        navigator.clipboard.writeText(multiplayerManager.myPlayerId);
        alert('Your host ID copied to clipboard: ' + multiplayerManager.myPlayerId);
        
        // Start network update loop
        startNetworkUpdateLoop();
    };
    
    joinButton.onclick = async () => {
        const hostId = hostIdInput.value.trim();
        if (!hostId) {
            alert('Please enter a host ID');
            return;
        }
        
        try {
            isMultiplayer = true;
            await multiplayerManager.joinHost(hostId, {
                x: Player.x,
                y: Player.y,
                z: Player.z,
                angle: Player.angle
            });
            
            hostButton.disabled = true;
            joinButton.disabled = true;
            hostIdInput.disabled = true;
            peerStatus.textContent = 'Connected to Host';
            console.log('Successfully joined host:', hostId);
            
            // Start network update loop
            startNetworkUpdateLoop();
        } catch (err) {
            alert('Failed to connect to host: ' + err.message);
            isMultiplayer = false;
        }
    };
    
    multiplayerManager.onWorldStateUpdate = (worldState) => {
        World.worldMap = worldState.worldMap;
        World.heightMap = worldState.heightMap;
        World.spawnPoint = worldState.spawnPoint;
    };

    // Setup multiplayer callbacks
    multiplayerManager.onPlayerJoined = (playerId, playerData) => {
        console.log('Player joined:', playerId);
    };
    
    multiplayerManager.onPlayerLeft = (playerId) => {
        console.log('Player left:', playerId);
    };
    
    multiplayerManager.onPlayerMoved = (playerId, playerData) => {
        // Players moved - will be rendered automatically
    };
}

async function init() {
    Renderer.gameScreen = gameScreen;
    Renderer.ctx = ctx;
    // Player.x = 2.5;
    // Player.y = 2.5;
    World.worldHeight = 32;
    World.worldWidth = 32;
    World.fillWorld(0);

    const playerSpawn = Dungeon.createNewDungeon(World.worldWidth, World.worldHeight, World.worldMap);

    Player.x = playerSpawn.x + 0.5;
    Player.y = playerSpawn.y + 0.5;

    World.spawnPoint.x = Player.x;
    World.spawnPoint.y = Player.y;

    World.worldMap[World.getIndexOf(10, 10)] = 1;

    await loadAssets();
    await setupMultiplayer();

    gameScreen.requestPointerLock = gameScreen.requestPointerLock || gameScreen.mozRequestPointerLock;

    gameScreen.addEventListener('click', () => {
    gameScreen.requestPointerLock(); // Locks the cursor to the gameScreen on click
    });

    document.addEventListener('pointerlockchange', () => {
        const peerConnection = document.getElementById('peerConnection');
        if (document.pointerLockElement === gameScreen) {
            // Pointer is locked - hide UI
            peerConnection.style.display = 'none';
        } else {
            // Pointer is free - show UI
            peerConnection.style.display = 'block';
        }
    });

    window.addEventListener("keydown", (e) => {
        inputEvents[e.code] = true;
    });

    window.addEventListener("keyup", (e) => {
        inputEvents[e.code] = false;
    });

    gameScreen.addEventListener('mousemove', (e) => {
        // Accumulate the raw pixel movement
        inputEvents.mouseDeltaX += e.movementX;
    });

    draw();
    update();
}

function draw() {
    Renderer.clearScreen();
    Renderer.renderFloor( Player, skyCol, World, myAssets.floorPanelTexture);
    // Renderer.drawBackground(Player.angle, myAssets.backgroundFiller);
    renderWalls();
    
    // Render remote players
    if (isMultiplayer) {
        const remotePlayers = multiplayerManager.getAllRemotePlayers();
        SpriteRenderer.renderRemotePlayers(ctx, remotePlayers, gameScreen, Player, World, wallZBuffer, myAssets.robotSprite);
        SpriteRenderer.renderMinimap(ctx, Player, remotePlayers, gameScreen);
    }
}

function update() {

    const gamePaused = document.pointerLockElement === null; 

    if (!gamePaused) {
        updatePlayer();
        draw();
    }

    requestAnimationFrame(update);
}

init();