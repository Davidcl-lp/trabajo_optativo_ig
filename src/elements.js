import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export function createGround(texture, scene) {
  const tex = texture;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(50, 50);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ map: tex })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
}
export function createTable(scene) {
  const table = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1), mat);
  top.position.y = 0.75;
  table.add(top);

  [
    [0.65, 0.35, 0.45],
    [-0.65, 0.35, 0.45],
    [0.65, 0.35, -0.45],
    [-0.65, 0.35, -0.45],
  ].forEach((p) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), mat);
    leg.position.set(...p);
    table.add(leg);
  });

  table.position.set(0, 0, -1);
  scene.add(table);
}

export function spawnGrass(grassScene, count, areaSize, groundY, scene) {
  for (let i = 0; i < count; i++) {
    const base = grassScene;
    const grass = SkeletonUtils.clone(base);

    grass.position.set(
      (Math.random() - 0.5) * areaSize,
      groundY,
      (Math.random() - 0.5) * areaSize
    );
    const scale = 0.006 + Math.random() * 0.08;
    grass.scale.setScalar(scale);

    scene.add(grass);
  }
}
export function spawnVegetation(model, count, minDist, scene) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const pos = getValidPosition(200, minDist, positions);
    if (!pos) continue;
    const obj = model.clone();
    obj.position.copy(pos);
    obj.scale.setScalar(2 + Math.random());
    scene.add(obj);
    positions.push(pos);
  }
}

const PLAYER_ZONE_RADIUS = 7;
const BIRD_ZONE_RADIUS = 15;
function getValidPosition(area, minDist, existing) {
  const p = new THREE.Vector3();
  for (let i = 0; i < 50; i++) {
    p.set((Math.random() - 0.5) * area, 0, (Math.random() - 0.5) * area);
    if (p.distanceTo(new THREE.Vector3(0, 1.6, 3)) < PLAYER_ZONE_RADIUS)
      continue;
    if (p.distanceTo(new THREE.Vector3(0, 0, -15)) < BIRD_ZONE_RADIUS) continue;
    if (existing.some((e) => e.distanceTo(p) < minDist)) continue;
    return p.clone();
  }
  return null;
}
export function createRocks(model, scene) {
  for (let i = 0; i < 2; i++) {
    const rock = model.clone();

    rock.scale.setScalar(2.5);
    rock.rotation.y = Math.PI * 1.5;
    rock.position.set(i * 6 - 2, -1, -12);

    scene.add(rock);
  }
}

export function createShotgun(model, scene, scalar, position, rotation) {
  const shotgun = model.clone();
  shotgun.scale.setScalar(scalar);
  shotgun.position.copy(position);
  shotgun.rotation.set(rotation.x, rotation.y, rotation.z);
  scene.add(shotgun);
  return shotgun;
}

export function createCan(model, scene, scalar, position) {
  const can = model.clone();
  can.scale.setScalar(scalar);
  can.position.copy(position);
  scene.add(can);
  return can;
}

export function createFlashlight(model, scene, options = {}) {
  const {
    scale = 0.2,
    position = new THREE.Vector3(0, 1.1, -1),
    rotation = new THREE.Euler(0, 0, 0),

    intensity = 6,
    distance = 25,
    angle = Math.PI / 5,
    penumbra = 0.4,

    lightOffset = new THREE.Vector3(20, 0, 0.12),
  } = options;

  const flashlight = model.clone();
  flashlight.scale.setScalar(scale);
  flashlight.position.copy(position);
  flashlight.rotation.copy(rotation);

  flashlight.rotation.y += Math.PI * 1.5;

  flashlight.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const light = new THREE.SpotLight(
    0xffffff,
    intensity,
    distance,
    angle,
    penumbra
  );

  light.position.copy(lightOffset);

  const target = new THREE.Object3D();
  target.position.set(0, 0, 1);
  flashlight.add(target);
  light.target = target;

  flashlight.add(light);
  let on = true;
  light.visible = on;

  flashlight.userData.toggle = () => {
    on = !on;
    light.visible = on;
  };

  flashlight.userData.isFlashlight = true;
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(flashlight);
  return flashlight;
}

export function createCelestialLight(scene, options = {}) {
  const {
    position = new THREE.Vector3(10, 20, 10),

    color = 0xffffff,
    intensity = 1,

    texture = null,
    sphereSize = 2,
    castShadow = true,
  } = options;

  const light = new THREE.DirectionalLight(color, intensity);
  light.position.copy(position);
  light.castShadow = castShadow;

  if (castShadow) {
    light.shadow.mapSize.set(2048, 2048);

    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.02;

    const d = 30;
    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 100;
  }

  scene.add(light);
  let mesh = null;

  if (texture) {
    const geo = new THREE.SphereGeometry(sphereSize, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      color: color,
    });

    mesh = new THREE.Mesh(geo, mat);

    mesh.position.copy(position).multiplyScalar(50);

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    scene.add(mesh);
  }

  return { light, mesh };
}

export function enableShadows(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        child.material.needsUpdate = true;
      }
    }
  });
}

export function createDayNightPanel(scene) {
  const panel = new THREE.Group();
  const hitboxes = [];

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.8, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  panel.add(base);

  const dayButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.3, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xffe066 })
  );
  dayButton.position.set(-0.3, 0.15, -0.1);
  dayButton.userData.mode = 'day';
  panel.add(dayButton);
  hitboxes.push(dayButton);

  const nightButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.3, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x4a6fa5 })
  );
  nightButton.position.set(0.3, 0.15, -0.1);
  nightButton.userData.mode = 'night';
  panel.add(nightButton);
  hitboxes.push(nightButton);

  panel.position.set(0, 1.15, -1.55);
  panel.rotation.y = Math.PI;

  scene.add(panel);
  return hitboxes;
}
