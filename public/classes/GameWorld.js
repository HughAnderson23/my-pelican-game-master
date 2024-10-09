export class GameWorld {
    constructor() {
        this.players = {};
        this.mergeTimeout = 10000; // 10 seconds before merging
        this.sharkPools = [];
        this.maxSharkPools = 7;
        this.characterIdCounter = 0;
        this.consumables = [];
    }

    addPlayer(id, color) {
        this.players[id] = { 
            id, 
            color, 
            name: 'Anonymous',
            characters: [{ x: 0, z: 0, size: 1, direction: { x: 0, z: 0 }, speed: 0 }],
            lastSplitTime: 0
        };
    }

    setPlayerName(id, name) {
        if (this.players[id]) {
            this.players[id].name = name;
        }
    }

    removePlayer(id) {
        delete this.players[id];
    }

    updatePlayerInput(id, data) {
        const player = this.players[id];
        if (player && data.characters) {
            player.characters.forEach((char, index) => {
                if (data.characters[index]) {
                    char.direction = data.characters[index].direction;
                    char.speed = data.characters[index].speed;
                }
            });
        }
    }

    update(deltaTime) {
        for (const id in this.players) {
            this.updatePlayerPosition(id, deltaTime);
            this.updateSplitVelocity(id, deltaTime);
            this.checkForMerge(id);
        }
    }

    updatePlayerPosition(id, deltaTime) {
        const player = this.players[id];
        if (player) {
            const baseSpeed = 20; // Adjust this value to change base movement speed
            player.characters.forEach(char => {
                if (char.direction && char.speed !== undefined) {
                    const speed = baseSpeed * char.speed;
                    char.x += char.direction.x * speed * deltaTime;
                    char.z += char.direction.z * speed * deltaTime; // Changed y to z here

                    // Add split velocity to the movement
                    if (char.splitVelocity) {
                        char.x += char.splitVelocity.x * deltaTime;
                        char.z += char.splitVelocity.z * deltaTime;
                    }

                    // Ensure the character stays within the game boundaries
                    char.x = Math.max(-250, Math.min(250, char.x));
                    char.z = Math.max(-250, Math.min(250, char.z));
                }
            });
        }
    }

    updateSplitVelocity(id, deltaTime) {
        if (this.players[id]) {
            this.players[id].characters.forEach(char => {
                if (char.splitVelocity) {
                    // Reduce split velocity over time
                    char.splitVelocity.x *= 0.95;
                    char.splitVelocity.z *= 0.95;

                    // If split velocity is very small, remove it
                    if (Math.abs(char.splitVelocity.x) < 0.1 && Math.abs(char.splitVelocity.z) < 0.1) {
                        delete char.splitVelocity;
                    }
                }
            });
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
        if (now - player.lastSplitTime < this.mergeTimeout) {
            return false; // Not enough time has passed for merging
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
                    // Start merging process
                    if (!char1.mergeTarget) {
                        char1.mergeTarget = { x: (char1.x + char2.x) / 2, z: (char1.z + char2.z) / 2 };
                        char2.mergeTarget = char1.mergeTarget;
                    }
                }
                if (char1.mergeTarget && distance < 1) {
                    // Complete merge
                    char1.size = Math.sqrt(Math.pow(char1.size, 2) + Math.pow(char2.size, 2));
                    char1.x = char1.mergeTarget.x;
                    char1.z = char1.mergeTarget.z;
                    delete char1.mergeTarget;
                    merged.push(j);
                }
            }
        }
        player.characters = player.characters.filter((_, index) => !merged.includes(index));
        return merged.length > 0;
    }


    generateCharacterId() {
        this.characterIdCounter += 1;
        return `char_${this.characterIdCounter}`;
    }

    splitPlayer(id) {
        if (this.players[id]) {
            const now = Date.now();
            if (now - this.players[id].lastSplitTime < 5000) return { split: false }; // Prevent splitting too frequently

            const newCharacters = [];
            this.players[id].characters.forEach(char => {
                if (char.size >= 2) {
                    const newSize = char.size / 2;
                    char.size = newSize;
    
                    const angle = Math.atan2(char.direction.z, char.direction.x);
                    const distance = newSize * 4; // Increased distance for more visible separation
                    const newChar = {
                        id: this.generateCharacterId(),
                        x: char.x + Math.cos(angle) * distance,
                        z: char.z + Math.sin(angle) * distance,
                        size: newSize,
                        direction: { x: char.direction.x, z: char.direction.z },
                        speed: char.speed,
                        splitVelocity: { x: Math.cos(angle) * 20, z: Math.sin(angle) * 20 } // Add split velocity
                    };
                    newCharacters.push(newChar);
                    
                    // Add split velocity to the original character in the opposite direction
                    char.splitVelocity = { x: -Math.cos(angle) * 20, z: -Math.sin(angle) * 20 };
                }
            });
            if (newCharacters.length > 0) {
                this.players[id].characters = this.players[id].characters.concat(newCharacters);
                this.players[id].lastSplitTime = now;
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
                    size: 1,
                    direction: { x: 0, z: 0 }
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
                size: 1,
                direction: { x: 0, z: 0 }
            }];
        }
    }

    getSharkPools() {
        return this.sharkPools;
    }

    addConsumable(consumable) {
        this.consumables.push(consumable);
      }
    
      removeConsumable(consumable) {
        const index = this.consumables.findIndex(c => c.x === consumable.x && c.z === consumable.z);
        if (index !== -1) {
          this.consumables.splice(index, 1);
        }
      }
    
      getConsumables() {
        return this.consumables;
      }
    
      checkConsumableCollision(character) {
        for (const consumable of this.consumables) {
          const dist = Math.sqrt(Math.pow(character.x - consumable.x, 2) + Math.pow(character.z - consumable.z, 2));
          if (dist < character.size) {
            return consumable;
          }
        }
        return null;
      }
}