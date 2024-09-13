import { PlayerController } from './classes/PlayerController.js';
import * as THREE from '/node_modules/three/build/three.module.js';

const socket = io();

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('gameCanvas').appendChild(renderer.domElement);

const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x336699, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = Math.PI / 2;
scene.add(ground);

let playerController;
let players = {};
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let consumables = [];

document.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

socket.on('registerPlayer', (data) => {
    playerController = new PlayerController(data.id, 0x3498db, data.position.x, data.position.z);
    scene.add(playerController.character.mesh);
    console.log("Player created and added to scene", playerController);
});

socket.on('spawnConsumables', (data) => {
    data.forEach((consumableData) => {
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        const consumable = new THREE.Mesh(geometry, material);
        consumable.position.set(consumableData.x, 0.5, consumableData.z);
        scene.add(consumable);
        consumables.push(consumable);
    });
});

socket.on('consumableConsumed', (data) => {
    consumables = consumables.filter((consumable) => {
        if (consumable.position.x === data.x && consumable.position.z === data.z) {
            scene.remove(consumable);
            if (data.id === playerController.id) {
                playerController.grow(); // Grow the player who consumed the consumable

                // Send the updated size to the server
                socket.emit('updateSize', { size: playerController.character.size });
            }
            return false;
        }
        return true;
    });
});

socket.on('gameState', (data) => {
    Object.keys(data.players).forEach((id) => {
        if (id === playerController.id) return;

        if (players[id]) {
            players[id].character.mesh.position.set(data.players[id].x, 1, data.players[id].z);
            players[id].character.mesh.scale.set(data.players[id].size, data.players[id].size, data.players[id].size); // Update player size
        } else {
            players[id] = new PlayerController(id, 0x3498db, data.players[id].x, data.players[id].z);
            players[id].character.mesh.scale.set(data.players[id].size, data.players[id].size, data.players[id].size); // Set size
            scene.add(players[id].character.mesh);
            console.log(`Player ${id} added to scene`);
        }
    });

    Object.keys(players).forEach((id) => {
        if (!data.players[id]) {
            scene.remove(players[id].character.mesh);
            delete players[id];
            console.log(`Player ${id} removed from scene`);
        }
    });
});

window.addEventListener('resize', () => {
    if (playerController && playerController.camera) {
        const aspect = window.innerWidth / window.innerHeight;
        playerController.camera.left = -50 * aspect;
        playerController.camera.right = 50 * aspect;
        playerController.camera.top = 50;
        playerController.camera.bottom = -50;
        playerController.camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

function animate() {
    requestAnimationFrame(animate);
    if (playerController) {
        raycaster.setFromCamera(mouse, playerController.camera);
        const intersects = raycaster.intersectObject(ground);

        if (intersects.length > 0) {
            const targetPosition = intersects[0].point;
            playerController.updatePosition(targetPosition);
            socket.emit('move', { x: playerController.character.mesh.position.x, z: playerController.character.mesh.position.z });
            renderer.render(scene, playerController.camera);
        }
    }
}

animate();


// Log any raycasting issues or rendering issues
// console.log("Raycaster setup complete");
// console.log("Ground plane added");
