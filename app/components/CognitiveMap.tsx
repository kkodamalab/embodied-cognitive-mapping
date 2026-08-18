"use client";

import { Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";

type Concept = {
  id: string;
  name: string;
  position: [number, number, number];
  size: number;
  color: string;
  category: string;
};

const concepts: Concept[] = [
  { id: "cognitivism", name: "Cognitivism", position: [-5.2, 3.1, 2.4], size: 0.66, color: "#d98c72", category: "Classical" },
  { id: "embodied", name: "Embodied Cognition", position: [-0.6, 0.7, 0.8], size: 0.9, color: "#dfb45c", category: "Embodied" },
  { id: "embedded", name: "Embedded Cognition", position: [1.9, -0.2, 2.2], size: 0.7, color: "#8fb89b", category: "Situated" },
  { id: "extended", name: "Extended Mind", position: [4.7, 1.4, 1.1], size: 0.78, color: "#72a9a8", category: "Situated" },
  { id: "enactivism", name: "Enactivism", position: [2.8, -2.2, -0.8], size: 0.82, color: "#8f9fcb", category: "Enactive" },
  { id: "ecological", name: "Ecological Psychology", position: [5.4, -3.1, 2.9], size: 0.86, color: "#83ae79", category: "Ecological" },
  { id: "predictive", name: "Predictive Processing", position: [-2.8, 2.4, -1.3], size: 0.82, color: "#b18bb4", category: "Computational" },
  { id: "free-energy", name: "Free Energy Principle", position: [-1.1, 4.4, -3.1], size: 0.75, color: "#9a88bd", category: "Computational" },
  { id: "active-inference", name: "Active Inference", position: [0.8, 2.6, -2.2], size: 0.7, color: "#a08bc5", category: "Computational" },
  { id: "radical", name: "Radical Embodied Cognitive Science", position: [4.1, -4.2, -2.1], size: 0.92, color: "#6ca09a", category: "Radical" },
];

const axisLabels = {
  x: "Reductionist  ←  Systemic / Self-organizing",
  y: "Situated / Sensorimotor  ←  Abstract / Decoupled",
  z: "Individual  ←  Body  ←  Environment  ←  Social / Cultural",
};

function AxisLabel({ position, label, tone }: { position: [number, number, number]; label: string; tone: string }) {
  return (
    <Html position={position} center distanceFactor={13} style={{ pointerEvents: "none" }}>
      <span className="axis-label" style={{ color: tone }}>{label}</span>
    </Html>
  );
}

function ConceptSphere({ concept, selected, onSelect }: { concept: Concept; selected: boolean; onSelect: () => void }) {
  return (
    <group position={concept.position}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[concept.size, 40, 40]} />
        <meshStandardMaterial
          color={concept.color}
          emissive={selected ? concept.color : "#000000"}
          emissiveIntensity={selected ? 0.55 : 0}
          roughness={0.42}
          metalness={0.08}
        />
      </mesh>
      {selected && (
        <mesh scale={1.09}>
          <sphereGeometry args={[concept.size, 32, 32]} />
          <meshBasicMaterial color="#f7f3e8" wireframe transparent opacity={0.72} />
        </mesh>
      )}
      <Html position={[0, concept.size + 0.35, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <span className={`concept-label${selected ? " selected" : ""}`}>{concept.name}</span>
      </Html>
    </group>
  );
}

function MappingScene({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <>
      <color attach="background" args={["#101916"]} />
      <fog attach="fog" args={["#101916", 18, 36]} />
      <PerspectiveCamera makeDefault position={[12, 10, 14]} fov={45} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[8, 12, 10]} intensity={2.2} color="#fff8e7" />
      <directionalLight position={[-8, 3, -6]} intensity={0.8} color="#b8d8cb" />

      <gridHelper args={[24, 24, "#446158", "#263b35"]} position={[0, -5.5, 0]} />
      <axesHelper args={[7]} />
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshBasicMaterial color="#f0eadc" />
      </mesh>

      <AxisLabel position={[7.7, 0, 0]} label={`X  ·  ${axisLabels.x}`} tone="#e58c7a" />
      <AxisLabel position={[0, 7.7, 0]} label={`Y  ·  ${axisLabels.y}`} tone="#8ebc88" />
      <AxisLabel position={[0, 0, 7.7]} label={`Z  ·  ${axisLabels.z}`} tone="#7ea9d6" />
      <AxisLabel position={[0, -0.45, 0]} label="ORIGIN" tone="#ded8ca" />

      {concepts.map((concept) => (
        <ConceptSphere
          key={concept.id}
          concept={concept}
          selected={concept.id === selectedId}
          onSelect={() => onSelect(concept.id)}
        />
      ))}

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={7} maxDistance={32} target={[0, 0, 0]} />
    </>
  );
}

export function CognitiveMap() {
  const [selectedId, setSelectedId] = useState("embodied");
  const selected = concepts.find((concept) => concept.id === selectedId) ?? null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">ECM</span>
          <div>
            <h1>Embodied Cognitive Mapping</h1>
            <p>Interactive multidimensional mapping of cognitive theories</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="view-name">Default View</span>
          <button type="button" className="quiet-button" disabled>Share room</button>
        </div>
      </header>

      <section className="workspace">
        <div className="viewport" aria-label="Interactive three-dimensional concept map">
          <div className="viewport-meta">
            <span className="eyebrow">Conceptual space</span>
            <span className="object-count">10 objects</span>
          </div>
          <Canvas dpr={[1, 1.75]} gl={{ antialias: true }} onPointerMissed={() => setSelectedId("")}>
            <MappingScene selectedId={selectedId} onSelect={setSelectedId} />
          </Canvas>
          <div className="control-hint">
            <span><b>Drag</b> rotate</span>
            <span><b>Scroll</b> zoom</span>
            <span><b>Right drag</b> pan</span>
          </div>
        </div>

        <aside className="inspector">
          <div className="inspector-head">
            <span className="eyebrow">Selected object</span>
            <span className="phase-badge">Phase 1</span>
          </div>
          {selected ? (
            <>
              <div className="selection-title">
                <span className="color-chip" style={{ backgroundColor: selected.color }} />
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.category}</p>
                </div>
              </div>
              <div className="coordinate-grid">
                {(["X", "Y", "Z"] as const).map((axis, index) => (
                  <div key={axis}>
                    <span>{axis}</span>
                    <strong>{selected.position[index].toFixed(1)}</strong>
                  </div>
                ))}
              </div>
              <div className="info-card">
                <span className="eyebrow">Spatial reading</span>
                <p>This provisional position is part of the map, not a claim of theoretical correctness.</p>
              </div>
            </>
          ) : (
            <div className="empty-selection">
              <span className="empty-orbit" />
              <h2>No object selected</h2>
              <p>Select a sphere in the map to inspect its current position.</p>
            </div>
          )}
          <div className="phase-note">
            <span>Next</span>
            <p>Direct manipulation and field editing arrive in Phase 2.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
