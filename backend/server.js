import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import { GameWorld } from '../public/classes/GameWorld.js';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: ['http://localhost:3000', 'https://my-pelican-game-master.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true
}));

const io = new Server(server, {
    cors: {
        origin: ['http://localhost:3000', 'https://my-pelican-game-master.vercel.app'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static(path.join(__dirname, '../public')));
app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'game.html'));
});

const gameWorld = new GameWorld();

function generateConsumable() {
    const x = Math.random() * 500 - 250;
    const z = Math.random() * 500 - 250;
    return { x, z };
}

function generateInitialConsumables() {
    for (let i = 0; i < 40; i++) {
        gameWorld.addConsumable(generateConsumable());
    }
}

generateInitialConsumables();
gameWorld.initializeSharkPools();

const TICK_RATE = 30; // 30 times per second
let lastUpdateTime = Date.now();

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) / 1000; // Convert to seconds
    lastUpdateTime = now;

    gameWorld.update(deltaTime);

    // Check for collisions and other game logic here
    checkConsumableCollisions();
    checkSharkPoolCollisions();
    checkPlayerCollisions();

    io.emit('gameState', {
        players: gameWorld.getPlayers(),
        consumables: gameWorld.getConsumables(),
        sharkPools: gameWorld.getSharkPools()
    });
}

setInterval(gameLoop, 1000 / TICK_RATE);

function checkConsumableCollisions() {
    for (const [playerId, player] of Object.entries(gameWorld.getPlayers())) {
        player.characters.forEach((character, index) => {
            const consumedConsumable = gameWorld.checkConsumableCollision(character);
            if (consumedConsumable) {
                gameWorld.removeConsumable(consumedConsumable);
                io.emit('consumableConsumed', { 
                    id: playerId, 
                    characterIndex: index,
                    x: consumedConsumable.x, 
                    z: consumedConsumable.z 
                });
                setTimeout(() => {
                    const newConsumable = generateConsumable();
                    gameWorld.addConsumable(newConsumable);
                    io.emit('spawnConsumable', newConsumable);
                }, 10000);
                gameWorld.growCharacter(playerId, index, character.size * 0.1);
            }
        });
    }
}

function checkSharkPoolCollisions() {
    for (const [playerId, player] of Object.entries(gameWorld.getPlayers())) {
        if (gameWorld.checkSharkPoolCollision(player)) {
            gameWorld.respawnPlayer(playerId);
            io.to(playerId).emit('playerRespawned', gameWorld.getPlayer(playerId));
        }
    }
}

function checkPlayerCollisions() {
    const players = gameWorld.getPlayers();
    for (const [playerId, player] of Object.entries(players)) {
        for (const [otherPlayerId, otherPlayer] of Object.entries(players)) {
            if (playerId !== otherPlayerId) {
                for (const character of player.characters) {
                    for (const otherCharacter of otherPlayer.characters) {
                        const distance = Math.sqrt(
                            Math.pow(character.x - otherCharacter.x, 2) + 
                            Math.pow(character.z - otherCharacter.z, 2)
                        );
                        if (distance < character.size && character.size > otherCharacter.size * 1.1) {
                            gameWorld.eatCharacter(playerId, otherPlayerId, character, otherCharacter);
                            io.to(otherPlayerId).emit('characterEaten', { 
                                eatenBy: playerId, 
                                eatenCharIndex: otherPlayer.characters.indexOf(otherCharacter)
                            });
                            if (otherPlayer.characters.length === 0) {
                                io.to(otherPlayerId).emit('playerEaten', { eatenBy: playerId });
                            }
                        }
                    }
                }
            }
        }
    }
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    gameWorld.addPlayer(socket.id, 0x3498db);

    socket.emit('registerPlayer', {
        id: socket.id,
        position: { x: 0, z: 0 }
    });

    socket.emit('gameState', {
        players: gameWorld.getPlayers(),
        consumables: gameWorld.getConsumables(),
        sharkPools: gameWorld.getSharkPools()
    });

    const existingPlayers = gameWorld.getPlayers();
    for (const playerId in existingPlayers) {
        if (playerId !== socket.id) {
            socket.emit('playerJoined', {
                id: playerId,
                name: existingPlayers[playerId].name,
                characters: existingPlayers[playerId].characters
            });
        }
    }

    socket.on('setPlayerName', (data) => {
        gameWorld.setPlayerName(socket.id, data.name);
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            name: data.name,
            characters: gameWorld.getPlayer(socket.id).characters
        });
    });

    socket.on('playerInput', (data) => {
        gameWorld.updatePlayerInput(socket.id, data);
    });

    socket.on('split', () => {
        const splitResult = gameWorld.splitPlayer(socket.id);
        if (splitResult.split) {
            io.emit('playerSplit', {
                playerId: socket.id,
                newCharacters: splitResult.newCharacters,
                allCharacters: splitResult.allCharacters
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        gameWorld.removePlayer(socket.id);
        io.emit('playerLeft', { id: socket.id });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});