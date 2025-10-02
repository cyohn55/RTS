import { useGLTF } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { AnimalId } from '../game/types';
import * as THREE from 'three';

const ANIMAL_FILE_MAP: Record<AnimalId, string> = {
  Bee: 'Bee.glb',
  Bear: 'Bear.glb',
  Bunny: 'Bunny.glb',
  Chicken: 'Chicken.glb',
  Cat: 'cat.glb',
  Dolphin: 'dolphin.glb',
  Fox: 'Fox.glb',
  Frog: 'Frog.glb',
  Owl: 'Owl.glb',
  Pig: 'Pig.glb',
  Turtle: 'Turtle.glb',
  Yetti: 'Yeti.glb',
};

// Preload all animal models at module level
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

// Preload each animal model immediately
Object.values(ANIMAL_FILE_MAP).forEach(filename => {
  useGLTF.preload(`/models/${filename}`, loader);
});

// Get preloaded model with optimized cloning
export function usePreloadedModel(animal: AnimalId) {
  if (!animal || !ANIMAL_FILE_MAP[animal]) {
    console.error(`❌ Invalid animal ID: "${animal}". Available animals:`, Object.keys(ANIMAL_FILE_MAP));
    throw new Error(`Invalid animal ID: ${animal}`);
  }
  const path = `/models/${ANIMAL_FILE_MAP[animal]}`;
  return useGLTF(path);
}

// Create optimized prepared scene with caching
const preparedScenesCache = new Map<string, THREE.Object3D>();

export function createPreparedScene(gltf: any, animal: AnimalId, unitKind: 'Unit' | 'Queen' | 'King' | 'Base') {
  const cacheKey = `${animal}-${unitKind}`;

  // Return cached scene if available
  if (preparedScenesCache.has(cacheKey)) {
    return preparedScenesCache.get(cacheKey)!.clone(true);
  }

  if (!gltf?.scene) return null;

  const scene = gltf.scene.clone(true);

  // Configure shadows
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  // Calculate and apply scaling
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  let target = unitKind === 'King' ? 6.0 : unitKind === 'Queen' ? 5.0 : 3.0;
  if (animal === 'Yetti') {
    target *= 2.0; // Double the size for Yetti
  }

  const scale = target / maxDim;
  scene.scale.setScalar(scale);

  const center = new THREE.Vector3();
  box.getCenter(center);
  // Recenter to ground plane
  scene.position.set(-center.x * scale, -(box.min.y) * scale, -center.z * scale);

  // Flip Bunny and Yetti models 180 degrees around Y-axis
  if (animal === 'Bunny' || animal === 'Yetti') {
    scene.rotation.y = Math.PI;
  }

  // Cache the prepared scene
  preparedScenesCache.set(cacheKey, scene);

  return scene.clone(true);
}

// Preload component to be used in App.tsx
export function ModelPreloader() {
  // Models are already preloaded at module level
  return null;
}