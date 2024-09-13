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
const consumables = [];

// Function to randomly generate consumables in the game world
function generateConsumables() {
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * 500 - 250;
        const z = Math.random() * 500 - 250;
        consumables.push({ x, z });
    }
}

generateConsumables();

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

        for (let i = consumables.length - 1; i >= 0; i--) {
            const consumable = consumables[i];
            const playerPos = gameWorld.getPlayerPosition(socket.id);
            const dist = Math.sqrt(Math.pow(playerPos.x - consumable.x, 2) + Math.pow(playerPos.z - consumable.z, 2));

            if (dist < 2) {
                consumables.splice(i, 1);
                io.emit('consumableConsumed', { id: socket.id, x: consumable.x, z: consumable.z });

                // When the player consumes, we also broadcast their updated size
                gameWorld.updatePlayerSize(socket.id, data.size);
                io.emit('gameState', { players: gameWorld.getPlayers() });
            }
        }

        io.emit('gameState', { players: gameWorld.getPlayers() });
    });

    socket.on('updateSize', (data) => {
        gameWorld.updatePlayerSize(socket.id, data.size); // Update the size on the server
        io.emit('gameState', { players: gameWorld.getPlayers() }); // Broadcast updated game state to all clients
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
