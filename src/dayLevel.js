import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { loadTexture } from './loadTextures';
import { loadGLTF } from './loadModels';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  createCan,
  createCelestialLight,
  createDayNightPanel,
  createGround,
  createRocks,
  createShotgun,
  createTable,
  enableShadows,
  spawnGrass,
  spawnVegetation,
} from './elements';
import { handleMovement } from './controls';

// Scene
let panelHitboxes = [];
let scene = null;
let camera = null;
let userRig = null;
let renderer = null;
// Models
let shotGunModel = null;
let canModel = null;
let birdModel = null;
let treeModel = null;
let bushModel = null;
let bigRockModel = null;
let grassModel = null;
//Textures
let floorTextures = null;
let skyTextures = null;
//Elements
let shotGun = null;
let can = null;
// Birds
let birdGLTF = null;
let birds = [];
let mixers = [];
let bullets = [];
let fragments = [];
const BIRD_SPAWN_INTERVAL = 3000;
const BIRD_SPEED = 0.2;
const BIRD_SPAWN_Z = -20;
const BIRD_HEIGHT_MIN = 3;
const BIRD_HEIGHT_MAX = 5;
const BIRD_HITBOX_RADIUS = 30;
let lastBirdSpawn = 0;

async function loadModels() {
  const shotgunGLTF = await loadGLTF('../public/models/remington1100.glb');
  birdGLTF = await loadGLTF('../public/models/bird_with_animation.glb');
  const canGLTF = await loadGLTF('../public/models/soda_can.glb');
  const treeGLTF = await loadGLTF('../public/models/tree1.glb');
  const rockGLTF = await loadGLTF('../public/models/bigRock.glb');
  const grassGLTF = await loadGLTF('../public/models/grass1.glb');

  shotGunModel = shotgunGLTF.scene;
  birdModel = birdGLTF;
  canModel = canGLTF.scene;
  treeModel = treeGLTF.scene;
  bigRockModel = rockGLTF.scene;
  grassModel = grassGLTF.scene;
}

async function loadTextures() {
  skyTextures = await loadTexture('../public/textures/sky.jpg');
  floorTextures = await loadTexture('../public/textures/forest_floor.jpg');
}
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

function spawnBird(model) {
  const bird = SkeletonUtils.clone(model.scene);
  bird.scale.setScalar(0.02);

  bird.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        child.material = child.material.clone();
        child.material.color.set(0x6b4f2a);
        child.material.needsUpdate = true;
      }
    }
  });

  bird.position.set(
    (Math.random() - 0.5) * 6,
    THREE.MathUtils.lerp(BIRD_HEIGHT_MIN, BIRD_HEIGHT_MAX, Math.random()),
    BIRD_SPAWN_Z
  );

  bird.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.01,
    0,
    BIRD_SPEED
  );

  const hitbox = new THREE.Mesh(
    new THREE.SphereGeometry(BIRD_HITBOX_RADIUS, 16, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 20, 0);
  hitbox.userData.bird = bird;
  bird.add(hitbox);
  bird.userData.hitbox = hitbox;

  const mixer = new THREE.AnimationMixer(bird);
  mixer.clipAction(birdGLTF.animations[0]).play();
  mixers.push(mixer);

  scene.add(bird);
  birds.push(bird);
}

function breakBird(bird) {
  scene.remove(bird);
  birds = birds.filter((b) => b !== bird);

  for (let i = 0; i < 20; i++) {
    const piece = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3d0a0a })
    );
    piece.position.copy(bird.position);
    piece.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.15,
      Math.random() * 0.15,
      (Math.random() - 0.5) * 0.15
    );
    scene.add(piece);
    fragments.push(piece);
  }
}
function dayRender(time) {
  if (time - lastBirdSpawn > BIRD_SPAWN_INTERVAL) {
    spawnBird(birdModel);
    lastBirdSpawn = time;
  }

  const delta = clock.getDelta();
  mixers.forEach((m) => m.update(delta));

  birds.forEach((b) => b.position.add(b.userData.velocity));
  bullets.forEach((b) => {
    const hitboxes = birds.map((bird) => bird.userData.hitbox);

    const dir = b.userData.velocity.clone();
    const dist = dir.length();

    raycaster.set(b.position, dir.normalize());
    raycaster.far = dist;

    const hits = raycaster.intersectObjects(hitboxes, false);

    if (hits.length > 0) {
      const bird = hits[0].object.userData.bird;
      breakBird(bird);

      scene.remove(b);
      b.userData.dead = true;
    } else {
      b.position.add(b.userData.velocity);
    }
  });

  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].userData.dead) bullets.splice(i, 1);
  }

  fragments.forEach((f) => {
    f.position.add(f.userData.velocity);
    f.userData.velocity.y -= 0.006;
  });
  if (can) {
    if (can.userData.velocity) {
      can.position.add(can.userData.velocity);
      can.userData.velocity.y -= 0.01;
    }
  }

  handleMovement(renderer, camera, userRig);
  renderer.render(scene, camera);
}
async function createScene() {
  scene = new THREE.Scene();
  createCelestialLight(scene, {
    position: new THREE.Vector3(10, 20, 10),
    color: 0xfff2a1,
    intensity: 3,
    texture: null,
  });
  scene.background = skyTextures;
  createGround(floorTextures, scene);
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(0, 1.6, 3);
  userRig = new THREE.Group();
  userRig.add(camera);
  scene.add(userRig);
  spawnVegetation(treeModel, 400, 2, scene);
  shotGun = createShotgun(
    shotGunModel,
    scene,
    0.8,
    new THREE.Vector3(0, 0.85, -1),
    new THREE.Euler(0, Math.PI * 2.5, 0)
  );

  can = createCan(canModel, scene, 0.08, new THREE.Vector3(0.5, 1.05, -1));
  createRocks(bigRockModel, scene);
  createTable(scene);
  spawnGrass(grassModel, 5000, 70, 0, scene);
  panelHitboxes = createDayNightPanel(scene);
  enableShadows(scene);
}

export async function dayInit(rendererMain, controls) {
  renderer = rendererMain;
  await loadModels();
  await loadTextures();
  await createScene();

  controls.setContext({
    scene,
    camera,
    userRig,
    bullets,
    shotGun,
    can,
    flashlight: null,
    panelHitboxes,
  });

  renderer.setAnimationLoop(dayRender);

  return () => {
    renderer.setAnimationLoop(null);

    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();

      if (o.material) {
        if (Array.isArray(o.material)) {
          o.material.forEach((m) => m.dispose());
        } else {
          o.material.dispose();
        }
      }
    });
  };
}
