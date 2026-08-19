"use client";

import { Html, Line, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Plane, Vector3, type Group } from "three";
import { supabase } from "../lib/supabase";

type Concept = {
  id: string;
  name: string;
  description: string;
  category: string;
  references: string[];
  thinkers?: Thinker[];
};
type Thinker = { id: string; name: string; years?: string; imageUrl?: string; imageCredit?: string; coreMessage: string; role?: string; references?: string[] };
type ComparisonDimension = { id: string; label: string; sourceValue?: string; targetValue?: string; relation?: "same" | "similar" | "different" | "debated" | "unknown"; note?: string };
type Connection = { id: string; sourceConceptId: string; targetConceptId: string; relationType: "similarity" | "difference" | "influence" | "criticism" | "historical" | "compatibility" | "other"; label: string; description?: string; dimensions: ComparisonDimension[]; lineStyle?: "solid" | "dashed" | "dotted"; color?: string; opacity?: number; createdAt: string; updatedAt: string };
type LayerDefinition = { id: string; name: string; description?: string; visible: boolean; opacity?: number; order: number };

type ViewObject = {
  id: string;
  conceptId: string;
  x: number;
  y: number;
  z: number;
  size: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  color: string;
  opacity: number;
  shapeType: "sphere";
  categoryId?: string;
  colorId?: string;
  customColor?: string;
  layerId?: string;
};

type MapObject = Concept & ViewObject;
type PlaneView = "3d" | "xy" | "yz" | "xz";
type AxisLabels = {
  xNegative: string; xPositive: string;
  yNegative: string; yPositive: string;
  zNegative: string; zPositive: string;
};
type LegacyAxisLabels = Partial<AxisLabels> & { x?: string; y?: string; z?: string };
type PaletteColor = { id: string; name: string; hex: string };
type CategoryDefinition = { id: string; name: string; defaultColorId: string };
type MapView = {
  id: string;
  roomId: string;
  name: string;
  ownerName: string;
  readOnly: boolean;
  axisLabels: AxisLabels;
  camera: [number, number, number];
  objects: MapObject[];
  connections: Connection[];
  layers: LayerDefinition[];
  palette: PaletteColor[];
  categories: CategoryDefinition[];
  createdAt: string;
  updatedAt: string;
};
type UndoSnapshot = { viewId: string; view: MapView };

const initialObjects: MapObject[] = [
  ["cognitivism", "Cognitivism", -5.2, 3.1, 2.4, 0.66, "#d98c72", "Classical"],
  ["embodied", "Embodied Cognition", -0.6, 0.7, 0.8, 0.9, "#dfb45c", "Embodied"],
  ["embedded", "Embedded Cognition", 1.9, -0.2, 2.2, 0.7, "#8fb89b", "Situated"],
  ["extended", "Extended Mind", 4.7, 1.4, 1.1, 0.78, "#72a9a8", "Situated"],
  ["enactivism", "Enactivism", 2.8, -2.2, -0.8, 0.82, "#8f9fcb", "Enactive"],
  ["ecological", "Ecological Psychology", 5.4, -3.1, 2.9, 0.86, "#83ae79", "Ecological"],
  ["predictive", "Predictive Processing", -2.8, 2.4, -1.3, 0.82, "#b18bb4", "Computational"],
  ["free-energy", "Free Energy Principle", -1.1, 4.4, -3.1, 0.75, "#9a88bd", "Computational"],
  ["active-inference", "Active Inference", 0.8, 2.6, -2.2, 0.7, "#a08bc5", "Computational"],
  ["radical", "Radical Embodied Cognitive Science", 4.1, -4.2, -2.1, 0.92, "#6ca09a", "Radical"],
].map(([id, name, x, y, z, size, color, category]) => ({
  id: `${id}-placement`, conceptId: String(id), name: String(name),
  description: `${name} is positioned provisionally for discussion and may be freely reinterpreted.`,
  category: String(category), references: [], x: Number(x), y: Number(y), z: Number(z),
  size: Number(size), scaleX: 1, scaleY: 1, scaleZ: 1, color: String(color), opacity: 1, shapeType: "sphere" as const,
  categoryId: String(category).includes("Computational") ? "computational" : String(category).includes("Ecological") ? "ecological" : String(category).includes("Enactive") ? "enactive" : String(category).includes("Situated") ? "extended" : String(category).includes("Classical") ? "classical" : "embodied",
  colorId: undefined, customColor: String(color),
}));

const axisLabels: AxisLabels = {
  xNegative: "Reductionist", xPositive: "Systemic / Self-organizing",
  yNegative: "Situated / Sensorimotor", yPositive: "Abstract / Decoupled",
  zNegative: "Individual", zPositive: "Social / Cultural",
};

const splitLegacyAxis = (value: string | undefined, fallbackNegative: string, fallbackPositive: string) => {
  const parts = value?.split(/[←↔→]/).map((part) => part.trim()).filter(Boolean) ?? [];
  return { negative: parts[0] ?? fallbackNegative, positive: parts.at(-1) ?? fallbackPositive };
};

const normalizeAxisLabels = (labels: LegacyAxisLabels | undefined): AxisLabels => {
  const x = splitLegacyAxis(labels?.x, axisLabels.xNegative, axisLabels.xPositive);
  const y = splitLegacyAxis(labels?.y, axisLabels.yNegative, axisLabels.yPositive);
  const z = splitLegacyAxis(labels?.z, axisLabels.zNegative, axisLabels.zPositive);
  return {
    xNegative: labels?.xNegative ?? x.negative, xPositive: labels?.xPositive ?? x.positive,
    yNegative: labels?.yNegative ?? y.negative, yPositive: labels?.yPositive ?? y.positive,
    zNegative: labels?.zNegative ?? z.negative, zPositive: labels?.zPositive ?? z.positive,
  };
};

const normalizeViewAxisLabels = (view: MapView): MapView => ({ ...view, axisLabels: normalizeAxisLabels(view.axisLabels as LegacyAxisLabels) });

const defaultPalette: PaletteColor[] = [
  { id: "red", name: "Red", hex: "#e06c68" }, { id: "orange", name: "Orange", hex: "#df9562" },
  { id: "yellow", name: "Yellow", hex: "#dfbd63" }, { id: "green", name: "Green", hex: "#78ad72" },
  { id: "teal", name: "Teal", hex: "#62a89b" }, { id: "cyan", name: "Cyan", hex: "#68b8c4" },
  { id: "blue", name: "Blue", hex: "#709dcc" }, { id: "indigo", name: "Indigo", hex: "#7d83c6" },
  { id: "purple", name: "Purple", hex: "#a17cbd" }, { id: "pink", name: "Pink", hex: "#cf7fa5" },
  { id: "gray", name: "Gray", hex: "#8d9b95" }, { id: "white", name: "White", hex: "#e4e6df" },
];
const defaultCategories: CategoryDefinition[] = [
  { id: "classical", name: "Classical Cognitivism", defaultColorId: "orange" },
  { id: "embodied", name: "Embodied / Embedded", defaultColorId: "yellow" },
  { id: "extended", name: "Extended / Distributed", defaultColorId: "cyan" },
  { id: "enactive", name: "Enactive", defaultColorId: "purple" },
  { id: "ecological", name: "Ecological", defaultColorId: "green" },
  { id: "computational", name: "Predictive / Computational", defaultColorId: "pink" },
  { id: "other", name: "Other", defaultColorId: "gray" },
];
const defaultLayers: LayerDefinition[] = [
  { id: "theories", name: "Cognitive theories / approaches", description: "Conceptual and empirical approaches", visible: true, opacity: 1, order: 1 },
  { id: "formal", name: "Formal / computational frameworks", description: "Formal and computational frameworks", visible: true, opacity: 0.7, order: 2 },
  { id: "meta", name: "Mathematical / meta-theoretical frameworks", description: "Future mathematical and meta-theoretical approaches", visible: true, opacity: 0.45, order: 3 },
];
const thinkerSamples: Record<string, Thinker[]> = {
  cognitivism: [{ id: "newell", name: "Allen Newell", years: "1927–1992", role: "Representative cognitive scientist", coreMessage: "Demo core message — replace with reviewed academic content.", references: ["Newell & Simon, Human Problem Solving (1972)"] }],
  embodied: [{ id: "varela", name: "Francisco J. Varela", years: "1946–2001", role: "Cognitive scientist", coreMessage: "Demo core message — replace with reviewed academic content.", references: ["Varela, Thompson & Rosch, The Embodied Mind (1991)"] }],
  extended: [{ id: "clark", name: "Andy Clark", years: "1957–", role: "Philosopher of mind", coreMessage: "Demo core message — replace with reviewed academic content.", references: ["Clark & Chalmers, The Extended Mind (1998)"] }],
  enactivism: [{ id: "thompson", name: "Evan Thompson", years: "1962–", role: "Philosopher and cognitive scientist", coreMessage: "Demo core message — replace with reviewed academic content.", references: ["Thompson, Mind in Life (2007)"] }],
  ecological: [{ id: "gibson", name: "James J. Gibson", years: "1904–1979", role: "Psychologist", coreMessage: "Demo core message — replace with reviewed academic content.", references: ["Gibson, The Ecological Approach to Visual Perception (1979)"] }],
};
const defaultDimensions = ["Representation", "Computation", "Embodiment", "Environment", "Agent–environment coupling", "Direct perception", "Autopoiesis", "Predictive / generative model", "Social / cultural dimension"];
const normalizeView = (view: MapView): MapView => ({
  ...normalizeViewAxisLabels(view),
  layers: Array.isArray(view.layers) && view.layers.length ? view.layers : defaultLayers.map((layer) => ({ ...layer })),
  connections: Array.isArray(view.connections) ? view.connections : [],
  objects: view.objects.map((object) => ({ ...object, layerId: object.layerId ?? (object.categoryId === "computational" ? "formal" : "theories"), thinkers: object.thinkers ?? thinkerSamples[object.conceptId] })),
});

const createView = (id: string, name: string, ownerName: string, offset = 0, readOnly = false): MapView => ({
  id, roomId: "demo-room", name, ownerName, readOnly, axisLabels: { ...axisLabels }, camera: [12, 10, 14],
  objects: initialObjects.map((object, index) => ({ ...object, x: object.x + (index % 2 ? offset : -offset), z: object.z + offset * 0.5, layerId: object.categoryId === "computational" ? "formal" : "theories", thinkers: thinkerSamples[object.conceptId] })),
  connections: [], layers: defaultLayers.map((layer) => ({ ...layer })), palette: defaultPalette, categories: defaultCategories, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

const starterViews: MapView[] = [
  createView("default", "Default", "Shared baseline"),
  createView("kodama", "Kodama", "Kodama", 0.45),
  createView("ecological", "Ecological", "Researcher A", 0.9, true),
  createView("enactive", "Enactive", "Researcher B", -0.65, true),
];

function AxisLabel({ position, label, tone, editable, onSave }: { position: [number, number, number]; label: string; tone: string; editable: boolean; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const commit = () => { const value = draft.trim(); if (value && value !== label) onSave(value); setEditing(false); };
  return <Html position={position} center distanceFactor={13} style={{ pointerEvents: "auto" }}>
    {editing ? <input ref={inputRef} className="axis-inline-input" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(label); setEditing(false); } }} />
      : <span className={`axis-label${editable ? " editable" : ""}`} style={{ color: tone }} title={editable ? "Double-click to edit" : undefined} onDoubleClick={(e) => { e.stopPropagation(); if (editable) { setDraft(label); setEditing(true); } }}>{label}</span>}
  </Html>;
}

function ThinkerCard({ concept, onClose }: { concept: MapObject; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [more, setMore] = useState(false);
  const thinkers = concept.thinkers ?? [];
  const thinker = thinkers[index];
  if (!thinker) return <Html position={[0, concept.size + 1.2, 0]} center distanceFactor={10}><div className="thinker-card"><strong>{concept.name}</strong><p>Thinker information has not been added yet.</p><button onClick={onClose}>Close</button></div></Html>;
  return <Html position={[0, concept.size + 1.4, 0]} center distanceFactor={10} style={{ pointerEvents: "auto" }}><article className="thinker-card"><button className="card-close" onClick={onClose}>×</button><small>{concept.name}</small><div className="thinker-head">{thinker.imageUrl ? <img src={thinker.imageUrl} alt={thinker.name} /> : <span className="thinker-placeholder">{thinker.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>}<div><strong>{thinker.name}</strong><span>{thinker.years}</span><em>{thinker.role}</em></div></div><h4>Core Message</h4><p>{more ? thinker.coreMessage : thinker.coreMessage.slice(0, 180)}</p>{thinker.references?.length ? <><h4>Key references</h4><ul>{thinker.references.slice(0, 3).map((reference) => <li key={reference}>{reference}</li>)}</ul></> : null}<div className="card-actions"><button disabled={thinkers.length < 2} onClick={() => setIndex((value) => (value - 1 + thinkers.length) % thinkers.length)}>‹</button><button disabled={thinkers.length < 2} onClick={() => setIndex((value) => (value + 1) % thinkers.length)}>›</button><button onClick={() => setMore((value) => !value)}>{more ? "Less" : "More"}</button><button onClick={onClose}>Close</button></div></article></Html>;
}

function ScaleHandle({ axis, position, color, onScale, onDragging }: { axis: "x" | "y" | "z"; position: [number, number, number]; color: string; onScale: (amount: number) => void; onDragging: (dragging: boolean) => void }) {
  const active = useRef(false);
  const lastX = useRef(0); const lastY = useRef(0);
  const begin = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); active.current = true; lastX.current = event.nativeEvent.clientX; lastY.current = event.nativeEvent.clientY; (event.target as Element).setPointerCapture(event.pointerId); onDragging(true); document.body.style.cursor = "ew-resize"; };
  const move = (event: ThreeEvent<PointerEvent>) => { if (!active.current) return; event.stopPropagation(); const delta = axis === "y" ? lastY.current - event.nativeEvent.clientY : event.nativeEvent.clientX - lastX.current; lastX.current = event.nativeEvent.clientX; lastY.current = event.nativeEvent.clientY; onScale(delta * 0.012); };
  const end = (event: ThreeEvent<PointerEvent>) => { if (!active.current) return; active.current = false; event.stopPropagation(); (event.target as Element).releasePointerCapture(event.pointerId); onDragging(false); document.body.style.cursor = "auto"; };
  return <group position={position}><mesh onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><sphereGeometry args={[0.2, 20, 20]} /><meshBasicMaterial color={color} /></mesh></group>;
}

function ObjectMesh({ object, selected, connectionSource, layerOpacity, thinkerOpen, onSelect, onOpenThinker, onTransform, onDragging }: {
  object: MapObject;
  selected: boolean;
  connectionSource: boolean;
  layerOpacity: number;
  thinkerOpen: boolean;
  onSelect: (additive: boolean) => void;
  onOpenThinker: () => void;
  onTransform: (patch: Partial<MapObject>) => void;
  onDragging: (dragging: boolean) => void;
}) {
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const dragging = useRef(false);
  const dragPlane = useRef(new Plane());
  const dragOffset = useRef(new Vector3());
  const dragPoint = useRef(new Vector3());
  const startClientX = useRef(0);
  const startClientY = useRef(0);
  const startZ = useRef(0);
  const moved = useRef(false);
  const pending = useRef(false);
  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey) return;
    event.stopPropagation(); moved.current = false; pending.current = true; startClientX.current = event.nativeEvent.clientX; startClientY.current = event.nativeEvent.clientY; startZ.current = object.z;
    const normal = camera.getWorldDirection(new Vector3());
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, new Vector3(object.x, object.y, object.z));
    event.ray.intersectPlane(dragPlane.current, dragPoint.current);
    dragOffset.current.copy(dragPoint.current).sub(new Vector3(object.x, object.y, object.z));
    (event.target as Element).setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!pending.current && !dragging.current) return;
    const delta = Math.hypot(event.nativeEvent.clientX - startClientX.current, event.nativeEvent.clientY - startClientY.current);
    if (!dragging.current && delta < 5) return;
    if (!dragging.current) { dragging.current = true; moved.current = true; onDragging(true); document.body.style.cursor = "grabbing"; }
    event.stopPropagation();
    if (event.nativeEvent.shiftKey) onTransform({ z: startZ.current + (startClientY.current - event.nativeEvent.clientY) * 0.025 });
    else if (event.ray.intersectPlane(dragPlane.current, dragPoint.current)) onTransform({ x: dragPoint.current.x - dragOffset.current.x, y: dragPoint.current.y - dragOffset.current.y, z: dragPoint.current.z - dragOffset.current.z });
  };
  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!pending.current && !dragging.current) return;
    pending.current = false; const wasDragging = dragging.current; dragging.current = false; if (wasDragging) onDragging(false); event.stopPropagation();
    (event.target as Element).releasePointerCapture(event.pointerId); document.body.style.cursor = "auto";
  };
  const body = (
    <group ref={group} position={[object.x, object.y, object.z]} scale={[object.scaleX, object.scaleY, object.scaleZ]}>
      <mesh onClick={(event) => { event.stopPropagation(); if (moved.current) { moved.current = false; return; } onSelect(event.nativeEvent.shiftKey); }} onDoubleClick={(event) => { event.stopPropagation(); if (!moved.current) onOpenThinker(); moved.current = false; }} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerOver={() => { document.body.style.cursor = "grab"; }} onPointerOut={() => { if (!dragging.current) document.body.style.cursor = "auto"; }} renderOrder={object.opacity * layerOpacity < 1 ? 2 : 0}>
        <sphereGeometry args={[object.size, 40, 40]} />
        <meshStandardMaterial
          color={object.color}
          emissive={selected ? object.color : "#000000"}
          emissiveIntensity={selected ? 0.38 : 0}
          roughness={0.42}
          metalness={0.08}
          transparent={object.opacity * layerOpacity < 1}
          opacity={object.opacity * layerOpacity}
          depthWrite={object.opacity * layerOpacity >= 0.92}
        />
      </mesh>
      {selected && <mesh scale={1.07}><sphereGeometry args={[object.size, 28, 28]} /><meshBasicMaterial color={connectionSource ? "#76d2f4" : "#fff4d0"} wireframe transparent opacity={0.72} /></mesh>}
      <Html position={[0, object.size + 0.35, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <span className={`concept-label${selected ? " selected" : ""}`}>{object.name}</span>
      </Html>
      {thinkerOpen && <ThinkerCard concept={object} onClose={onOpenThinker} />}
    </group>
  );
  const radius = object.size * Math.max(object.scaleX, object.scaleY, object.scaleZ) + 0.72;
  return <>{body}{selected && <group position={[object.x, object.y, object.z]}><Line points={[[-radius, 0, 0], [radius, 0, 0]]} color="#e47770" lineWidth={1.5} /><Line points={[[0, -radius, 0], [0, radius, 0]]} color="#77c77a" lineWidth={1.5} /><Line points={[[0, 0, -radius], [0, 0, radius]]} color="#72a9e4" lineWidth={1.5} /><ScaleHandle axis="x" position={[radius, 0, 0]} color="#e47770" onScale={(amount) => onTransform({ scaleX: Math.max(0.1, object.scaleX + amount) })} onDragging={onDragging} /><ScaleHandle axis="y" position={[0, radius, 0]} color="#77c77a" onScale={(amount) => onTransform({ scaleY: Math.max(0.1, object.scaleY + amount) })} onDragging={onDragging} /><ScaleHandle axis="z" position={[0, 0, radius]} color="#72a9e4" onScale={(amount) => onTransform({ scaleZ: Math.max(0.1, object.scaleZ + amount) })} onDragging={onDragging} /></group>}</>;
}

function CameraPreset({ view }: { view: PlaneView }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    const preset: Record<PlaneView, { position: [number, number, number]; up: [number, number, number] }> = {
      "3d": { position: [12, 10, 14], up: [0, 1, 0] },
      xy: { position: [0, 0, 22], up: [0, 1, 0] },
      yz: { position: [22, 0, 0], up: [0, 1, 0] },
      xz: { position: [0, 22, 0], up: [0, 0, -1] },
    };
    camera.position.set(...preset[view].position); camera.up.set(...preset[view].up); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  }, [camera, view]);
  return null;
}

function ConnectionLabel({ connection, position, selected, onSelect, onSave }: { connection: Connection; position: [number, number, number]; selected: boolean; onSelect: () => void; onSave: (label: string) => void }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(connection.label); const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const commit = () => { const label = draft.trim(); if (label && label !== connection.label) onSave(label); setEditing(false); };
  return <Html position={position} center distanceFactor={13} style={{ pointerEvents: "auto" }}><div className={`connection-label${selected ? " selected" : ""}`} role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onSelect(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }} onDoubleClick={(event) => { event.stopPropagation(); setDraft(connection.label); setEditing(true); }}>{editing ? <textarea ref={inputRef} value={draft} rows={Math.min(3, Math.max(1, draft.split("\n").length))} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commit(); } if (event.key === "Escape") { setDraft(connection.label); setEditing(false); } }} /> : connection.label}</div></Html>;
}

function MappingScene({ objects, connections, layers, axisLabels, selectedId, connectionStartId, selectedConnectionId, planeView, thinkerObjectId, onSelect, onConnectSelect, onOpenThinker, onSelectConnection, onConnectionLabelSave, onChange, onDragging, dragging, editable, onAxisSave }: {
  objects: MapObject[];
  connections: Connection[];
  layers: LayerDefinition[];
  axisLabels: AxisLabels;
  selectedId: string;
  connectionStartId: string;
  selectedConnectionId: string;
  planeView: PlaneView;
  thinkerObjectId: string;
  onSelect: (id: string) => void;
  onConnectSelect: (id: string) => void;
  onOpenThinker: (id: string) => void;
  onSelectConnection: (id: string) => void;
  onConnectionLabelSave: (id: string, label: string) => void;
  onChange: (id: string, patch: Partial<MapObject>) => void;
  onDragging: (dragging: boolean) => void;
  dragging: boolean;
  editable: boolean;
  onAxisSave: (axis: keyof AxisLabels, value: string) => void;
}) {
  return <>
    <color attach="background" args={["#101916"]} /><fog attach="fog" args={["#101916", 18, 36]} />
    <PerspectiveCamera makeDefault position={[12, 10, 14]} fov={45} /><CameraPreset view={planeView} />
    <ambientLight intensity={0.85} /><directionalLight position={[8, 12, 10]} intensity={2.2} color="#fff8e7" /><directionalLight position={[-8, 3, -6]} intensity={0.8} color="#b8d8cb" />
    <gridHelper args={[24, 24, "#446158", "#263b35"]} position={[0, -5.5, 0]} /><axesHelper args={[7]} />
    <Line points={[[-7, 0, 0], [7, 0, 0]]} color="#e58c7a" lineWidth={1.25} transparent opacity={0.72} />
    <Line points={[[0, -7, 0], [0, 7, 0]]} color="#8ebc88" lineWidth={1.25} transparent opacity={0.72} />
    <Line points={[[0, 0, -7], [0, 0, 7]]} color="#7ea9d6" lineWidth={1.25} transparent opacity={0.72} />
    <mesh><sphereGeometry args={[0.13, 24, 24]} /><meshBasicMaterial color="#f0eadc" /></mesh>
    <AxisLabel position={[-7.7, 0, 0]} label={`−X · ${axisLabels.xNegative}`} tone="#e58c7a" editable={editable} onSave={(value) => onAxisSave("xNegative", value.replace(/^−?X\s*·\s*/, ""))} />
    <AxisLabel position={[7.7, 0, 0]} label={`+X · ${axisLabels.xPositive}`} tone="#e58c7a" editable={editable} onSave={(value) => onAxisSave("xPositive", value.replace(/^\+?X\s*·\s*/, ""))} />
    <AxisLabel position={[0, -4.8, 0]} label={`−Y · ${axisLabels.yNegative}`} tone="#8ebc88" editable={editable} onSave={(value) => onAxisSave("yNegative", value.replace(/^−?Y\s*·\s*/, ""))} />
    <AxisLabel position={[0, 7.7, 0]} label={`+Y · ${axisLabels.yPositive}`} tone="#8ebc88" editable={editable} onSave={(value) => onAxisSave("yPositive", value.replace(/^\+?Y\s*·\s*/, ""))} />
    <AxisLabel position={[0, 0, -7.7]} label={`−Z · ${axisLabels.zNegative}`} tone="#7ea9d6" editable={editable} onSave={(value) => onAxisSave("zNegative", value.replace(/^−?Z\s*·\s*/, ""))} />
    <AxisLabel position={[0, 0, 7.7]} label={`+Z · ${axisLabels.zPositive}`} tone="#7ea9d6" editable={editable} onSave={(value) => onAxisSave("zPositive", value.replace(/^\+?Z\s*·\s*/, ""))} />
    {connections.map((connection) => { const source = objects.find((object) => object.id === connection.sourceConceptId); const target = objects.find((object) => object.id === connection.targetConceptId); if (!source || !target || !layers.find((layer) => layer.id === source.layerId)?.visible || !layers.find((layer) => layer.id === target.layerId)?.visible) return null; const selected = connection.id === selectedConnectionId; const midpoint: [number, number, number] = [(source.x + target.x) / 2, (source.y + target.y) / 2, (source.z + target.z) / 2]; return <group key={connection.id}><Line points={[[source.x, source.y, source.z], [target.x, target.y, target.z]]} color={connection.color ?? "#e7d48f"} lineWidth={selected ? 4 : connection.lineStyle === "dotted" ? 1 : 2} dashed={connection.lineStyle === "dashed" || connection.lineStyle === "dotted"} dashSize={connection.lineStyle === "dotted" ? 0.12 : 0.45} gapSize={connection.lineStyle === "dotted" ? 0.18 : 0.25} transparent opacity={selected ? 1 : connection.opacity ?? 0.85} onClick={(event) => { event.stopPropagation(); onSelectConnection(connection.id); }} /><ConnectionLabel connection={connection} position={midpoint} selected={selected} onSelect={() => onSelectConnection(connection.id)} onSave={(label) => onConnectionLabelSave(connection.id, label)} /></group>; })}
    {objects.map((object) => { const layer = layers.find((item) => item.id === object.layerId); if (layer && !layer.visible) return null; return <ObjectMesh key={object.id} object={object} selected={object.id === selectedId} connectionSource={object.id === connectionStartId} layerOpacity={layer?.opacity ?? 1} thinkerOpen={thinkerObjectId === object.id} onSelect={(additive) => additive ? onConnectSelect(object.id) : onSelect(object.id)} onOpenThinker={() => onOpenThinker(object.id)} onTransform={(patch) => onChange(object.id, patch)} onDragging={onDragging} />; })}
    <OrbitControls makeDefault enabled={!dragging} enableDamping dampingFactor={0.08} minDistance={7} maxDistance={32} target={[0, 0, 0]} />
  </>;
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /><input type="number" min={min} max={max} step={step} value={Number(value.toFixed(2))} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

export function CognitiveMap() {
  const [views, setViews] = useState<MapView[]>(() => {
    if (typeof window === "undefined") return starterViews;
    const raw = window.localStorage.getItem("ecm-views-v2");
    if (!raw) return starterViews;
    try { const restored = JSON.parse(raw) as MapView[]; return Array.isArray(restored) && restored.length ? restored.map(normalizeView) : starterViews; } catch { return starterViews; }
  });
  const [activeViewId, setActiveViewId] = useState("default");
  const [selectedId, setSelectedId] = useState("embodied-placement");
  const [planeView, setPlaneView] = useState<PlaneView>("3d");
  const [draggingObject, setDraggingObject] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [thinkerObjectId, setThinkerObjectId] = useState("");
  const [connectionStartId, setConnectionStartId] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [saved, setSaved] = useState(false);
  const [roomId, setRoomId] = useState(() => typeof window === "undefined" ? "demo-room" : window.location.pathname.match(/^\/room\/([^/]+)/)?.[1] ?? "demo-room");
  const [syncState, setSyncState] = useState<"local" | "loading" | "online" | "error">(supabase ? "loading" : "local");
  const [collaborators, setCollaborators] = useState(1);
  const applyingRemote = useRef(false);
  const presenceKey = useRef(`guest-${crypto.randomUUID().slice(0, 8)}`);
  const importRef = useRef<HTMLInputElement>(null);
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];
  const palette = activeView.palette ?? defaultPalette;
  const categories = activeView.categories ?? defaultCategories;
  const objects = activeView.objects;
  const layers = activeView.layers ?? defaultLayers;
  const connections = activeView.connections ?? [];
  const selected = objects.find((object) => object.id === selectedId) ?? null;
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) ?? null;
  const editView = (change: (view: MapView) => MapView) => {
    if (activeView.readOnly) return;
    setUndoStack((history) => [...history, { viewId: activeViewId, view: activeView }].slice(-50));
    setViews((items) => items.map((view) => view.id === activeViewId ? { ...change(view), updatedAt: new Date().toISOString() } : view));
  };
  const undo = () => {
    const snapshot = undoStack.at(-1); if (!snapshot || activeView.readOnly) return;
    setViews((items) => items.map((view) => view.id === snapshot.viewId ? snapshot.view : view));
    setUndoStack((history) => history.slice(0, -1));
    setActiveViewId(snapshot.viewId); setSelectedId("");
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      event.preventDefault(); undo();
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  });
  const update = (id: string, patch: Partial<MapObject>) => {
    if (activeView.readOnly) return;
    editView((view) => ({ ...view, objects: view.objects.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  };
  const updateConnection = (id: string, patch: Partial<Connection>) => {
    if (activeView.readOnly) return;
    editView((view) => ({ ...view, connections: view.connections.map((connection) => connection.id === id ? { ...connection, ...patch, updatedAt: new Date().toISOString() } : connection) }));
  };
  const selectForConnection = (id: string) => {
    if (activeView.readOnly) return;
    if (!connectionStartId) { setConnectionStartId(id); setSelectedId(id); return; }
    if (connectionStartId === id) { setConnectionStartId(""); setSelectedId(""); return; }
    const source = objects.find((object) => object.id === connectionStartId);
    const target = objects.find((object) => object.id === id);
    const now = new Date().toISOString();
    const connection: Connection = { id: crypto.randomUUID(), sourceConceptId: connectionStartId, targetConceptId: id, relationType: "similarity", label: `${source?.name ?? "Concept"} ↔ ${target?.name ?? "Concept"}`, description: "", dimensions: [{ id: crypto.randomUUID(), label: defaultDimensions[0], relation: "unknown" }], lineStyle: "solid", color: "#e7d48f", opacity: 0.85, createdAt: now, updatedAt: now };
    editView((view) => ({ ...view, connections: [...view.connections, connection] }));
    setSelectedConnectionId(connection.id); setConnectionStartId(""); setSelectedId("");
  };
  const deleteSelectedConnection = () => {
    if (!selectedConnectionId || activeView.readOnly) return;
    editView((view) => ({ ...view, connections: view.connections.filter((connection) => connection.id !== selectedConnectionId) })); setSelectedConnectionId("");
  };
  const updateLayer = (id: string, patch: Partial<LayerDefinition>) => {
    if (activeView.readOnly) return;
    editView((view) => ({ ...view, layers: view.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer) }));
  };
  const addLayer = () => {
    const name = window.prompt("Layer name", "New layer"); if (!name || activeView.readOnly) return;
    const order = Math.max(0, ...layers.map((layer) => layer.order)) + 1;
    editView((view) => ({ ...view, layers: [...view.layers, { id: crypto.randomUUID(), name, description: "", visible: true, opacity: 1, order }] }));
  };
  const removeLayer = (id: string) => {
    if (activeView.readOnly || layers.length < 2) return;
    const destination = layers.find((layer) => layer.id !== id); if (!destination || !window.confirm(`Delete this layer? Its objects will move to “${destination.name}”.`)) return;
    editView((view) => ({ ...view, layers: view.layers.filter((layer) => layer.id !== id), objects: view.objects.map((object) => object.layerId === id ? { ...object, layerId: destination.id } : object) }));
  };

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.from("ecm_views").select("data").eq("room_id", roomId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setSyncState("error"); return; }
      const remote = (data ?? []).map((row) => row.data as MapView);
      if (remote.length) { const normalized = remote.map(normalizeView); setViews(normalized); setActiveViewId(normalized[0].id); }
      setSyncState("online");
    });
    return () => { cancelled = true; };
  }, [roomId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (event.key === "Escape") { setConnectionStartId(""); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedConnectionId) { event.preventDefault(); deleteSelectedConnection(); }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client.channel(`ecm:${roomId}:${activeViewId}`, { config: { presence: { key: presenceKey.current } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "ecm_views", filter: `room_id=eq.${roomId}` }, (payload) => {
        const record = payload.new as { data?: MapView };
        const remote = record.data;
        if (!remote || remote.id !== activeViewId) return;
        applyingRemote.current = true;
        setViews((items) => items.map((view) => view.id === remote.id ? normalizeView(remote) : view));
      })
      .on("presence", { event: "sync" }, () => {
        setCollaborators(Object.keys(channel.presenceState()).length || 1);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncState("online");
          void channel.track({ viewId: activeViewId, editingObjectId: selectedId || null, onlineAt: new Date().toISOString() });
        }
      });
    return () => { void client.removeChannel(channel); };
  }, [activeViewId, roomId, selectedId]);

  useEffect(() => {
    if (!supabase || syncState !== "online" || activeView.readOnly) return;
    if (applyingRemote.current) { applyingRemote.current = false; return; }
    const timer = window.setTimeout(() => {
      void supabase.from("ecm_views").upsert({ id: activeView.id, room_id: roomId, name: activeView.name, owner_name: activeView.ownerName, read_only: activeView.readOnly, data: { ...activeView, roomId }, updated_at: new Date().toISOString() }).then(({ error }) => setSyncState(error ? "error" : "online"));
    }, 420);
    return () => window.clearTimeout(timer);
  }, [activeView, roomId, syncState]);

  const saveViews = async () => {
    window.localStorage.setItem("ecm-views-v2", JSON.stringify(views));
    if (supabase) {
      const rows = views.map((view) => ({ id: view.id, room_id: roomId, name: view.name, owner_name: view.ownerName, read_only: view.readOnly, data: { ...view, roomId }, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("ecm_views").upsert(rows);
      setSyncState(error ? "error" : "online");
    }
    setSaved(true); window.setTimeout(() => setSaved(false), 1400);
  };

  const openRoom = (nextRoomId: string) => {
    const clean = nextRoomId.trim().replace(/[^a-zA-Z0-9_-]/g, ""); if (!clean) return;
    window.history.pushState({}, "", `/room/${clean}`); setRoomId(clean); setActiveViewId("default"); setSelectedId("");
  };
  const createRoom = () => openRoom(crypto.randomUUID().slice(0, 12));
  const joinRoom = () => { const value = window.prompt("Room ID or Room URL"); if (!value) return; openRoom(value.split("/room/").pop() ?? value); };
  const copyRoomUrl = async () => { const url = `${window.location.origin}/room/${roomId}`; await navigator.clipboard.writeText(url); };

  const addObject = () => {
    if (activeView.readOnly) return;
    const id = crypto.randomUUID();
    editView((view) => ({ ...view, objects: [...view.objects, { ...initialObjects[1], id, conceptId: id, name: "New Concept", description: "", x: 0, y: 0, z: 0, color: "#d7b66f", layerId: view.layers[0]?.id ?? "theories", thinkers: [] }] }));
    setSelectedId(id);
  };
  const duplicate = () => {
    if (!selected || activeView.readOnly) return;
    const id = crypto.randomUUID();
    editView((view) => ({ ...view, objects: [...view.objects, { ...selected, id, conceptId: id, name: `${selected.name} copy`, x: selected.x + 0.7, z: selected.z + 0.7 }] }));
    setSelectedId(id);
  };
  const remove = () => {
    if (!selected || activeView.readOnly || !window.confirm(`Delete “${selected.name}”?`)) return;
    editView((view) => ({ ...view, objects: view.objects.filter((item) => item.id !== selected.id) })); setSelectedId("");
  };
  const newView = () => {
    const name = window.prompt("New view name", "Untitled View"); if (!name) return;
    const view = createView(crypto.randomUUID(), name, "You"); setViews((items) => [...items, view]); setActiveViewId(view.id);
  };
  const duplicateView = () => {
    const name = window.prompt("Duplicate view as", `${activeView.name} copy`); if (!name) return;
    const idMap = new Map(activeView.objects.map((object) => [object.id, crypto.randomUUID()]));
    const copy: MapView = { ...activeView, id: crypto.randomUUID(), name, ownerName: "You", readOnly: false, objects: activeView.objects.map((object) => ({ ...object, id: idMap.get(object.id)! })), connections: activeView.connections.map((connection) => ({ ...connection, id: crypto.randomUUID(), sourceConceptId: idMap.get(connection.sourceConceptId) ?? connection.sourceConceptId, targetConceptId: idMap.get(connection.targetConceptId) ?? connection.targetConceptId })), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setViews((items) => [...items, copy]); setActiveViewId(copy.id);
  };
  const renameView = () => {
    if (activeView.readOnly) return; const name = window.prompt("Rename view", activeView.name); if (name) editView((view) => ({ ...view, name }));
  };
  const deleteView = () => {
    if (views.length === 1 || !window.confirm(`Delete view “${activeView.name}”?`)) return;
    const remaining = views.filter((view) => view.id !== activeView.id); setViews(remaining); setActiveViewId(remaining[0].id);
  };
  const exportView = () => {
    const blob = new Blob([JSON.stringify(activeView, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `${activeView.name.toLowerCase().replace(/\s+/g, "-")}.json`; link.click(); URL.revokeObjectURL(url);
  };
  const importView = async (file?: File) => {
    if (!file) return;
    try { const parsed = JSON.parse(await file.text()) as MapView; if (!parsed.name || !Array.isArray(parsed.objects)) throw new Error(); const imported = normalizeView({ ...parsed, id: crypto.randomUUID(), roomId: activeView.roomId, name: `${parsed.name} import`, readOnly: false }); setViews((items) => [...items, imported]); setActiveViewId(imported.id); } catch { window.alert("This file is not a valid ECM View JSON document."); }
  };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-block"><span className="brand-mark">ECM</span><div><h1>Embodied Cognitive Mapping</h1><p>Interactive multidimensional mapping of cognitive theories</p></div></div><div className="topbar-actions"><span className={`sync-dot ${syncState}`}>{syncState === "online" ? "Realtime ready" : syncState === "local" ? "Local mode" : syncState}</span><span className="view-name">Room · {roomId}</span><button className="quiet-button" type="button" onClick={() => void copyRoomUrl()}>Copy URL</button><button className="quiet-button" type="button" onClick={joinRoom}>Join</button><button className="quiet-button" type="button" onClick={createRoom}>New room</button></div></header>
    <nav className="viewbar" aria-label="Researcher views"><span className="eyebrow">Views</span><div className="viewtabs">{views.map((view) => <button key={view.id} className={view.id === activeViewId ? "active" : ""} onClick={() => { setActiveViewId(view.id); setSelectedId(""); }}>{view.name}{view.readOnly && <small> read only</small>}</button>)}<button className="add-view" onClick={newView}>+</button></div><div className="view-actions"><button onClick={undo} disabled={!undoStack.length || activeView.readOnly} title="Undo (Ctrl+Z)">↶ Undo</button><button onClick={renameView} disabled={activeView.readOnly}>Rename</button><button onClick={duplicateView}>Duplicate</button><button onClick={() => void saveViews()}>{saved ? "Saved" : "Save"}</button><button onClick={exportView}>Export</button><button onClick={() => importRef.current?.click()}>Import</button><button className="danger" onClick={deleteView}>Delete</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(e) => void importView(e.target.files?.[0])} /></div></nav>
    <section className="workspace">
      <div className="viewport" aria-label="Interactive three-dimensional concept map">
        <div className="viewport-meta"><span className="eyebrow">Viewing: {activeView.ownerName} · {collaborators} online</span><div className="viewport-status"><div className="tool-toggle plane-toggle" aria-label="Camera view"><button className={planeView === "3d" ? "active" : ""} onClick={() => setPlaneView("3d")}>3D</button><button className={planeView === "xy" ? "active" : ""} onClick={() => setPlaneView("xy")}>XY</button><button className={planeView === "yz" ? "active" : ""} onClick={() => setPlaneView("yz")}>YZ</button><button className={planeView === "xz" ? "active" : ""} onClick={() => setPlaneView("xz")}>XZ</button></div><span className="object-count">{activeView.readOnly ? "Read Only · " : "Edit Mode · "}{objects.length} objects</span></div></div>
        <Canvas dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }} onPointerMissed={() => { setSelectedId(""); setConnectionStartId(""); }}><MappingScene objects={objects} connections={connections} layers={layers} axisLabels={activeView.axisLabels} selectedId={activeView.readOnly ? "" : selectedId} connectionStartId={connectionStartId} selectedConnectionId={selectedConnectionId} planeView={planeView} thinkerObjectId={thinkerObjectId} onSelect={setSelectedId} onConnectSelect={selectForConnection} onOpenThinker={(id) => setThinkerObjectId((current) => current === id ? "" : id)} onSelectConnection={(id) => { setSelectedConnectionId(id); }} onConnectionLabelSave={(id, label) => updateConnection(id, { label })} onChange={update} onDragging={setDraggingObject} dragging={draggingObject} editable={!activeView.readOnly} onAxisSave={(axis, value) => editView((view) => ({ ...view, axisLabels: { ...view.axisLabels, [axis]: value } }))} /></Canvas>
        <div className="layer-panel"><div><b>Layers</b><button disabled={activeView.readOnly} onClick={addLayer}>+ Add</button></div>{[...layers].sort((a, b) => a.order - b.order).map((layer) => <details key={layer.id}><summary><input type="checkbox" checked={layer.visible} disabled={activeView.readOnly} onChange={(e) => updateLayer(layer.id, { visible: e.target.checked })} onClick={(e) => e.stopPropagation()} /> {layer.name}</summary><label>Name<input disabled={activeView.readOnly} value={layer.name} onChange={(e) => updateLayer(layer.id, { name: e.target.value })} /></label><label>Description<input disabled={activeView.readOnly} value={layer.description ?? ""} onChange={(e) => updateLayer(layer.id, { description: e.target.value })} /></label><label>Opacity <input type="range" min="0.05" max="1" step="0.05" disabled={activeView.readOnly} value={layer.opacity ?? 1} onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) })} /></label><button disabled={activeView.readOnly || layers.length < 2} className="danger" onClick={() => removeLayer(layer.id)}>Delete layer</button></details>)}</div>
        <div className="control-hint">{connectionStartId ? <span><b>Connect:</b> Shift + click a second sphere · Esc to cancel</span> : <><span><b>Drag sphere</b> screen plane</span><span><b>Shift + drag</b> depth (Z)</span><span><b>Double click</b> details</span></>}</div>
      </div>
      <aside className="inspector">
        <div className="inspector-head"><span className="eyebrow">Object editor</span><span className="phase-badge">{activeView.readOnly ? "Read only" : "Edit mode"}</span></div>
        {selectedConnection && (() => { const connection = selectedConnection; const source = objects.find((object) => object.id === connection.sourceConceptId); const target = objects.find((object) => object.id === connection.targetConceptId); const change = (patch: Partial<Connection>) => updateConnection(connection.id, patch); return <section className="connection-editor"><div className="connection-title"><h3>Connection</h3><button onClick={() => setSelectedConnectionId("")}>×</button></div><p>{source?.name ?? "Unknown"} <b>↔</b> {target?.name ?? "Unknown"}</p><label>Relation<select disabled={activeView.readOnly} value={connection.relationType} onChange={(e) => { const relationType = e.target.value as Connection["relationType"]; change({ relationType, lineStyle: relationType === "difference" || relationType === "historical" ? "dashed" : relationType === "criticism" ? "dotted" : "solid" }); }}>{["similarity", "difference", "influence", "criticism", "historical", "compatibility", "other"].map((type) => <option key={type}>{type}</option>)}</select></label><label>Label<input disabled={activeView.readOnly} value={connection.label} onChange={(e) => change({ label: e.target.value })} /></label><label>Description<textarea disabled={activeView.readOnly} rows={2} value={connection.description ?? ""} onChange={(e) => change({ description: e.target.value })} /></label><h4>Comparison dimensions</h4>{connection.dimensions.map((dimension) => <div className="dimension-row" key={dimension.id}><input disabled={activeView.readOnly} value={dimension.label} onChange={(e) => change({ dimensions: connection.dimensions.map((item) => item.id === dimension.id ? { ...item, label: e.target.value } : item) })} /><select disabled={activeView.readOnly} value={dimension.relation ?? "unknown"} onChange={(e) => change({ dimensions: connection.dimensions.map((item) => item.id === dimension.id ? { ...item, relation: e.target.value as ComparisonDimension["relation"] } : item) })}>{["same", "similar", "different", "debated", "unknown"].map((relation) => <option key={relation}>{relation}</option>)}</select><button disabled={activeView.readOnly} onClick={() => change({ dimensions: connection.dimensions.filter((item) => item.id !== dimension.id) })}>−</button></div>)}<button disabled={activeView.readOnly} onClick={() => change({ dimensions: [...connection.dimensions, { id: crypto.randomUUID(), label: defaultDimensions[0], relation: "unknown" }] })}>+ Dimension</button><div className="connection-actions"><button className="danger" disabled={activeView.readOnly} onClick={() => { editView((view) => ({ ...view, connections: view.connections.filter((item) => item.id !== connection.id) })); setSelectedConnectionId(""); }}>Delete connection</button></div></section>; })()}
        {selected ? <>
          <div className="selection-title"><span className="color-chip" style={{ backgroundColor: selected.color }} /><div><input className="title-input" value={selected.name} onChange={(e) => update(selected.id, { name: e.target.value })} /><select className="category-input" value={selected.categoryId ?? "other"} onChange={(e) => { const category = categories.find((item) => item.id === e.target.value); const color = palette.find((item) => item.id === category?.defaultColorId); if (category && color) update(selected.id, { categoryId: category.id, category: category.name, colorId: color.id, customColor: undefined, color: color.hex }); }}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select className="category-input" value={selected.layerId ?? layers[0]?.id} onChange={(e) => update(selected.id, { layerId: e.target.value })}>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></div></div>
          <section className="editor-section"><h3>Position</h3><div className="number-row">{(["x", "y", "z"] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step="0.1" value={Number(selected[axis].toFixed(2))} onChange={(e) => update(selected.id, { [axis]: Number(e.target.value) })} /></label>)}</div><button className="text-button" onClick={() => update(selected.id, { x: 0, y: 0, z: 0 })}>Reset position</button></section>
          <section className="editor-section"><h3>Shape · sphere</h3><RangeField label="Scale X" value={selected.scaleX} min={0.1} max={3} step={0.05} onChange={(scaleX) => update(selected.id, { scaleX })} /><RangeField label="Scale Y" value={selected.scaleY} min={0.1} max={3} step={0.05} onChange={(scaleY) => update(selected.id, { scaleY })} /><RangeField label="Scale Z" value={selected.scaleZ} min={0.1} max={3} step={0.05} onChange={(scaleZ) => update(selected.id, { scaleZ })} /><RangeField label="Base size" value={selected.size} min={0.2} max={2} step={0.05} onChange={(size) => update(selected.id, { size })} /></section>
          <section className="editor-section"><h3>Categorical color</h3><div className="color-swatches">{palette.map((color) => <button key={color.id} type="button" aria-label={color.name} title={color.name} className={selected.colorId === color.id && !selected.customColor ? "selected" : ""} style={{ backgroundColor: color.hex }} onClick={() => update(selected.id, { color: color.hex, colorId: color.id, customColor: undefined })} />)}</div><button className="text-button" onClick={() => setShowCustomColor((value) => !value)}>Custom color…</button>{showCustomColor && <label className="custom-color"><input type="color" value={selected.customColor ?? selected.color} onChange={(e) => update(selected.id, { color: e.target.value, customColor: e.target.value, colorId: undefined })} /><code>{selected.customColor ?? selected.color}</code></label>}<RangeField label="Opacity" value={selected.opacity} min={0.05} max={1} step={0.05} onChange={(opacity) => update(selected.id, { opacity })} /></section>
          <section className="editor-section"><h3>Description</h3><textarea value={selected.description} onChange={(e) => update(selected.id, { description: e.target.value })} rows={3} /></section>
          <div className="object-actions"><button onClick={duplicate}>Duplicate</button><button className="danger" onClick={remove}>Delete</button></div>
        </> : <div className="empty-selection"><span className="empty-orbit" /><h2>No object selected</h2><p>Select a sphere to edit its position and form.</p></div>}
        <section className="editor-section axis-editor"><h3>Axis labels</h3>{(["x", "y", "z"] as const).map((axis) => <div className="axis-pair" key={axis}><strong>{axis.toUpperCase()} axis</strong><label><span>− end</span><input disabled={activeView.readOnly} value={activeView.axisLabels[`${axis}Negative`]} onChange={(e) => editView((view) => ({ ...view, axisLabels: { ...view.axisLabels, [`${axis}Negative`]: e.target.value } }))} /></label><label><span>+ end</span><input disabled={activeView.readOnly} value={activeView.axisLabels[`${axis}Positive`]} onChange={(e) => editView((view) => ({ ...view, axisLabels: { ...view.axisLabels, [`${axis}Positive`]: e.target.value } }))} /></label></div>)}</section>
        <details className="palette-editor"><summary>Category palette</summary>{categories.map((category) => <label key={category.id}><span>{category.name}</span><select disabled={activeView.readOnly} value={category.defaultColorId} onChange={(e) => editView((view) => ({ ...view, palette, categories: categories.map((item) => item.id === category.id ? { ...item, defaultColorId: e.target.value } : item) }))}>{palette.map((color) => <option key={color.id} value={color.id}>{color.name}</option>)}</select></label>)}</details>
        {!activeView.readOnly && <button className="primary-button" onClick={addObject}>+ Add object</button>}
      </aside>
    </section>
  </main>;
}
