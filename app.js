// Replace bare imports with CDN imports
import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/webxr/VRButton.js';
import { VRController } <script src="VRController.js"></script>

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x20232a);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.getElementById('renderArea').appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

// Add light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 50, 100);
scene.add(light);

// Handle GeoJSON loading
document.getElementById('folderInput').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files).filter(f => f.name.endsWith('.geojson'));

  for (const file of files) {
    const text = await file.text();
    const geojson = JSON.parse(text);
    renderGeoJSON(geojson);
  }
});

function renderGeoJSON(geojson) {
  const features = geojson.features || [];

  features.forEach(feature => {
    const { geometry, properties } = feature;
    const height = properties?.height || 5; // Default height

    if (!geometry) return;

    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      const shapes = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

      shapes.forEach(polygon => {
        const shape = new THREE.Shape();
        polygon[0].forEach(([x, y], index) => {
          if (index === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        });

        const extrudeSettings = { depth: height, bevelEnabled: false };
        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
      });

    } else if (geometry.type === 'Point') {
      const [x, y] = geometry.coordinates;
      const z = properties?.height || 1;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xff6600 })
      );
      sphere.position.set(x, z, -y);
      scene.add(sphere);

    } else if (geometry.type === 'LineString') {
      const points = geometry.coordinates.map(([x, y]) => new THREE.Vector3(x, 0.5, -y));
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        lineGeom,
        new THREE.LineBasicMaterial({ color: 0x00ffff })
      );
      scene.add(line);
    }
  });
}

function animate() {
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
