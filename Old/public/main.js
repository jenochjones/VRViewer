// Import Three.js and necessary addons
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let scene, camera, renderer, controls;
let currentModel = null;

// Initialize the Three.js scene
function init() {
    // Get the viewer container
    const viewer = document.getElementById('viewer');
    const width = viewer.clientWidth || window.innerWidth;
    const height = viewer.clientHeight || window.innerHeight;

    // Create the scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd); // Light gray background

    // Set up the camera
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10); // Initial camera position

    // Set up the renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.xr.enabled = true; // Enable WebXR
    viewer.appendChild(renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white light
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10).normalize();
    scene.add(directionalLight);

    // Set up orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Enables inertia
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2; // Limit to top view

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Add Three.js's built-in VR button
    document.body.appendChild(VRButton.createButton(renderer));
}

// Handle window resize to adjust camera and renderer
function onWindowResize() {
    const viewer = document.getElementById('viewer');
    const width = viewer.clientWidth || window.innerWidth;
    const height = viewer.clientHeight || window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

// Load and display the uploaded GLTF file
function loadGLTF(file) {
    const reader = new FileReader();

    reader.onload = function(event) {
        const contents = event.target.result;
        const loader = new GLTFLoader();

        loader.parse(contents, '', function(gltf) {
            // Remove existing model if any
            if (currentModel) {
                scene.remove(currentModel);
                currentModel.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        if (child.material.isMaterial) {
                            cleanMaterial(child.material);
                        }
                    }
                });
                currentModel = null;
            }

            // Add the loaded model to the scene
            currentModel = gltf.scene;
            scene.add(currentModel);

            // Optional: Center the model
            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            currentModel.position.sub(center); // Center the model

            // Optional: Scale the model to fit into the view
            const size = box.getSize(new THREE.Vector3()).length();
            const scale = 10 / size;
            currentModel.scale.setScalar(scale);

            // Adjust camera to fit the model
            fitCameraToObject(camera, currentModel, controls, 1.2);
        }, function(error) {
            console.error('An error occurred while parsing the GLTF model:', error);
            alert('Failed to load GLTF model. Please ensure the file is valid.');
        });
    };

    // Read the GLTF file as ArrayBuffer or Text
    if (file) {
        if (file.name.toLowerCase().endsWith('.glb')) {
            reader.readAsArrayBuffer(file);
        } else if (file.name.toLowerCase().endsWith('.gltf')) {
            reader.readAsText(file);
        } else {
            alert('Unsupported GLTF format. Please upload a .gltf or .glb file.');
        }
    }
}

// Clean up materials to prevent memory leaks
function cleanMaterial(material) {
    material.dispose();

    // Dispose textures
    for (const key in material) {
        if (material.hasOwnProperty(key) && material[key] && material[key].isTexture) {
            material[key].dispose();
        }
    }
}

// Adjust the camera to fit the object
function fitCameraToObject(camera, object, controls, offset = 1.25) {
    const boundingBox = new THREE.Box3();

    // Calculate bounding box of the object
    boundingBox.setFromObject(object);

    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    // Calculate the maximum side of the bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * offset;

    // Update camera position
    camera.position.set(center.x, center.y, cameraZ);

    // Update controls to look at the center of the object
    controls.target = center;
    controls.update();
}

// Animation loop to render the scene
function animate() {
    renderer.setAnimationLoop(function() {
        controls.update();
        renderer.render(scene, camera);
    });
}

// Set up event listeners and initialize the scene
document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();

    // Handle file upload
    const uploadInput = document.getElementById('gltf-upload');
    uploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && (file.name.toLowerCase().endsWith('.gltf') || file.name.toLowerCase().endsWith('.glb'))) {
            loadGLTF(file);
        } else {
            alert('Please upload a valid GLTF file (.gltf or .glb).');
        }
    });
});
