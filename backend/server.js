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
const io = new Server(server);

// Enable CORS to allow requests from your frontend (e.g., hosted on Vercel)
app.use(cors({ origin: 'https://my-pelican-game-master.vercel.app/' })); // Replace with actual frontend URL

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

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
    for (let i = 0; i < 20; i++) {
        consumables.push(generateConsumable());
    }
}

generateInitialConsumables();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    gameWorld.addPlayer(socket.id, 0x3498db);

    socket.emit('registerPlayer', {
        id: socket.id,
        position: { x: 0, z: 0 }
    });

    socket.emit('spawnConsumables', consumables);

    socket.on('move', (data) => {
        gameWorld.updatePlayerPosition(socket.id, data.x, data.z);
    
        // Check for collisions with consumables
        for (let i = consumables.length - 1; i >= 0; i--) {
            const consumable = consumables[i];
            const player = gameWorld.getPlayer(socket.id);
            const playerSize = player.size || 1; // Default size is 1 if not specified
    
            const playerPos = { x: player.x, z: player.z };
            const dist = Math.sqrt(Math.pow(playerPos.x - consumable.x, 2) + Math.pow(playerPos.z - consumable.z, 2));
    
            // Adjust the collision size to be proportional to the player's size
            if (dist < playerSize) { // Adjust collision range to player's size
                consumables.splice(i, 1); // Remove the consumed consumable
                io.emit('consumableConsumed', { id: socket.id, x: consumable.x, z: consumable.z });
    
                // After 10 seconds, respawn a new consumable
                setTimeout(() => {
                    const newConsumable = generateConsumable();
                    consumables.push(newConsumable);
                    io.emit('spawnConsumable', newConsumable); // Notify all clients of the new consumable
                }, 10000); // 10 seconds delay for respawning
    
                gameWorld.updatePlayerSize(socket.id, player.size); // Update the player's size in the game world
                io.emit('gameState', { players: gameWorld.getPlayers() });
            }
        }
    
        io.emit('gameState', { players: gameWorld.getPlayers() });
    });
    

    socket.on('updateSize', (data) => {
        gameWorld.updatePlayerSize(socket.id, data.size);
        io.emit('gameState', { players: gameWorld.getPlayers() });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        gameWorld.removePlayer(socket.id);
        io.emit('gameState', { players: gameWorld.getPlayers() });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

