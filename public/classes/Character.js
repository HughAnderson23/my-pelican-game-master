import * as THREE from '/node_modules/three/build/three.module.js';

export class Character {
    constructor(color, x, z, size = 1) {
        this.size = size;
        this.geometry = new THREE.SphereGeometry(1, 32, 32);
        this.material = new THREE.MeshBasicMaterial({ color });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(x, 1, z);
        this.mesh.scale.set(this.size, this.size, this.size);
        this.velocity = new THREE.Vector3();
    }

    grow(amount = 0.5) {
        this.size += amount;
        this.mesh.scale.set(this.size, this.size, this.size);
    }

    shrink(amount = 0.5) {
        this.size = Math.max(0.5, this.size - amount);
        this.mesh.scale.set(this.size, this.size, this.size);
    }

    split() {
        if (this.size < 2) return null; // Too small to split
        
        const newSize = this.size / 2;
        this.shrink(newSize);
        
        const splitCharacter = new Character(this.material.color.getHex(), 
                                             this.mesh.position.x, 
                                             this.mesh.position.z, 
                                             newSize);
        
        // Set initial velocity for the split piece
        const angle = Math.random() * Math.PI * 2;
        splitCharacter.velocity.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(0.5);
        
        return splitCharacter;
    }

    update(deltaTime) {
        // Apply velocity
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Slow down
        this.velocity.multiplyScalar(0.98);
    }

    checkCollision(target) {
        const distance = this.mesh.position.distanceTo(target.mesh.position);
        return distance < (this.size + target.size);
    }

    dispose() {
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }
    }
}