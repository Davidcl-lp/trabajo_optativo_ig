import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

const GRAB_DISTANCE = 0.25;
const MOVE_SPEED = 0.05;

let activeContext = null;
const controllers = [];
const heldObjects = new Map();

export function initControls(renderer) {
  const factory = new XRControllerModelFactory();

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);

    grip.add(factory.createControllerModel(grip));

    controller.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(GRAB_DISTANCE, 16, 16),
        new THREE.MeshPhongMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        })
      )
    );

    controller.addEventListener('selectend', () => onSelect(controller));
    controller.addEventListener('squeezestart', () => onSqueeze(controller));

    controllers.push({ controller, grip });
  }

  return {
    setContext(ctx) {
      activeContext = ctx;

      const { userRig } = ctx;
      if (!userRig) return;

      controllers.forEach(({ controller, grip }) => {
        userRig.add(controller);
        userRig.add(grip);
      });
    },

    reset() {
      heldObjects.forEach((obj, controller) => {
        if (!obj) return;

        controller.remove(obj);
      });
      heldObjects.clear();
      activeContext = null;
    },
  };
}

function onSelect(controller) {
  if (!activeContext) return;
  if (activeContext.panelHitboxes?.length) {
    const hit = raycastPanel(controller, activeContext.panelHitboxes);
    if (hit?.userData?.mode) {
      window.setGameMode(hit.userData.mode);
      return;
    }
  }

  const held = heldObjects.get(controller);
  if (!held) return;

  if (held.userData?.isFlashlight) {
    held.userData.toggle();
    return;
  }

  if (held.userData?.isGun) {
    shoot(activeContext.bullets, activeContext.scene, controller);
  }
}

function onSqueeze(controller) {
  if (!activeContext) return;

  if (heldObjects.has(controller)) {
    dropObject(controller, activeContext.scene);
    return;
  }

  tryGrab(controller, activeContext.shotGun, {
    offset: new THREE.Vector3(0, -0.05, -0.3),
    rotation: new THREE.Euler(0, Math.PI * 2.5, 0),
    tag: 'isGun',
  });

  tryGrab(controller, activeContext.flashlight, {
    offset: new THREE.Vector3(0, -0.05, -0.25),
    tag: 'isFlashlight',
  });

  tryGrab(controller, activeContext.can, {
    offset: new THREE.Vector3(0.05, -0.05, -0.25),
  });
}

function tryGrab(controller, obj, options) {
  if (!obj || heldObjects.has(controller)) return;

  const handPos = new THREE.Vector3();
  controller.getWorldPosition(handPos);

  if (handPos.distanceTo(obj.position) > GRAB_DISTANCE) return;

  heldObjects.set(controller, obj);
  controller.add(obj);

  obj.position.copy(options.offset);
  if (options.rotation) obj.rotation.copy(options.rotation);
  if (options.tag) obj.userData[options.tag] = true;
}

function dropObject(controller, scene) {
  const obj = heldObjects.get(controller);
  if (!obj) return;

  controller.remove(obj);
  scene.add(obj);
  obj.position.setFromMatrixPosition(controller.matrixWorld);

  heldObjects.delete(controller);
}

function shoot(bullets, scene, controller) {
  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.05),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );

  bullet.position.setFromMatrixPosition(controller.matrixWorld);
  bullet.userData.velocity = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(controller.quaternion)
    .multiplyScalar(0.6);

  bullets.push(bullet);
  scene.add(bullet);
}

function raycastPanel(controller, hitboxes) {
  const origin = new THREE.Vector3();
  controller.getWorldPosition(origin);

  const direction = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(controller.quaternion)
    .normalize();

  const raycaster = new THREE.Raycaster(origin, direction);
  const hits = raycaster.intersectObjects(hitboxes, false);

  return hits[0]?.object ?? null;
}

export function handleMovement(renderer, camera, userRig) {
  const session = renderer.xr.getSession();
  if (!session) return;

  const src = Array.from(session.inputSources).find(
    (s) => s.handedness === 'left' && s.gamepad
  );
  if (!src) return;

  const [x, y] = src.gamepad.axes.slice(2, 4);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();

  const right = new THREE.Vector3().crossVectors(
    dir,
    new THREE.Vector3(0, 1, 0)
  );
  userRig.position.addScaledVector(dir, -y * MOVE_SPEED);
  userRig.position.addScaledVector(right, x * MOVE_SPEED);
}
