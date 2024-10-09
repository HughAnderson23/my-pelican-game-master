import * as THREE from '/node_modules/three/build/three.module.js';
import { Character } from './Character.js';

export class PlayerController {
    constructor(playerId, color, startX, startZ, scene, playerName) {
        this.scene = scene;
        this.id = playerId;
        this.color = color;
        this.characters = [new Character(color, startX, startZ)];
        
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(
            -50 * aspect, 50 * aspect,
            50, -50,
            1, 1000
        );
        this.camera.position.set(0, 50, 0);
        this.camera.lookAt(this.characters[0].mesh.position);

        this.targetPosition = new THREE.Vector3(startX, 0, startZ);
        this.lerpFactor = 0.07; // Adjust this value to change movement smoothness
        this.playerName = playerName;
        this.nameSprite = this.createNameSprite(playerName);
        this.scene.add(this.nameSprite);
    }

    createNameSprite(name) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        context.font = 'Bold 48px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText(name, 128, 64);
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(20, 10, 1);  // Increased scale for larger text
        
        return sprite;
    }

    updateNamePosition() {
        if (this.characters.length > 0) {
            const characterCenter = this.getCharactersCenter();
            this.nameSprite.position.set(characterCenter.x, characterCenter.y + this.characters[0].size + 4, characterCenter.z);
        }
    }

    updateNameSprite(newName) {
        this.playerName = newName;
        this.scene.remove(this.nameSprite);
        this.nameSprite = this.createNameSprite(newName);
        this.scene.add(this.nameSprite);
    }

    updateCharacters(characterData) {
        // Remove all existing character meshes
        this.characters.forEach(char => this.scene.remove(char.mesh));
        
        // Create new characters based on the received data
        this.characters = characterData.map(charData => {
            const char = new Character(this.color, charData.x, charData.z, charData.size);
            char.direction = charData.direction || { x: 0, z: 0 }; // Changed y to z here
            char.speed = charData.speed || 0;
            char.splitVelocity = charData.splitVelocity;
            char.mergeTarget = charData.mergeTarget;
            this.scene.add(char.mesh);
            return char;
        });
    }

    updateCharacterPositions() {
        this.characters.forEach(char => {
            if (char.mergeTarget) {
                // Move towards merge target
                const dx = char.mergeTarget.x - char.mesh.position.x;
                const dz = char.mergeTarget.z - char.mesh.position.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                if (distance > 0.1) {
                    char.mesh.position.x += dx * 0.1;
                    char.mesh.position.z += dz * 0.1;
                } else {
                    char.mesh.position.x = char.mergeTarget.x;
                    char.mesh.position.z = char.mergeTarget.z;
                }
            }
        });
    }

    getCharactersCenter() {
        const center = new THREE.Vector3();
        this.characters.forEach(char => {
            center.add(char.mesh.position);
        });
        return center.divideScalar(this.characters.length);
    }

    grow() {
        this.characters.forEach(char => char.grow());
    }

    growCharacter(index, amount) {
        if (this.characters[index]) {
            this.characters[index].size += amount;
            this.characters[index].mesh.scale.set(this.characters[index].size, this.characters[index].size, this.characters[index].size);
        }
    }

    removeCharacter(index) {
        if (index >= 0 && index < this.characters.length) {
            const removedChar = this.characters.splice(index, 1)[0];
            removedChar.dispose();
            this.scene.remove(removedChar.mesh);
            return removedChar.mesh;  // Return the mesh for removal from the scene
        }
        return null;
    }
}