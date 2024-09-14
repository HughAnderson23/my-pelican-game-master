// Character.js
import * as THREE from '/node_modules/three/build/three.module.js'; // Ensure Three.js is imported correctly

export class Character {
    constructor(color, x, z) {
        this.size = 1; // Initial size
        const geometry = new THREE.SphereGeometry(this.size, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, 1, z); // Start position
    }

    grow() {
        this.size += 0.5; // Increase size by 0.5
        this.mesh.scale.set(this.size, this.size, this.size); // Scale up the mesh
    }

    checkCollision(target) {
        const box1 = new THREE.Box3().setFromObject(this.mesh).expandByScalar(this.size); // Scale the collision box by size
        const box2 = new THREE.Box3().setFromObject(target.mesh);
        return box1.intersectsBox(box2);
    }
}
