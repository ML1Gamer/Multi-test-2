// Simple WebSocket server for Dungeon Crawler multiplayer
// Run with: node server.js

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname)));

// Game state
const rooms = new Map(); // roomId -> room data
const players = new Map(); // playerId -> player data

class GameRoom {
    constructor(id, hostId, difficulty) {
        this.id = id;
        this.hostId = hostId;
        this.difficulty = difficulty;
        this.players = new Map();
        this.started = false;
        this.dungeon = null;
        this.enemies = [];
        this.items = [];
        this.bullets = [];
        this.enemyBullets = [];
    }

    addPlayer(playerId, playerData) {
        this.players.set(playerId, playerData);
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        // If host leaves, transfer to another player or close room
        if (playerId === this.hostId && this.players.size > 0) {
            this.hostId = this.players.keys().next().value;
        }
    }

    broadcast(message, excludeId = null) {
        this.players.forEach((player, playerId) => {
            if (playerId !== excludeId && player.ws && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify(message));
            }
        });
    }
}

// Generate room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    let playerId = null;
    let currentRoom = null;

    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'create_room':
                    playerId = data.playerId;
                    const roomCode = generateRoomCode();
                    currentRoom = new GameRoom(roomCode, playerId, data.difficulty);
                    rooms.set(roomCode, currentRoom);
                    
                    currentRoom.addPlayer(playerId, {
                        ws,
                        name: data.playerName,
                        x: 400,
                        y: 300,
                        health: 100,
                        isHost: true
                    });

                    ws.send(JSON.stringify({
                        type: 'room_created',
                        roomCode,
                        playerId,
                        isHost: true
                    }));
                    console.log(`Room ${roomCode} created by ${playerId}`);
                    break;

                case 'join_room':
                    playerId = data.playerId;
                    const room = rooms.get(data.roomCode);
                    
                    if (!room) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Room not found'
                        }));
                        break;
                    }

                    if (room.started) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Game already started'
                        }));
                        break;
                    }

                    if (room.players.size >= 4) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Room is full (max 4 players)'
                        }));
                        break;
                    }

                    currentRoom = room;
                    room.addPlayer(playerId, {
                        ws,
                        name: data.playerName,
                        x: 400,
                        y: 300,
                        health: 100,
                        isHost: false
                    });

                    // Send success to joining player
                    ws.send(JSON.stringify({
                        type: 'room_joined',
                        roomCode: data.roomCode,
                        playerId,
                        isHost: false,
                        players: Array.from(room.players.entries()).map(([id, p]) => ({
                            id,
                            name: p.name,
                            isHost: id === room.hostId
                        }))
                    }));

                    // Notify other players
                    room.broadcast({
                        type: 'player_joined',
                        playerId,
                        playerName: data.playerName,
                        players: Array.from(room.players.entries()).map(([id, p]) => ({
                            id,
                            name: p.name,
                            isHost: id === room.hostId
                        }))
                    }, playerId);

                    console.log(`Player ${playerId} joined room ${data.roomCode}`);
                    break;

                case 'start_game':
                    if (currentRoom && currentRoom.hostId === playerId) {
                        currentRoom.started = true;
                        currentRoom.broadcast({
                            type: 'game_started',
                            difficulty: currentRoom.difficulty
                        });
                        console.log(`Game started in room ${currentRoom.id}`);
                    }
                    break;

                case 'player_update':
                    if (currentRoom && currentRoom.players.has(playerId)) {
                        const player = currentRoom.players.get(playerId);
                        player.x = data.x;
                        player.y = data.y;
                        player.angle = data.angle;
                        player.health = data.health;
                        player.currentWeapon = data.currentWeapon;

                        // Broadcast to other players
                        currentRoom.broadcast({
                            type: 'player_moved',
                            playerId,
                            x: data.x,
                            y: data.y,
                            angle: data.angle,
                            health: data.health,
                            currentWeapon: data.currentWeapon
                        }, playerId);
                    }
                    break;

                case 'player_shoot':
                    if (currentRoom) {
                        currentRoom.broadcast({
                            type: 'player_shot',
                            playerId,
                            bullet: data.bullet
                        }, playerId);
                    }
                    break;

                case 'enemy_update':
                    if (currentRoom && currentRoom.hostId === playerId) {
                        // Only host manages enemies
                        currentRoom.broadcast({
                            type: 'enemies_sync',
                            enemies: data.enemies
                        }, playerId);
                    }
                    break;

                case 'item_pickup':
                    if (currentRoom) {
                        currentRoom.broadcast({
                            type: 'item_picked',
                            playerId,
                            itemId: data.itemId
                        }, playerId);
                    }
                    break;

                case 'room_change':
                    if (currentRoom) {
                        currentRoom.broadcast({
                            type: 'room_changed',
                            playerId,
                            gridX: data.gridX,
                            gridY: data.gridY
                        }, playerId);
                    }
                    break;

                case 'chat_message':
                    if (currentRoom) {
                        currentRoom.broadcast({
                            type: 'chat_message',
                            playerId,
                            playerName: currentRoom.players.get(playerId)?.name,
                            message: data.message
                        });
                    }
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (currentRoom && playerId) {
            currentRoom.removePlayer(playerId);
            
            // Notify other players
            currentRoom.broadcast({
                type: 'player_left',
                playerId,
                players: Array.from(currentRoom.players.entries()).map(([id, p]) => ({
                    id,
                    name: p.name,
                    isHost: id === currentRoom.hostId
                }))
            });

            // Delete room if empty
            if (currentRoom.players.size === 0) {
                rooms.delete(currentRoom.id);
                console.log(`Room ${currentRoom.id} deleted (empty)`);
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
