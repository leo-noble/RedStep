/* GPU texture baking: render an equirect fragment shader once into a mipmapped target. */
import * as THREE from 'three';
import { BAKE_VERTEX } from './shaders.js';

export function bake(renderer, fragmentShader, width, height, uniforms = {}) {
  const rt = new THREE.WebGLRenderTarget(width, height, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
  });
  rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERTEX,
    fragmentShader,
    uniforms: { uSeed: { value: 3.7 }, ...uniforms },
    depthTest: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(quad);
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
  quad.geometry.dispose();
  mat.dispose();
  return rt;
}

