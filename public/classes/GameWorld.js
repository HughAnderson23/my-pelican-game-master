export class GameWorld {
    constructor() {
        this.players = {};
        this.mergeTimeout = 10000; // 10 seconds before merging
        this.sharkPools = [];
        this.maxSharkPools = 7;
    }

    addPlayer(id, color) {
        this.players[id] = { 
            id, 
            color, 
            characters: [{ x: 0, z: 0, size: 1 }]
        };
    }

    removePlayer(id) {
        delete this.players[id];
    }

    updatePlayerPosition(id, characters) {
        if (this.players[id]) {
            this.players[id].characters = characters;
            this.checkForMerge(id);
        }
    }

    growPlayer(id, amount) {
        if (this.players[id]) {
            this.players[id].characters.forEach(char => {
                char.size += amount;
            });
        }
    }

    checkForMerge(id) {
        const player = this.players[id];
        const now = Date.now();
        if (player.lastSplitTime && now - player.lastSplitTime < this.mergeTimeout) {
            return; // Not enough time has passed for merging
        }

        const merged = [];
        for (let i = 0; i < player.characters.length; i++) {
            if (merged.includes(i)) continue;
            for (let j = i + 1; j < player.characters.length; j++) {
                if (merged.includes(j)) continue;
                const char1 = player.characters[i];
                const char2 = player.characters[j];
                const distance = Math.sqrt(Math.pow(char1.x - char2.x, 2) + Math.pow(char1.z - char2.z, 2));
                if (distance < char1.size + char2.size) {
                    // Merge these characters
                    char1.size = Math.sqrt(Math.pow(char1.size, 2) + Math.pow(char2.size, 2));
                    char1.x = (char1.x + char2.x) / 2;
                    char1.z = (char1.z + char2.z) / 2;
                    merged.push(j);
                }
            }
        }
        player.characters = player.characters.filter((_, index) => !merged.includes(index));
        if (merged.length > 0) {
            return true; // Indicate that a merge occurred
        }
        return false;
    }

    splitPlayer(id) {
        if (this.players[id]) {
            const newCharacters = [];
            this.players[id].characters.forEach(char => {
                if (char.size >= 2) {
                    const newSize = char.size / 2;
                    char.size = newSize;
    
                    const angle = Math.random() * Math.PI * 2;
                    const distance = newSize * 4; // Increased distance for more visible separation
                    const newChar = {
                        x: char.x + Math.cos(angle) * distance,
                        z: char.z + Math.sin(angle) * distance,
                        size: newSize
                    };
                    newCharacters.push(newChar);
                }
            });
            if (newCharacters.length > 0) {
                this.players[id].characters = this.players[id].characters.concat(newCharacters);
                return { split: true, newCharacters, allCharacters: this.players[id].characters };
            }
        }
        return { split: false };
    }

    eatCharacter(eaterId, eatenId, eaterChar, eatenChar) {
        const eater = this.players[eaterId];
        const eaten = this.players[eatenId];

        if (eater && eaten) {
            // Increase the size of the eating character
            eaterChar.size += eatenChar.size;

            // Remove the eaten character
            eaten.characters = eaten.characters.filter(char => char !== eatenChar);

            // If the eaten player has no more characters, respawn them
            if (eaten.characters.length === 0) {
                eaten.characters.push({
                    x: Math.random() * 500 - 250,
                    z: Math.random() * 500 - 250,
                    size: 1
                });
            }
        }
    }

    getPlayers() {
        return this.players;
    }

    getPlayer(id) {
        return this.players[id];
    }

    initializeSharkPools() {
        for (let i = 0; i < this.maxSharkPools; i++) {
            this.addSharkPool();
        }
    }

    addSharkPool() {
        const x = Math.random() * 500 - 250;
        const z = Math.random() * 500 - 250;
        this.sharkPools.push({ x, z, size: 10 }); // Size 10 is an example, adjust as needed
    }

    checkSharkPoolCollision(player) {
        for (const sharkPool of this.sharkPools) {
            for (const character of player.characters) {
                const distance = Math.sqrt(
                    Math.pow(character.x - sharkPool.x, 2) + 
                    Math.pow(character.z - sharkPool.z, 2)
                );
                if (distance < character.size + sharkPool.size) {
                    return true; // Collision detected
                }
            }
        }
        return false; // No collision
    }

    respawnPlayer(id) {
        if (this.players[id]) {
            this.players[id].characters = [{
                x: Math.random() * 500 - 250,
                z: Math.random() * 500 - 250,
                size: 1
            }];
        }
    }

    getSharkPools() {
        return this.sharkPools;
    }
}