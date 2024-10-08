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

    updatePosition(newTargetPosition) {
        this.targetPosition.set(newTargetPosition.x, 0, newTargetPosition.z);
        
        this.characters.forEach((char) => {
            const speedFactor = 3 * (1 / Math.sqrt(char.size));
            const direction = new THREE.Vector3()
                .subVectors(this.targetPosition, char.mesh.position)
                .normalize();

            // Move towards the target position with lerp
            char.mesh.position.lerp(
                char.mesh.position.clone().add(direction.multiplyScalar(0.5 * speedFactor)),
                this.lerpFactor
            );

            char.update(8); // Assume 60 FPS, so deltaTime is about 16ms
        });

        // Update camera position to the center of all character pieces
        const center = this.getCharactersCenter();
        this.camera.position.set(center.x, this.camera.position.y, center.z);
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
            this.scene.add(char.mesh);
            return char;
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