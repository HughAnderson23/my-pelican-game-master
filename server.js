import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { GameWorld } from './public/classes/GameWorld.js'; // Ensure this path is correct

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));

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
            const playerPos = gameWorld.getPlayerPosition(socket.id);
            const dist = Math.sqrt(Math.pow(playerPos.x - consumable.x, 2) + Math.pow(playerPos.z - consumable.z, 2));

            if (dist < 2) {
                consumables.splice(i, 1); // Remove the consumed consumable
                io.emit('consumableConsumed', { id: socket.id, x: consumable.x, z: consumable.z });

                // After 10 seconds, respawn a new consumable
                setTimeout(() => {
                    const newConsumable = generateConsumable();
                    consumables.push(newConsumable);
                    io.emit('spawnConsumable', newConsumable); // Notify all clients of the new consumable
                }, 10000); // 10 seconds delay for respawning

                gameWorld.updatePlayerSize(socket.id, data.size);
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
