export class GameWorld {
    constructor() {
        this.players = {};
    }

    addPlayer(id, color) {
        this.players[id] = { id, color, x: 0, z: 0, size: 1 }; // Initialize size to 1
    }

    removePlayer(id) {
        delete this.players[id];
    }

    updatePlayerPosition(id, x, z) {
        if (this.players[id]) {
            this.players[id].x = x;
            this.players[id].z = z;
        }
    }

    updatePlayerSize(id, size) {
        if (this.players[id]) {
            this.players[id].size = size; // Update player size
        }
    }

    getPlayers() {
        return this.players;
    }

    getPlayer(id) {
        return this.players[id]; // Return the player object, including size
    }

    getPlayerPosition(id) {
        if (this.players[id]) {
            return { x: this.players[id].x, z: this.players[id].z };
        }
        return null;
    }

    resetPlayer(id) {
        const player = this.getPlayer(id);
        if (player) {
            player.size = 1; // Reset size
            player.x = Math.random() * 500 - 250;
            player.z = Math.random() * 500 - 250;
        }
    }
}


