import { PlayerController } from './classes/PlayerController.js';
import { Character } from './classes/Character.js';
import * as THREE from '/node_modules/three/build/three.module.js';

const socket = io(
    window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://my-pelican-game-master-e2eee1009e58.herokuapp.com'
);

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('gameCanvas').appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
const blueprintTexture = textureLoader.load('/textures/blueprint-grid.png', function (texture) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
});

const groundMaterial = new THREE.MeshBasicMaterial({ map: blueprintTexture, side: THREE.DoubleSide });
const groundGeometry = new THREE.PlaneGeometry(500, 500);
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = Math.PI / 2;
scene.add(ground);

let playerController;
let players = {};
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let consumables = [];
let sharkPools = [];
let playerName = localStorage.getItem('playerName') || 'Anonymous';

document.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && playerController) {
        socket.emit('split');
    }
});

socket.on('registerPlayer', (data) => {
    playerController = new PlayerController(data.id, 0x3498db, data.position.x, data.position.z, scene, playerName);
    playerController.characters.forEach(char => scene.add(char.mesh));
    console.log("Player created and added to scene", playerController);
    socket.emit('setPlayerName', { name: playerName });
});

socket.on('playerJoined', (data) => {
    if (!players[data.id]) {
        players[data.id] = new PlayerController(data.id, 0x3498db, data.characters[0].x, data.characters[0].z, scene, data.name);
        players[data.id].updateCharacters(data.characters);
    } else {
        players[data.id].playerName = data.name;
        players[data.id].updateNameSprite(data.name);
    }
});

socket.on('playerLeft', (data) => {
    if (players[data.id]) {
        players[data.id].characters.forEach(char => scene.remove(char.mesh));
        scene.remove(players[data.id].nameSprite);
        delete players[data.id];
    }
});

socket.on('playerRespawned', (data) => {
    playerController.updateCharacters(data.characters);
});

socket.on('characterEaten', (data) => {
    if (playerController.id === data.id) {
        const removedMesh = playerController.removeCharacter(data.eatenCharIndex);
        if (removedMesh) {
            scene.remove(removedMesh);
        }
        if (playerController.characters.length === 0) {
            const newChar = new Character(0x3498db, 0, 0, 1);
            playerController.characters.push(newChar);
            scene.add(newChar.mesh);
        }
    }
});

socket.on('playerEaten', (data) => {
    alert(`You've been eaten by player ${data.eatenBy}! Respawning...`);
});

socket.on('playerSplit', (data) => {
    const { playerId, allCharacters } = data;
    if (playerId === playerController.id) {
        playerController.updateCharacters(allCharacters);
    } else if (players[playerId]) {
        players[playerId].updateCharacters(allCharacters);
    }
});

socket.on('gameState', (data) => {
    updateGameState(data);
});

socket.on('consumableConsumed', (data) => {
    if (playerController && playerController.id === data.id) {
        playerController.growCharacter(data.characterIndex, playerController.characters[data.characterIndex].size * 0.1);
    } else if (players[data.id]) {
        players[data.id].growCharacter(data.characterIndex, players[data.id].characters[data.characterIndex].size * 0.1);
    }
    
    consumables = consumables.filter((consumable) => {
        if (consumable.position.x === data.x && consumable.position.z === data.z) {
            scene.remove(consumable);
            return false;
        }
        return true;
    });
});

function updateGameState(data) {
    Object.keys(data.players).forEach((id) => {
        if (id === playerController.id) {
            playerController.updateCharacters(data.players[id].characters);
        } else {
            if (!players[id]) {
                players[id] = new PlayerController(id, 0x3498db, data.players[id].characters[0].x, data.players[id].characters[0].z, scene, data.players[id].name);
            } else {
                if (players[id].playerName !== data.players[id].name) {
                    players[id].updateNameSprite(data.players[id].name);
                }
            }
            players[id].updateCharacters(data.players[id].characters);
        }
    });

    Object.keys(players).forEach((id) => {
        if (!data.players[id]) {
            players[id].characters.forEach(char => scene.remove(char.mesh));
            scene.remove(players[id].nameSprite);
            delete players[id];
        }
    });

    // Update consumables
    updateConsumables(data.consumables);

    // Update shark pools
    updateSharkPools(data.sharkPools);
}

function updateConsumables(serverConsumables) {
    // Remove all existing consumables from the scene
    consumables.forEach(consumable => scene.remove(consumable));
    consumables = [];

    // Add new consumables based on server state
    serverConsumables.forEach(consumableData => {
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
        const consumable = new THREE.Mesh(geometry, material);
        consumable.position.set(consumableData.x, 0.5, consumableData.z);
        scene.add(consumable);
        consumables.push(consumable);
    });
}

function updateSharkPools(serverSharkPools) {
    sharkPools.forEach(sharkPool => scene.remove(sharkPool));
    sharkPools = serverSharkPools.map(sharkPoolData => {
        const geometry = new THREE.SphereGeometry(sharkPoolData.size, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        const sharkPool = new THREE.Mesh(geometry, material);
        sharkPool.position.set(sharkPoolData.x, sharkPoolData.size, sharkPoolData.z);
        scene.add(sharkPool);
        return sharkPool;
    });
}

function animate() {
    requestAnimationFrame(animate);
    if (playerController) {
        raycaster.setFromCamera(mouse, playerController.camera);
        const intersects = raycaster.intersectObject(ground);

        let targetPosition;
        if (intersects.length > 0) {
            targetPosition = intersects[0].point;
        } else {
            // If no intersection, project the mouse position to the edge of the game area
            const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(playerController.camera);
            const dir = vector.sub(playerController.camera.position).normalize();
            const distance = (0 - playerController.camera.position.y) / dir.y;
            targetPosition = playerController.camera.position.clone().add(dir.multiplyScalar(distance));
            
            // Clamp the target position to the game boundaries
            targetPosition.x = Math.max(-250, Math.min(250, targetPosition.x));
            targetPosition.z = Math.max(-250, Math.min(250, targetPosition.z));
        }

        // Calculate direction and speed for each character
        const inputData = playerController.characters.map(char => {
            const dx = targetPosition.x - char.mesh.position.x;
            const dz = targetPosition.z - char.mesh.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // Define dead zone and max speed distance
            const deadZone = 1; // Adjust this value to change the size of the dead zone
            const maxSpeedDistance = 10; // Adjust this value to change where max speed is reached
            
            let speed;
            if (distance < deadZone) {
                speed = 0;
            } else if (distance > maxSpeedDistance) {
                speed = 1;
            } else {
                speed = (distance - deadZone) / (maxSpeedDistance - deadZone);
            }
            
            // Normalize the direction vector
            const direction = new THREE.Vector2(dx, dz).normalize();
            
            return {
                direction: { x: direction.x, z: direction.y },
                speed: speed
            };
        });

        // Send player input to server
        socket.emit('playerInput', { characters: inputData });

        // Update player character positions
        playerController.updateCharacterPositions();

        // Update player name positions
        playerController.updateNamePosition();
        Object.values(players).forEach(player => {
            player.updateNamePosition();
        });

        // Update camera position
        const center = playerController.getCharactersCenter();
        playerController.camera.position.set(center.x, playerController.camera.position.y, center.z);

        renderer.render(scene, playerController.camera);
    }
}

animate();

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