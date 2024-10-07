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

// Load the custom texture (blueprint-style)
const textureLoader = new THREE.TextureLoader();
const blueprintTexture = textureLoader.load('/textures/blueprint-grid.png', function (texture) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3); // Repeat pattern to fit the ground
});

// Create a material using the custom texture
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
        const newCharacters = playerController.split();
        if (newCharacters && newCharacters.length > 0) {
            socket.emit('split', { 
                id: playerController.id,
                characters: playerController.characters.map(char => ({
                    x: char.mesh.position.x,
                    z: char.mesh.position.z,
                    size: char.size
                }))
            });
        }
    }
});

socket.on('registerPlayer', (data) => {
    playerController = new PlayerController(data.id, 0x3498db, data.position.x, data.position.z, scene, playerName);
    playerController.characters.forEach(char => scene.add(char.mesh));
    console.log("Player created and added to scene", playerController);
    
    // Emit player name to server
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

socket.on('spawnConsumables', (data) => {
    data.forEach((consumableData) => {
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
        const consumable = new THREE.Mesh(geometry, material);
        consumable.position.set(consumableData.x, 0.5, consumableData.z);
        scene.add(consumable);
        consumables.push(consumable);
    });
});

socket.on('spawnConsumable', (data) => {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
    const consumable = new THREE.Mesh(geometry, material);
    consumable.position.set(data.x, 0.5, data.z);
    scene.add(consumable);
    consumables.push(consumable);
});

socket.on('consumableConsumed', (data) => {
    consumables = consumables.filter((consumable) => {
        if (consumable.position.x === data.x && consumable.position.z === data.z) {
            scene.remove(consumable);
            return false;
        }
        return true;
    });
});

socket.on('playerGrew', (data) => {
    if (data.id === playerController.id) {
        playerController.updateCharacters(data.characters);
    } else if (players[data.id]) {
        players[data.id].updateCharacters(data.characters);
    }
});

socket.on('spawnSharkPools', (data) => {
    data.forEach((sharkPoolData) => {
        const geometry = new THREE.SphereGeometry(sharkPoolData.size, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        const sharkPool = new THREE.Mesh(geometry, material);
        sharkPool.position.set(sharkPoolData.x, sharkPoolData.size, sharkPoolData.z);
        scene.add(sharkPool);
        sharkPools.push(sharkPool);
    });
});

socket.on('playerRespawned', (data) => {
    playerController.updateCharacters(data.characters);
});

socket.on('characterEaten', (data) => {
    if (playerController.id === data.eatenBy) {
        playerController.grow();
    } else if (playerController.id === data.id) {
        const removedMesh = playerController.removeCharacter(data.eatenCharIndex);
        if (removedMesh) {
            scene.remove(removedMesh);
        }
        if (playerController.characters.length === 0) {
            // Player completely eaten, respawn
            const newChar = new Character(0x3498db, 0, 0, 1);
            playerController.characters.push(newChar);
            scene.add(newChar.mesh);
        }
    }
});

socket.on('playerEaten', (data) => {
    alert(`You've been eaten by player ${data.eatenBy}! Respawning...`);
    // Respawn logic here (if needed)
});

socket.on('playerSplit', (data) => {
    const { playerId, newCharacters, allCharacters } = data;
    if (playerId === playerController.id) {
        // This is our own split, update local representation
        playerController.updateCharacters(allCharacters);
    } else if (players[playerId]) {
        // This is another player's split
        players[playerId].updateCharacters(allCharacters);
    }
});

socket.on('playerMerged', (data) => {
    const { playerId, characters } = data;
    if (playerId === playerController.id) {
        // This is our own merge, update local representation
        playerController.updateCharacters(characters);
    } else if (players[playerId]) {
        // This is another player's merge
        players[playerId].updateCharacters(characters);
    }
});

// socket.on('heartbeat', () => {
//     socket.emit('heartbeat');
// });

function updateGameState(data) {
    Object.keys(data.players).forEach((id) => {
        if (id === playerController.id) {
            playerController.updateCharacters(data.players[id].characters);
        } else {
            if (!players[id]) {
                players[id] = new PlayerController(id, 0x3498db, data.players[id].characters[0].x, data.players[id].characters[0].z, scene, data.players[id].name);
            } else {
                // Update the player's name if it has changed
                if (players[id].playerName !== data.players[id].name) {
                    players[id].updateNameSprite(data.players[id].name);
                }
            }
            players[id].updateCharacters(data.players[id].characters);
        }
    });

    // Remove disconnected players
    Object.keys(players).forEach((id) => {
        if (!data.players[id]) {
            players[id].characters.forEach(char => scene.remove(char.mesh));
            scene.remove(players[id].nameSprite);
            delete players[id];
        }
    });
}

// function updatePlayerCharacters(player, serverCharacters) {
//     // Update existing characters
//     player.characters.forEach((char, index) => {
//         if (serverCharacters[index]) {
//             char.mesh.position.set(
//                 serverCharacters[index].x,
//                 1,
//                 serverCharacters[index].z
//             );
//             char.size = serverCharacters[index].size;
//             char.mesh.scale.set(char.size, char.size, char.size);
//         }
//     });

//     // Add new characters
//     while (player.characters.length < serverCharacters.length) {
//         const newCharData = serverCharacters[player.characters.length];
//         const newChar = new Character(player.color, newCharData.x, newCharData.z, newCharData.size);
//         player.characters.push(newChar);
//         scene.add(newChar.mesh);
//     }

//     // Remove extra characters
//     while (player.characters.length > serverCharacters.length) {
//         const removedChar = player.characters.pop();
//         scene.remove(removedChar.mesh);
//     }
// }

socket.on('gameState', updateGameState);

function animate() {
    requestAnimationFrame(animate);
    if (playerController) {
        raycaster.setFromCamera(mouse, playerController.camera);
        const intersects = raycaster.intersectObject(ground);

        if (intersects.length > 0) {
            const targetPosition = intersects[0].point;
            playerController.updatePosition(targetPosition);
            
            // Emit move event for each character
            socket.emit('move', { 
                id: playerController.id, 
                characters: playerController.characters.map(char => ({
                    x: char.mesh.position.x,
                    z: char.mesh.position.z,
                    size: char.size
                }))
            });
        }
        // Update player name positions
         if (playerController) {
             playerController.updateNamePosition();
         }
            Object.values(players).forEach(player => {
             player.updateNamePosition();
            });

        // Update other players
        Object.values(players).forEach(player => {
            if (player.id !== playerController.id) {
                player.updatePosition(player.characters[0].mesh.position);
            }
        });

        // Update camera position
        const center = playerController.getCharactersCenter();
        playerController.camera.position.set(center.x, playerController.camera.position.y, center.z);

        renderer.render(scene, playerController ? playerController.camera : camera);
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