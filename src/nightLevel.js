import * as THREE from 'three';
import { loadTexture } from './loadTextures';
import { loadGLTF } from './loadModels';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  createCan,
  createCelestialLight,
  createDayNightPanel,
  createFlashlight,
  createGround,
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
let rabbitModel = null;
let treeModel = null;
let grassModel = null;
let flashLightModel = null;
//Textures
let floorTextures = null;
let skyTextures = null;
let moonTextures = null;
//Elements
let shotGun = null;
let can = null;
let flashlight = null;
// rabbits
let rabbitGLTF = null;
let rabbits = [];
let mixers = [];
let bullets = [];
let fragments = [];
const rabbit_SPAWN_INTERVAL = 1000;
const rabbit_HITBOX_RADIUS = 130;
const RABBIT_MIN_DISTANCE = 10;
const RABBIT_MAX_DISTANCE = 20;
const RABBIT_SPEED = 5;
const RABBIT_TARGET_RADIUS = 4;
let lastrabbitSpawn = 0;

async function loadModels() {
  const shotgunGLTF = await loadGLTF('../public/models/remington1100.glb');
  rabbitGLTF = await loadGLTF('../public/models/bunny.glb');
  const canGLTF = await loadGLTF('../public/models/soda_can.glb');
  const treeGLTF = await loadGLTF('../public/models/tree1.glb');
  const grassGLTF = await loadGLTF('../public/models/grass1.glb');
  const flashLightGLTF = await loadGLTF('../public/models/flashlight.glb');

  shotGunModel = shotgunGLTF.scene;
  rabbitModel = rabbitGLTF;
  canModel = canGLTF.scene;
  treeModel = treeGLTF.scene;
  grassModel = grassGLTF.scene;
  flashLightModel = flashLightGLTF.scene;
}

async function loadTextures() {
  skyTextures = await loadTexture('../public/textures/sky_night.jpg');
  floorTextures = await loadTexture('../public/textures/forest_floor.jpg');
  moonTextures = await loadTexture('../public/textures/moon_textures.jpeg');
}
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

function spawnrabbit(model) {
  const rabbit = SkeletonUtils.clone(model.scene);
  rabbit.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  rabbit.scale.setScalar(0.004);
  const angle = Math.random() * Math.PI * 2;
  const distance = THREE.MathUtils.lerp(
    RABBIT_MIN_DISTANCE,
    RABBIT_MAX_DISTANCE,
    Math.random()
  );

  rabbit.position.set(
    Math.cos(angle) * distance,
    0,
    Math.sin(angle) * distance
  );
  const targetAngle = Math.random() * Math.PI * 2;
  const targetDistance = Math.random() * RABBIT_TARGET_RADIUS;

  const target = new THREE.Vector3(
    Math.cos(targetAngle) * targetDistance,
    0,
    Math.sin(targetAngle) * targetDistance
  );
  const direction = target.clone().sub(rabbit.position).normalize();
  rabbit.userData.direction = direction;

  rabbit.rotation.y = Math.atan2(direction.x, direction.z);
  const hitbox = new THREE.Mesh(
    new THREE.SphereGeometry(rabbit_HITBOX_RADIUS, 16, 16),
    new THREE.MeshStandardMaterial({ visible: false })
  );
  hitbox.position.set(0, 0.3 / rabbit.scale.y, 0);
  hitbox.userData.rabbit = rabbit;
  rabbit.add(hitbox);
  rabbit.userData.hitbox = hitbox;

  const mixer = new THREE.AnimationMixer(rabbit);
  mixer.clipAction(rabbitGLTF.animations[2]).play();
  mixers.push(mixer);

  scene.add(rabbit);
  rabbits.push(rabbit);
}

function breakrabbit(rabbit) {
  scene.remove(rabbit);
  rabbits = rabbits.filter((b) => b !== rabbit);

  for (let i = 0; i < 20; i++) {
    const piece = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3d0a0a })
    );
    piece.position.copy(rabbit.position);
    piece.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.15,
      Math.random() * 0.15,
      (Math.random() - 0.5) * 0.15
    );
    scene.add(piece);
    fragments.push(piece);
  }
}
function nightRender(time) {
  if (time - lastrabbitSpawn > rabbit_SPAWN_INTERVAL) {
    spawnrabbit(rabbitModel);
    lastrabbitSpawn = time;
  }

  const delta = clock.getDelta();
  mixers.forEach((m) => m.update(delta));

  rabbits.forEach((rabbit) => {
    rabbit.position.addScaledVector(
      rabbit.userData.direction,
      RABBIT_SPEED * delta
    );
  });

  bullets.forEach((b) => {
    const hitboxes = rabbits.map((rabbit) => rabbit.userData.hitbox);

    const dir = b.userData.velocity.clone();
    const dist = dir.length();

    raycaster.set(b.position, dir.normalize());
    raycaster.far = dist;

    const hits = raycaster.intersectObjects(hitboxes, false);

    if (hits.length > 0) {
      const rabbit = hits[0].object.userData.rabbit;
      breakrabbit(rabbit);

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
  flashlight = createFlashlight(flashLightModel, scene, {
    scale: 0.005,
    position: new THREE.Vector3(-0.5, 0.85, -1),
  });

  can = createCan(canModel, scene, 0.08, new THREE.Vector3(0.5, 1.1, -1));
  createTable(scene);
  spawnGrass(grassModel, 5000, 70, 0, scene);

  const { light: moonLight } = createCelestialLight(scene, {
    texture: moonTextures, // textura de luna
    position: new THREE.Vector3(5, 15, 5),
    size: 1.5,
    intensity: 0.3,
  });
  panelHitboxes = createDayNightPanel(scene);
  enableShadows(scene);
}

export async function nightInit(rendererMain, controls) {
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
    flashlight,
    panelHitboxes,
  });

  renderer.setAnimationLoop(nightRender);

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
