// Multiplayer networking module using PeerJS

class MultiplayerManager {
    constructor() {
        this.peer = new Peer();
        this.isHost = false;
        this.hostConnection = null;
        this.clientConnections = new Map(); // Maps peer ID to connection + player data
        this.remotePlayers = new Map(); // Maps peer ID to player data
        this.myPlayerId = null;
        this.myPlayerData = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onPlayerMoved = null;
        this.onWorldStateUpdate = null;
        
        this.peer.on('open', (id) => {
            this.myPlayerId = id;
            console.log('My peer ID:', id);
        });
        
        this.peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
        });
    }
    
    // ===== HOSTING =====
    async startHost(playerData, worldState) {
        this.isHost = true;
        this.myPlayerData = playerData;
        this.worldState = worldState;  // Store it
        this.clientConnections.set(this.myPlayerId, {
            connection: null,
            playerData: playerData
        });
        
        console.log('Started hosting with ID:', this.myPlayerId);
        return this.myPlayerId;
    }
    
    handleIncomingConnection(conn) {
        if (!this.isHost) {
            console.warn('Received connection but not a host');
            return;
        }
        
        conn.on('open', () => {
            console.log('Client connected:', conn.peer);
            this.clientConnections.set(conn.peer, {
                connection: conn,
                playerData: null
            });
            
            // Send world state and existing players to new client
            const existingPlayers = Array.from(this.clientConnections.entries())
                .map(([id, data]) => ({
                    id,
                    playerData: data.playerData
                }));
            
            conn.send({
                type: 'WORLD_STATE',
                worldState: this.worldState
            });
            
            conn.send({
                type: 'PLAYER_LIST',
                players: existingPlayers
            });
            
            // Notify all other clients of new player
            this.broadcastToClients({
                type: 'PLAYER_JOINED',
                id: conn.peer,
                playerData: null // Will be set when client sends first update
            });
        });
        
        conn.on('data', (message) => {
            this.handleMessageAsHost(conn, message);
        });
        
        conn.on('close', () => {
            console.log('Client disconnected:', conn.peer);
            this.clientConnections.delete(conn.peer);
            
            // Notify all clients
            this.broadcastToClients({
                type: 'PLAYER_LEFT',
                id: conn.peer
            });
            
            if (this.onPlayerLeft) {
                this.onPlayerLeft(conn.peer);
            }
        });
    }
    
    handleMessageAsHost(conn, message) {
        switch (message.type) {
            case 'PLAYER_INIT':
                // Client sending initial player data
                for (let [id, data] of this.clientConnections.entries()) {
                    if (data.connection === conn) {
                        data.playerData = message.playerData;
                        break;
                    }
                }
                
                // Add to host's remote players
                this.remotePlayers.set(conn.peer, {
                    id: conn.peer,
                    ...message.playerData
                });
                
                if (this.onPlayerJoined) {
                    this.onPlayerJoined(conn.peer, message.playerData);
                }
                
                this.broadcastToClients({
                    type: 'PLAYER_JOINED',
                    id: conn.peer,
                    playerData: message.playerData
                });
                break;
                
            case 'PLAYER_UPDATE':
                // Update player position/angle
                for (let [id, data] of this.clientConnections.entries()) {
                    if (data.connection === conn) {
                        data.playerData = message.playerData;
                        break;
                    }
                }
                
                // Update host's remote players
                this.remotePlayers.set(conn.peer, {
                    id: conn.peer,
                    ...message.playerData
                });
                
                if (this.onPlayerMoved) {
                    this.onPlayerMoved(conn.peer, message.playerData);
                }
                
                // Broadcast to all other clients
                this.broadcastToClients({
                    type: 'PLAYER_UPDATE',
                    id: conn.peer,
                    playerData: message.playerData
                }, conn.peer);
                break;
        }
    }
    
    broadcastToClients(message, excludeId = null) {
        for (let [id, data] of this.clientConnections.entries()) {
            if (excludeId && id === excludeId) continue;
            if (data.connection && data.connection.open) {
                data.connection.send(message);
            }
        }
    }
    
    // ===== JOINING =====
    async joinHost(hostId, playerData) {
        this.myPlayerData = playerData;
        
        this.hostConnection = this.peer.connect(hostId);
        
        return new Promise((resolve, reject) => {
            this.hostConnection.on('open', () => {
                console.log('Connected to host:', hostId);
                
                // Send initial player data
                this.hostConnection.send({
                    type: 'PLAYER_INIT',
                    playerData: playerData
                });
                
                resolve();
            });
            
            this.hostConnection.on('data', (message) => {
                this.handleMessageAsClient(message);
            });
            
            this.hostConnection.on('error', (err) => {
                reject(err);
            });
        });
    }
    
    handleMessageAsClient(message) {
        switch (message.type) {
            case 'PLAYER_LIST':
                // Initial list of existing players
                for (let player of message.players) {
                    if (player.id !== this.myPlayerId) {
                        this.remotePlayers.set(player.id, {
                            id: player.id,
                            ...player.playerData
                        });
                    }
                }
                break;
            
            case 'WORLD_STATE':
                if (this.onWorldStateUpdate) {
                    this.onWorldStateUpdate(message.worldState);
                }
                break;

            case 'PLAYER_JOINED':
                if (message.id !== this.myPlayerId) {
                    this.remotePlayers.set(message.id, {
                        id: message.id,
                        ...message.playerData
                    });
                    
                    if (this.onPlayerJoined) {
                        this.onPlayerJoined(message.id, message.playerData);
                    }
                }
                break;
                
            case 'PLAYER_UPDATE':
                if (message.id !== this.myPlayerId) {
                    this.remotePlayers.set(message.id, {
                        id: message.id,
                        ...message.playerData
                    });
                    
                    if (this.onPlayerMoved) {
                        this.onPlayerMoved(message.id, message.playerData);
                    }
                }
                break;
                
            case 'PLAYER_LEFT':
                this.remotePlayers.delete(message.id);
                
                if (this.onPlayerLeft) {
                    this.onPlayerLeft(message.id);
                }
                break;
        }
    }
    
    // ===== SENDING UPDATES =====
    updateMyPlayer(playerData) {
        this.myPlayerData = playerData;
        
        if (this.isHost) {
            // Update our entry in client connections
            for (let [id, data] of this.clientConnections.entries()) {
                if (id === this.myPlayerId) {
                    data.playerData = playerData;
                    break;
                }
            }
            
            // Broadcast host position to all clients
            this.broadcastToClients({
                type: 'PLAYER_UPDATE',
                id: this.myPlayerId,
                playerData: playerData
            });
        } else if (this.hostConnection && this.hostConnection.open) {
            // Send update to host
            this.hostConnection.send({
                type: 'PLAYER_UPDATE',
                playerData: playerData
            });
        }
    }
    
    getRemotePlayer(playerId) {
        return this.remotePlayers.get(playerId);
    }
    
    getAllRemotePlayers() {
        return Array.from(this.remotePlayers.values());
    }
    
    disconnect() {
        if (this.hostConnection) {
            this.hostConnection.close();
        }
        this.peer.destroy();
    }
}

export { MultiplayerManager };
