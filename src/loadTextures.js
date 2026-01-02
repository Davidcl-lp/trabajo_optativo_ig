import { TextureLoader } from 'three';
const loader = new TextureLoader();
export function loadTexture(path) {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (texture) => resolve(texture),
      undefined,
      (err) => reject(err)
    );
  });
}
