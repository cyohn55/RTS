import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useGameStore } from '../game/state';
import { UnitsLayer } from './UnitsLayer';
import { MapInteraction } from './HexInteraction';
import { performanceMonitor } from '../utils/PerformanceMonitor';
import { interpolationHelper } from '../utils/InterpolationHelper';
import * as THREE from 'three';

export function BattleMap() {
  const tick = useGameStore((s) => s.tick);
  const bridgeState = useGameStore((s) => s.bridgeState);
  const { scene } = useGLTF('/models/Battle_Map_compressed.glb');
  const skyboxRef = useRef<THREE.Object3D | null>(null);
  const largestObjectRef = useRef<THREE.Object3D | null>(null);

  // Bridge refs for storing references to bridge objects
  const rightBridgeRefs = useRef<Record<string, THREE.Object3D | null>>({
    Fully_Up: null,
    Almost_Up: null,
    Almost_Down: null,
    Fully_Down: null
  });
  const leftBridgeRefs = useRef<Record<string, THREE.Object3D | null>>({
    Fully_Up: null,
    Almost_Up: null,
    Almost_Down: null,
    Fully_Down: null
  });

  // Process the battle map without centering
  const battleMapScene = useMemo(() => {
    if (!scene) {
      console.log('❌ Battle map scene not loaded yet');
      return null;
    }

    console.log('✅ Battle map scene loaded, processing...');
    // Clone the entire scene to avoid modifying the original
    const clonedScene = scene.clone();

    // Find and store reference to skybox for rotation
    let largestSphere = null;
    let largestSphereSize = 0;
    const allObjects = [];

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.receiveShadow = true;
        child.castShadow = true;

        // Track all objects for debugging
        allObjects.push({
          name: child.name || 'unnamed',
          type: child.type,
          geometry: child.geometry?.type || 'unknown',
          position: child.position,
          scale: child.scale,
          boundingBox: child.geometry?.boundingBox
        });

        // Check for any sphere geometry and track for potential skybox
        if (child.geometry instanceof THREE.SphereGeometry) {
          const sphereSize = Math.max(child.scale.x, child.scale.y, child.scale.z) * child.geometry.parameters.radius;
          console.log('Found sphere:', child.name || 'unnamed', 'Size:', sphereSize, 'Scale:', child.scale);

          if (sphereSize > 500 && sphereSize > largestSphereSize) {
            largestSphereSize = sphereSize;
            largestSphere = child;
            console.log('✓ This sphere is large enough to be skybox:', sphereSize);
          } else if (sphereSize <= 500) {
            console.log('✗ Sphere too small for skybox, keeping visible:', sphereSize);
          }
        }

        // Also check material properties - disable any mesh with gradient/skybox-like materials
        if (child.material) {
          const material = Array.isArray(child.material) ? child.material[0] : child.material;

          // Check for common skybox material names
          if (material.name && (
            material.name.toLowerCase().includes('sky') ||
            material.name.toLowerCase().includes('gradient') ||
            material.name.toLowerCase().includes('background') ||
            material.name.toLowerCase().includes('dome')
          )) {
            console.log('✓ Disabling mesh with skybox-like material:', child.name || 'unnamed', 'Material:', material.name);
            child.visible = false;
          }
        }

        // Also check for very large objects that might be the skybox
        if (child.geometry?.boundingBox) {
          child.geometry.computeBoundingBox();
          const box = child.geometry.boundingBox;
          if (box) {
            const size = box.max.distanceTo(box.min);
            if (size > 500) { // Very large objects likely to be skybox
              console.log('Found large object:', child.name || 'unnamed', 'Size:', size);
            }
          }
        }
      }

      // Check for potential skybox objects by name
      if (child.name) {
        // Look for bridge objects by name
        if (child.name.toLowerCase().includes('bridge')) {
          console.log('Found bridge-related object:', child.name, 'Type:', child.type);
        }

        // Right bridge objects
        if (child.name === 'Right_Bridge_Fully_Up') {
          rightBridgeRefs.current.Fully_Up = child;
          console.log('✓ Found Right_Bridge_Fully_Up');
        } else if (child.name === 'Right_Bridge_Almost_Up') {
          rightBridgeRefs.current.Almost_Up = child;
          console.log('✓ Found Right_Bridge_Almost_Up');
        } else if (child.name === 'Right_Bridge_Almost_Down') {
          rightBridgeRefs.current.Almost_Down = child;
          console.log('✓ Found Right_Bridge_Almost_Down');
        } else if (child.name === 'Right_Bridge_Fully_Down') {
          rightBridgeRefs.current.Fully_Down = child;
          console.log('✓ Found Right_Bridge_Fully_Down');
        }
        // Left bridge objects
        else if (child.name === 'Left_Bridge_Fully_Up') {
          leftBridgeRefs.current.Fully_Up = child;
          console.log('✓ Found Left_Bridge_Fully_Up');
        } else if (child.name === 'Left_Bridge_Almost_Up') {
          leftBridgeRefs.current.Almost_Up = child;
          console.log('✓ Found Left_Bridge_Almost_Up');
        } else if (child.name === 'Left_Bridge_Almost_Down') {
          leftBridgeRefs.current.Almost_Down = child;
          console.log('✓ Found Left_Bridge_Almost_Down');
        } else if (child.name === 'Left_Bridge_Fully_Down') {
          leftBridgeRefs.current.Fully_Down = child;
          console.log('✓ Found Left_Bridge_Fully_Down');
        }

        if (child.name === 'Sketchfab_model' ||
            child.name.toLowerCase().includes('sketchfab') ||
            child.name.toLowerCase().includes('sky') ||
            child.name.toLowerCase().includes('sphere') ||
            child.name.toLowerCase().includes('dome') ||
            child.name.toLowerCase().includes('background') ||
            child.name.includes('aecf6c83116841f78c8f1a5d689d1bba')) {
          skyboxRef.current = child;
          console.log('✓ Found skybox by name:', child.name, 'Type:', child.type);
        }
      }
    });

    // Log all objects for debugging
    console.log('All objects in scene:', allObjects);

    // Use the largest sphere as skybox if no named skybox found, but only if it's large enough
    if (!skyboxRef.current && largestSphere && largestSphereSize > 500) {
      skyboxRef.current = largestSphere;
      console.log('✓ Using largest sphere as skybox:', largestSphere.name || 'unnamed', 'Size:', largestSphereSize);
    } else if (largestSphere && largestSphereSize <= 500) {
      console.log('✗ Largest sphere too small for skybox, not using:', largestSphere.name || 'unnamed', 'Size:', largestSphereSize);
    }

    // Final check - make sure we only rotate truly large objects
    if (skyboxRef.current) {
      let shouldRotate = false;
      if (skyboxRef.current instanceof THREE.Mesh && skyboxRef.current.geometry instanceof THREE.SphereGeometry) {
        const size = Math.max(skyboxRef.current.scale.x, skyboxRef.current.scale.y, skyboxRef.current.scale.z) * skyboxRef.current.geometry.parameters.radius;
        shouldRotate = size > 500;
        console.log('Final skybox check - Size:', size, 'Will rotate:', shouldRotate);
      }

      if (!shouldRotate) {
        console.log('Skybox object is too small, disabling rotation');
        skyboxRef.current = null;
      }
    }

    // Keep the battle map at its original position - don't center it
    // This ensures base coordinates align with terrain features

    return clonedScene;
  }, [scene]);

  const last = useRef(performance.now());
  const accumulator = useRef(0);
  const GAME_LOGIC_FPS = 60; // Full 60 FPS game logic for maximum smoothness
  const FIXED_TIMESTEP = 1000 / GAME_LOGIC_FPS;

  useFrame((state, delta) => {
    const frameStart = performance.now();
    const now = frameStart;
    const frameTime = Math.min(now - last.current, 250); // Cap at 250ms to prevent spiral of death
    last.current = now;
    accumulator.current += frameTime;

    // Rotate skybox slowly around x-axis
    if (skyboxRef.current) {
      const rotationSpeed = 0.025; // Even slower, more subtle rotation for skybox
      const oldRotation = skyboxRef.current.rotation.x;
      skyboxRef.current.rotation.x += rotationSpeed * delta;

      // Log every frame for a few seconds to ensure rotation is happening
      if (now < 10000) { // First 10 seconds
        console.log('Rotating skybox:', oldRotation.toFixed(3), '->', skyboxRef.current.rotation.x.toFixed(3), 'Delta:', (rotationSpeed * delta).toFixed(4));
      }

      // Log rotation every few seconds to verify it's working
      if (Math.floor(now / 2000) !== Math.floor((now - frameTime) / 2000)) {
        console.log('Skybox rotation status:', skyboxRef.current.rotation.x.toFixed(3), 'Object:', skyboxRef.current.name || 'unnamed', 'Type:', skyboxRef.current.type);
      }
    } else {
      // Search for skybox every frame until found
      if (battleMapScene) {
        battleMapScene.traverse((child) => {
          // Look for skybox by specific name first
          if (child.name && child.name.includes('aecf6c83116841f78c8f1a5d689d1bba') && !skyboxRef.current) {
            skyboxRef.current = child;
            console.log('Found skybox by specific name during runtime:', child.name);
            return;
          }

          // Look for very large spheres only (skybox should be much larger than 500)
          if (child instanceof THREE.Mesh && !skyboxRef.current) {
            if (child.geometry instanceof THREE.SphereGeometry) {
              const size = Math.max(child.scale.x, child.scale.y, child.scale.z) * child.geometry.parameters.radius;
              if (size > 500) { // Only very large spheres for skybox
                skyboxRef.current = child;
                console.log('Found large sphere during runtime:', child.name || 'unnamed', 'Size:', size);
              }
            }
          }
        });

        if (!skyboxRef.current && now < 5000) { // Keep looking for first 5 seconds
          console.log('Still searching for skybox...');
        }
      }
    }

    // Measure game logic performance
    const gameLogicStart = performance.now();

    // SYNCHRONIZED: Game logic at 60 FPS matching rendering frequency
    let logicUpdated = false;
    while (accumulator.current >= FIXED_TIMESTEP) {
      tick(FIXED_TIMESTEP / 1000, now);
      accumulator.current -= FIXED_TIMESTEP;
      logicUpdated = true;
    }

    // Update interpolation positions when game logic runs
    if (logicUpdated) {
      const units = useGameStore.getState().units;
      const positions: Record<string, any> = {};
      units.forEach(unit => {
        positions[unit.id] = unit.position;
      });
      interpolationHelper.updatePositions(positions);
    }


    // Update bridge visibility based on game state
    updateBridgeVisibility();

    // Rendering can now exceed game logic frequency for smoother visuals

    const gameLogicTime = performance.now() - gameLogicStart;
    const renderTime = performance.now() - frameStart - gameLogicTime;

    // Update FPS monitoring
    const currentFPS = performanceMonitor.updateFPS();

    // Log performance every 2 seconds
    if (Math.floor(now / 2000) !== Math.floor((now - frameTime) / 2000)) {
      console.log(`Performance Report:
      Current FPS: ${currentFPS.toFixed(1)}
      Average FPS: ${performanceMonitor.getAverageFPS().toFixed(1)}
      Min FPS: ${performanceMonitor.getMinFPS().toFixed(1)}
      Max FPS: ${performanceMonitor.getMaxFPS().toFixed(1)}
      Game Logic: ${gameLogicTime.toFixed(2)}ms
      Render Time: ${renderTime.toFixed(2)}ms`);
    }
  });

  // Function to update bridge visibility based on game state
  const updateBridgeVisibility = () => {
    // Update right bridge visibility
    const rightFrame = bridgeState.rightBridge.currentFrame;
    Object.entries(rightBridgeRefs.current).forEach(([frameName, bridgeObj]) => {
      if (bridgeObj) {
        const shouldBeVisible = frameName === rightFrame;
        if (bridgeObj.visible !== shouldBeVisible) {
          bridgeObj.visible = shouldBeVisible;
          if (shouldBeVisible) {
            console.log(`Right bridge: Showing ${frameName}`);
          }
        }
      }
    });

    // Update left bridge visibility
    const leftFrame = bridgeState.leftBridge.currentFrame;
    Object.entries(leftBridgeRefs.current).forEach(([frameName, bridgeObj]) => {
      if (bridgeObj) {
        const shouldBeVisible = frameName === leftFrame;
        if (bridgeObj.visible !== shouldBeVisible) {
          bridgeObj.visible = shouldBeVisible;
          if (shouldBeVisible) {
            console.log(`Left bridge: Showing ${frameName}`);
          }
        }
      }
    });
  };


  return (
    <group>
      {/* Battle Map 3D Model */}
      {battleMapScene && <primitive object={battleMapScene} />}

      {/* Units Layer with Instanced Rendering and LOD */}
      <UnitsLayer />

      {/* Interaction Layer - Re-enabled with context menu fix */}
      <MapInteraction />
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/Battle_Map_compressed.glb');


