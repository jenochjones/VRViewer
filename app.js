// Replace bare imports with CDN imports
import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/webxr/VRButton.js';

let camera, scene, renderer;
let controls, userGroup;
let controllerGrips = [];
let controllerStates = [];

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 3);

  userGroup = new THREE.Group();
  userGroup.add(camera);
  scene.add(userGroup);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false; // disable in VR

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(light);

  const grip1 = renderer.xr.getControllerGrip(0);
  const grip2 = renderer.xr.getControllerGrip(1);
  scene.add(grip1, grip2);
  controllerGrips.push(grip1, grip2);

  controllerStates.push(
    { grabbing: false, prevMatrix: new THREE.Matrix4(), controller: grip1 },
    { grabbing: false, prevMatrix: new THREE.Matrix4(), controller: grip2 }
  );

  document.getElementById('folderInput').addEventListener('change', handleFolder, false);
  window.addEventListener('resize', onWindowResize);
}

function handleFolder(event) {
  const files = event.target.files;
  Array.from(files).forEach(file => {
    if (file.name.endsWith('.geojson')) {
      const reader = new FileReader();
      reader.onload = e => {
        const geojson = JSON.parse(e.target.result);
        renderGeoJSON(geojson);
      };
      reader.readAsText(file);
    }
  });
}

function renderGeoJSON(geojson) {
  const features = geojson.features || [];

  features.forEach(feature => {
    const { geometry, properties } = feature;
    const height = properties?.height || 5;

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

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateGrabbing() {
  const session = renderer.xr.getSession();
  if (!session) return;

  const inputSources = session.inputSources;

  // Update grab states
  inputSources.forEach((source, i) => {
    const gp = source.gamepad;
    if (!gp) return;
    const isPressed = gp.buttons[0]?.pressed;
    const state = controllerStates[i];
    state.grabbing = isPressed;

    if (isPressed) {
      // Save grip matrix
      state.prevMatrix.copy(controllerGrips[i].matrixWorld);
    }
  });

  const g1 = controllerStates[0], g2 = controllerStates[1];

  if (g1.grabbing && g2.grabbing) {
    // Two-handed grab: scale/rotate
    const m1 = g1.prevMatrix;
    const m2 = g2.prevMatrix;
    const c1 = g1.controller.matrixWorld;
    const c2 = g2.controller.matrixWorld;

    const vOld = new THREE.Vector3().setFromMatrixPosition(m1).sub(new THREE.Vector3().setFromMatrixPosition(m2));
    const vNew = new THREE.Vector3().setFromMatrixPosition(c1).sub(new THREE.Vector3().setFromMatrixPosition(c2));

    const scale = vNew.length() / vOld.length();
    userGroup.scale.multiplyScalar(scale);

    const angleOld = Math.atan2(vOld.z, vOld.x);
    const angleNew = Math.atan2(vNew.z, vNew.x);
    const angleDelta = angleNew - angleOld;
    userGroup.rotation.y += angleDelta;

    const centerOld = new THREE.Vector3().addVectors(m1.getPosition(new THREE.Vector3()), m2.getPosition(new THREE.Vector3())).multiplyScalar(0.5);
    const centerNew = new THREE.Vector3().addVectors(c1.getPosition(new THREE.Vector3()), c2.getPosition(new THREE.Vector3())).multiplyScalar(0.5);
    const translation = new THREE.Vector3().subVectors(centerNew, centerOld);
    userGroup.position.add(translation);

  } else if (g1.grabbing) {
    // One hand: pan
    const delta = new THREE.Vector3().setFromMatrixPosition(g1.controller.matrixWorld)
      .sub(new THREE.Vector3().setFromMatrixPosition(g1.prevMatrix));
    userGroup.position.add(delta);
    g1.prevMatrix.copy(g1.controller.matrixWorld);
  } else if (g2.grabbing) {
    const delta = new THREE.Vector3().setFromMatrixPosition(g2.controller.matrixWorld)
      .sub(new THREE.Vector3().setFromMatrixPosition(g2.prevMatrix));
    userGroup.position.add(delta);
    g2.prevMatrix.copy(g2.controller.matrixWorld);
  }
}

function animate() {
  renderer.setAnimationLoop(() => {
    updateGrabbing();
    renderer.render(scene, camera);
  });
}
