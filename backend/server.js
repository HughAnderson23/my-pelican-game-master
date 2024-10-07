import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import { GameWorld } from '../public/classes/GameWorld.js'; // Adjust the path accordingly

// Define __dirname for ES modules
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

// Enable CORS to allow requests from your frontend (e.g., hosted on Vercel)
app.use(cors({
    origin: ['http://localhost:3000', 'https://my-pelican-game-master.vercel.app'], // Allow both localhost and Vercel
    methods: ['GET', 'POST'],  // Specify allowed methods if needed
    credentials: true          // If you need credentials support (e.g., cookies or authorization headers)
}));

// Socket.IO with CORS enabled
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:3000', 'https://my-pelican-game-master.vercel.app'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'] // Ensure websocket and polling transports are handled
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

// Serve the dashboard as the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

// Serve the game page
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'game.html'));
});

const gameWorld = new GameWorld();
let consumables = [];

// Function to generate a new consumable at a random location
function generateConsumable() {
    const x = Math.random() * 500 - 250;
    const z = Math.random() * 500 - 250;
    return { x, z };
}

// Function to generate the initial set of consumables
function generateInitialConsumables() {
    for (let i = 0; i < 40; i++) {
        consumables.push(generateConsumable());
    }
}

generateInitialConsumables();
// Initialize SharkPools
gameWorld.initializeSharkPools();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    gameWorld.addPlayer(socket.id, 0x3498db);

    socket.emit('registerPlayer', {
        id: socket.id,
        position: { x: 0, z: 0 }
    });

    socket.emit('spawnConsumables', consumables);
    socket.emit('spawnSharkPools', gameWorld.getSharkPools());

    // Send existing players' information to the new player
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
        // Broadcast the new player's name to all other players
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            name: data.name,
            characters: gameWorld.getPlayer(socket.id).characters
        });
    });

    socket.on('move', (data) => {
        gameWorld.updatePlayerPosition(socket.id, data.characters);
        const merged = gameWorld.checkForMerge(socket.id);
        if (merged) {
            io.emit('playerMerged', {
                playerId: socket.id,
                characters: gameWorld.getPlayer(socket.id).characters
            });
        }

        // Check for collisions with consumables
        for (let i = consumables.length - 1; i >= 0; i--) {
            const consumable = consumables[i];
            const player = gameWorld.getPlayer(socket.id);
            
            for (const character of player.characters) {
                const dist = Math.sqrt(Math.pow(character.x - consumable.x, 2) + Math.pow(character.z - consumable.z, 2));
    
                if (dist < character.size) {
                    consumables.splice(i, 1);
                    io.emit('consumableConsumed', { id: socket.id, x: consumable.x, z: consumable.z });
    
                    setTimeout(() => {
                        const newConsumable = generateConsumable();
                        consumables.push(newConsumable);
                        io.emit('spawnConsumable', newConsumable);
                    }, 10000);
    
                    gameWorld.growPlayer(socket.id, character.size * 0.1);
                    break;
                }
            }
        }

        // Check for SharkPool collision
        if (gameWorld.checkSharkPoolCollision(gameWorld.getPlayer(socket.id))) {
            gameWorld.respawnPlayer(socket.id);
            io.to(socket.id).emit('playerRespawned', gameWorld.getPlayer(socket.id));
        }

        // Check for player eating
        const player = gameWorld.getPlayer(socket.id);
        if (!player) return;

        for (const otherPlayerId in gameWorld.getPlayers()) {
            if (otherPlayerId !== socket.id) {
                const otherPlayer = gameWorld.getPlayer(otherPlayerId);
                if (!otherPlayer) continue;

                for (const character of player.characters) {
                    for (const otherCharacter of otherPlayer.characters) {
                        const distance = Math.sqrt(
                            Math.pow(character.x - otherCharacter.x, 2) + 
                            Math.pow(character.z - otherCharacter.z, 2)
                        );

                        if (distance < character.size && character.size > otherCharacter.size * 1.1) {
                            gameWorld.eatCharacter(socket.id, otherPlayerId, character, otherCharacter);
                            io.to(otherPlayerId).emit('characterEaten', { 
                                eatenBy: socket.id, 
                                eatenCharIndex: otherPlayer.characters.indexOf(otherCharacter)
                            });
                            if (otherPlayer.characters.length === 0) {
                                io.to(otherPlayerId).emit('playerEaten', { eatenBy: socket.id });
                            }
                        }
                    }
                }
            }
        }

        io.emit('gameState', { 
            players: gameWorld.getPlayers(),
            sharkPools: gameWorld.getSharkPools()
         });
    });

    socket.on('split', (data) => {
        const splitResult = gameWorld.splitPlayer(socket.id);
        if (splitResult.split) {
            io.emit('playerSplit', {
                playerId: socket.id,
                newCharacters: splitResult.newCharacters,
                allCharacters: splitResult.allCharacters
            });
            io.emit('gameState', { players: gameWorld.getPlayers() });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        gameWorld.removePlayer(socket.id);
        io.emit('playerLeft', { id: socket.id });
        io.emit('gameState', { players: gameWorld.getPlayers() });
    });

    setInterval(() => {
        io.emit('gameState', { players: gameWorld.getPlayers() });
    }, 1000 / 2); // 2 times per second
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});