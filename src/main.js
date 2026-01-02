import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { dayInit } from './dayLevel';
import { nightInit } from './nightLevel';
import { initControls } from './controls';

let renderer = null;
let controls = null;
let cleanup = null;
let night = true;

async function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;

  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  controls = initControls(renderer);

  cleanup = await loadLevel();

  window.addEventListener('keydown', async (e) => {
    if (e.key.toLowerCase() === 'k') {
      await setGameMode(night ? 'day' : 'night');
    }
  });
}

async function loadLevel() {
  renderer.setAnimationLoop(null);

  if (night) {
    return await nightInit(renderer, controls);
  } else {
    return await dayInit(renderer, controls);
  }
}

window.setGameMode = async function (mode) {
  const nextNight = mode === 'night';

  if (nextNight === night) return;
  night = nextNight;

  console.log('Cambio de modo:', night ? 'NIGHT' : 'DAY');

  if (cleanup) cleanup();

  controls.reset();

  cleanup = await loadLevel();
};
await init();
