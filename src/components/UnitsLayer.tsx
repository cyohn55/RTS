import { Suspense, useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../game/state';
import type { AnimalId, Unit } from '../game/types';
import { usePreloadedModel, createPreparedScene } from '../utils/ModelPreloader';
import { vector3Pool, matrix4Pool, frustumPool } from '../utils/ObjectPool';
import * as THREE from 'three';

// Shared selection ring geometries and materials (created once, reused for all units)
const SELECTION_RING_OUTER_GEO = new THREE.RingGeometry(0.9, 1.5, 16);
const SELECTION_RING_INNER_GEO = new THREE.RingGeometry(1.0, 1.4, 16);
const OWNER_RING_GEO = new THREE.RingGeometry(0.7, 1.0, 16);

const SELECTION_RING_OUTER_MAT = new THREE.MeshStandardMaterial({
  color: "#000080",
  transparent: true,
  opacity: 0.4,
  emissive: "#000080",
  emissiveIntensity: 2.0,
  toneMapped: false,
});

const SELECTION_RING_INNER_MAT = new THREE.MeshStandardMaterial({
  color: "#000080",
  transparent: true,
  opacity: 0.8,
  emissive: "#000080",
  emissiveIntensity: 3.0,
  toneMapped: false,
});

const OWNER_RING_MAT = new THREE.MeshBasicMaterial({
  color: "#4169E1",
});

// Optimized frustum culling using object pooling
function isUnitInView(unit: Unit, camera: THREE.Camera): boolean {
  const matrix = matrix4Pool.acquire();
  const frustum = frustumPool.acquire();
  const vector = vector3Pool.acquire();

  try {
    matrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    vector.set(unit.position.x, unit.position.y, unit.position.z);
    return frustum.containsPoint(vector);
  } finally {
    matrix4Pool.release(matrix);
    frustumPool.release(frustum);
    vector3Pool.release(vector);
  }
}

function BaseMarker({ x, y, z }: { x: number; y: number; z: number }) {
  const tileSize = 2; // Fixed size for bases
  return (
    <group position={[x, y + 0.4, z]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[tileSize * 0.9, tileSize * 0.9, 0.8, 6]} />
        <meshStandardMaterial color="#06d6a0" />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#15a37a" />
      </mesh>
    </group>
  );
}

function UnitModel({ unit }: { unit: Unit }) {
  const gltf = usePreloadedModel(unit.animal);
  const { x, y, z } = unit.position;

  // Calculate hop offset for Frog and Bunny units
  const yOffset = (unit.animal === 'Frog' || unit.animal === 'Bunny') && unit.isHopping
    ? Math.sin((unit.hopPhase || 0) * Math.PI) * 1.5
    : 0;

  const selectedUnitIds = useGameStore((s) => s.selectedUnitIds);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const selectUnits = useGameStore((s) => s.selectUnits);
  const addToSelection = useGameStore((s) => s.addToSelection);
  const { camera } = useThree();

  // Distance-based shadow optimization
  const distanceFromCamera = useMemo(() => {
    const cameraPos = camera.position;
    const unitPos = new THREE.Vector3(x, y, z);
    return cameraPos.distanceTo(unitPos);
  }, [x, y, z, camera.position]);

  const shouldCastShadows = distanceFromCamera < 80; // Increased shadow distance for better quality
  const shouldReceiveShadows = distanceFromCamera < 120; // More units receive shadows

  const isSelected = selectedUnitIds.includes(unit.id);
  const isOwnUnit = unit.ownerId === localPlayerId;

  if (unit.kind === 'Base') {
    return <BaseMarker x={x} y={y} z={z} />;
  }

  const preparedScene = useMemo(() => {
    return createPreparedScene(gltf, unit.animal, unit.kind);
  }, [gltf, unit.animal, unit.kind]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!isOwnUnit) return;

    if (e.shiftKey) {
      addToSelection([unit.id]);
    } else {
      selectUnits([unit.id]);
    }
  };

  if (!preparedScene) {
    // Fallback placeholder if model fails to prepare
    const color = unit.kind === 'King' ? '#ffd166' : unit.kind === 'Queen' ? '#ef476f' : '#8ecae6';
    // Double the size for Yetti fallback sphere
    const sphereRadius = unit.animal === 'Yetti' ? 1.2 : 0.6;
    return (
      <group position={[x, y + yOffset, z]} rotation={[0, unit.rotation, 0]}>
        <mesh position={[0, 0.6, 0]} castShadow onClick={handleClick}>
          <sphereGeometry args={[sphereRadius, 16, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {isSelected && (
          <>
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SELECTION_RING_OUTER_GEO} material={SELECTION_RING_OUTER_MAT} />
            <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SELECTION_RING_INNER_GEO} material={SELECTION_RING_INNER_MAT} />
          </>
        )}
      </group>
    );
  }

  return (
    <group position={[x, y + yOffset, z]} rotation={[0, unit.rotation, 0]} castShadow={shouldCastShadows} receiveShadow={shouldReceiveShadows} onClick={handleClick}>
      <primitive object={preparedScene} />
      {isSelected && (
        <>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SELECTION_RING_OUTER_GEO} material={SELECTION_RING_OUTER_MAT} />
          <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SELECTION_RING_INNER_GEO} material={SELECTION_RING_INNER_MAT} />
        </>
      )}
      {isOwnUnit && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={OWNER_RING_GEO} material={OWNER_RING_MAT} />
      )}
    </group>
  );
}

export function UnitsLayer() {
  const units = useGameStore((s) => s.units);
  const { camera } = useThree();

  // Debug: Log unit count
  useEffect(() => {
    console.log(`🎯 UnitsLayer rendering ${units.length} units`);
    if (units.length > 0) {
      console.log('Sample units:', units.slice(0, 3).map(u => ({ animal: u.animal, kind: u.kind, pos: u.position })));
    }
  }, [units.length]);

  // Apply frustum culling to only render visible units
  // Only update when units array changes significantly or camera moves substantially
  const visibleUnits = useMemo(() => {
    // Skip culling if too few units (overhead not worth it)
    if (units.length < 50) return units;
    return units.filter(unit => isUnitInView(unit, camera));
  }, [units, camera.position, camera.rotation]);

  function FallbackUnit({ unit }: { unit: Unit }) {
    const { x, y, z } = unit.position;
    const color = unit.kind === 'King' ? '#ffd166' : unit.kind === 'Queen' ? '#ef476f' : '#8ecae6';
    return (
      <mesh position={[x, y + 0.6, z]} castShadow>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }

  return (
    <group>
      {visibleUnits.map((u) => (
        <Suspense key={u.id} fallback={<FallbackUnit unit={u} />}>
          <UnitModel unit={u} />
        </Suspense>
      ))}
    </group>
  );
}