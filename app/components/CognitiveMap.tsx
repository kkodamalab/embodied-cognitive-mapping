"use client";

import { Html, OrbitControls, PerspectiveCamera, TransformControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";

type Concept = {
  id: string;
  name: string;
  description: string;
  category: string;
  references: string[];
};

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
};

type MapObject = Concept & ViewObject;
type TransformMode = "translate" | "scale";
type AxisLabels = { x: string; y: string; z: string };
type MapView = {
  id: string;
  roomId: string;
  name: string;
  ownerName: string;
  readOnly: boolean;
  axisLabels: AxisLabels;
  camera: [number, number, number];
  objects: MapObject[];
  connections: unknown[];
  layers: unknown[];
  createdAt: string;
  updatedAt: string;
};

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
}));

const axisLabels = {
  x: "Reductionist  ←  Systemic / Self-organizing",
  y: "Situated / Sensorimotor  ←  Abstract / Decoupled",
  z: "Individual  ←  Body  ←  Environment  ←  Social / Cultural",
};

const createView = (id: string, name: string, ownerName: string, offset = 0, readOnly = false): MapView => ({
  id, roomId: "demo-room", name, ownerName, readOnly, axisLabels: { ...axisLabels }, camera: [12, 10, 14],
  objects: initialObjects.map((object, index) => ({ ...object, x: object.x + (index % 2 ? offset : -offset), z: object.z + offset * 0.5 })),
  connections: [], layers: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

const starterViews: MapView[] = [
  createView("default", "Default", "Shared baseline"),
  createView("kodama", "Kodama", "Kodama", 0.45),
  createView("ecological", "Ecological", "Researcher A", 0.9, true),
  createView("enactive", "Enactive", "Researcher B", -0.65, true),
];

function AxisLabel({ position, label, tone }: { position: [number, number, number]; label: string; tone: string }) {
  return <Html position={position} center distanceFactor={13} style={{ pointerEvents: "none" }}><span className="axis-label" style={{ color: tone }}>{label}</span></Html>;
}

function ObjectMesh({ object, selected, mode, onSelect, onTransform }: {
  object: MapObject;
  selected: boolean;
  mode: TransformMode;
  onSelect: () => void;
  onTransform: (patch: Partial<MapObject>) => void;
}) {
  const group = useRef<Group>(null);
  const body = (
    <group ref={group} position={[object.x, object.y, object.z]} scale={[object.scaleX, object.scaleY, object.scaleZ]}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect(); }} renderOrder={object.opacity < 1 ? 2 : 0}>
        <sphereGeometry args={[object.size, 40, 40]} />
        <meshStandardMaterial
          color={object.color}
          emissive={selected ? object.color : "#000000"}
          emissiveIntensity={selected ? 0.38 : 0}
          roughness={0.42}
          metalness={0.08}
          transparent={object.opacity < 1}
          opacity={object.opacity}
          depthWrite={object.opacity >= 0.92}
        />
      </mesh>
      {selected && <mesh scale={1.07}><sphereGeometry args={[object.size, 28, 28]} /><meshBasicMaterial color="#fff4d0" wireframe transparent opacity={0.72} /></mesh>}
      <Html position={[0, object.size + 0.35, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <span className={`concept-label${selected ? " selected" : ""}`}>{object.name}</span>
      </Html>
    </group>
  );

  if (!selected) return body;
  return (
    <TransformControls
      mode={mode}
      size={0.72}
      onObjectChange={() => {
        const node = group.current;
        if (!node) return;
        onTransform({
          x: node.position.x, y: node.position.y, z: node.position.z,
          scaleX: Math.max(0.1, node.scale.x), scaleY: Math.max(0.1, node.scale.y), scaleZ: Math.max(0.1, node.scale.z),
        });
      }}
    >{body}</TransformControls>
  );
}

function MappingScene({ objects, axisLabels, selectedId, mode, onSelect, onChange }: {
  objects: MapObject[];
  axisLabels: AxisLabels;
  selectedId: string;
  mode: TransformMode;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<MapObject>) => void;
}) {
  return <>
    <color attach="background" args={["#101916"]} /><fog attach="fog" args={["#101916", 18, 36]} />
    <PerspectiveCamera makeDefault position={[12, 10, 14]} fov={45} />
    <ambientLight intensity={0.85} /><directionalLight position={[8, 12, 10]} intensity={2.2} color="#fff8e7" /><directionalLight position={[-8, 3, -6]} intensity={0.8} color="#b8d8cb" />
    <gridHelper args={[24, 24, "#446158", "#263b35"]} position={[0, -5.5, 0]} /><axesHelper args={[7]} />
    <mesh><sphereGeometry args={[0.13, 24, 24]} /><meshBasicMaterial color="#f0eadc" /></mesh>
    <AxisLabel position={[7.7, 0, 0]} label={`X  ·  ${axisLabels.x}`} tone="#e58c7a" />
    <AxisLabel position={[0, 7.7, 0]} label={`Y  ·  ${axisLabels.y}`} tone="#8ebc88" />
    <AxisLabel position={[0, 0, 7.7]} label={`Z  ·  ${axisLabels.z}`} tone="#7ea9d6" />
    {objects.map((object) => <ObjectMesh key={object.id} object={object} selected={object.id === selectedId} mode={mode} onSelect={() => onSelect(object.id)} onTransform={(patch) => onChange(object.id, patch)} />)}
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={7} maxDistance={32} target={[0, 0, 0]} />
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
    try { const restored = JSON.parse(raw) as MapView[]; return Array.isArray(restored) && restored.length ? restored : starterViews; } catch { return starterViews; }
  });
  const [activeViewId, setActiveViewId] = useState("default");
  const [selectedId, setSelectedId] = useState("embodied-placement");
  const [mode, setMode] = useState<TransformMode>("translate");
  const [saved, setSaved] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];
  const objects = activeView.objects;
  const selected = objects.find((object) => object.id === selectedId) ?? null;
  const editView = (change: (view: MapView) => MapView) => setViews((items) => items.map((view) => view.id === activeViewId ? { ...change(view), updatedAt: new Date().toISOString() } : view));
  const update = (id: string, patch: Partial<MapObject>) => {
    if (activeView.readOnly) return;
    editView((view) => ({ ...view, objects: view.objects.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  };

  const saveViews = () => {
    window.localStorage.setItem("ecm-views-v2", JSON.stringify(views));
    setSaved(true); window.setTimeout(() => setSaved(false), 1400);
  };

  const addObject = () => {
    if (activeView.readOnly) return;
    const id = crypto.randomUUID();
    editView((view) => ({ ...view, objects: [...view.objects, { ...initialObjects[1], id, conceptId: id, name: "New Concept", description: "", x: 0, y: 0, z: 0, color: "#d7b66f" }] }));
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
    const copy: MapView = { ...activeView, id: crypto.randomUUID(), name, ownerName: "You", readOnly: false, objects: activeView.objects.map((object) => ({ ...object, id: crypto.randomUUID() })), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
    try { const parsed = JSON.parse(await file.text()) as MapView; if (!parsed.name || !Array.isArray(parsed.objects)) throw new Error(); const imported = { ...parsed, id: crypto.randomUUID(), roomId: activeView.roomId, name: `${parsed.name} import`, readOnly: false }; setViews((items) => [...items, imported]); setActiveViewId(imported.id); } catch { window.alert("This file is not a valid ECM View JSON document."); }
  };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-block"><span className="brand-mark">ECM</span><div><h1>Embodied Cognitive Mapping</h1><p>Interactive multidimensional mapping of cognitive theories</p></div></div><div className="topbar-actions"><span className="view-name">Room · demo-room</span><button className="quiet-button" type="button">Copy room URL</button></div></header>
    <nav className="viewbar" aria-label="Researcher views"><span className="eyebrow">Views</span><div className="viewtabs">{views.map((view) => <button key={view.id} className={view.id === activeViewId ? "active" : ""} onClick={() => { setActiveViewId(view.id); setSelectedId(""); }}>{view.name}{view.readOnly && <small> read only</small>}</button>)}<button className="add-view" onClick={newView}>+</button></div><div className="view-actions"><button onClick={renameView} disabled={activeView.readOnly}>Rename</button><button onClick={duplicateView}>Duplicate</button><button onClick={saveViews}>{saved ? "Saved" : "Save"}</button><button onClick={exportView}>Export</button><button onClick={() => importRef.current?.click()}>Import</button><button className="danger" onClick={deleteView}>Delete</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(e) => void importView(e.target.files?.[0])} /></div></nav>
    <section className="workspace">
      <div className="viewport" aria-label="Interactive three-dimensional concept map">
        <div className="viewport-meta"><span className="eyebrow">Viewing: {activeView.ownerName}</span><div className="tool-toggle"><button className={mode === "translate" ? "active" : ""} onClick={() => setMode("translate")}>Move</button><button className={mode === "scale" ? "active" : ""} onClick={() => setMode("scale")}>Shape</button></div><span className="object-count">{activeView.readOnly ? "Read Only · " : "Edit Mode · "}{objects.length} objects</span></div>
        <Canvas dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }} onPointerMissed={() => setSelectedId("")}><MappingScene objects={objects} axisLabels={activeView.axisLabels} selectedId={activeView.readOnly ? "" : selectedId} mode={mode} onSelect={setSelectedId} onChange={update} /></Canvas>
        <div className="control-hint"><span><b>Drag space</b> rotate</span><span><b>Drag gizmo</b> {mode}</span><span><b>Scroll</b> zoom</span></div>
      </div>
      <aside className="inspector">
        <div className="inspector-head"><span className="eyebrow">Object editor</span><span className="phase-badge">{activeView.readOnly ? "Read only" : "Edit mode"}</span></div>
        {selected ? <>
          <div className="selection-title"><span className="color-chip" style={{ backgroundColor: selected.color }} /><div><input className="title-input" value={selected.name} onChange={(e) => update(selected.id, { name: e.target.value })} /><input className="category-input" value={selected.category} onChange={(e) => update(selected.id, { category: e.target.value })} /></div></div>
          <section className="editor-section"><h3>Position</h3><div className="number-row">{(["x", "y", "z"] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step="0.1" value={Number(selected[axis].toFixed(2))} onChange={(e) => update(selected.id, { [axis]: Number(e.target.value) })} /></label>)}</div><button className="text-button" onClick={() => update(selected.id, { x: 0, y: 0, z: 0 })}>Reset position</button></section>
          <section className="editor-section"><h3>Shape · sphere</h3><RangeField label="Scale X" value={selected.scaleX} min={0.1} max={3} step={0.05} onChange={(scaleX) => update(selected.id, { scaleX })} /><RangeField label="Scale Y" value={selected.scaleY} min={0.1} max={3} step={0.05} onChange={(scaleY) => update(selected.id, { scaleY })} /><RangeField label="Scale Z" value={selected.scaleZ} min={0.1} max={3} step={0.05} onChange={(scaleZ) => update(selected.id, { scaleZ })} /><RangeField label="Base size" value={selected.size} min={0.2} max={2} step={0.05} onChange={(size) => update(selected.id, { size })} /></section>
          <section className="editor-section"><h3>Appearance</h3><label className="color-field"><span>Color</span><input type="color" value={selected.color} onChange={(e) => update(selected.id, { color: e.target.value })} /><code>{selected.color}</code></label><RangeField label="Opacity" value={selected.opacity} min={0.05} max={1} step={0.05} onChange={(opacity) => update(selected.id, { opacity })} /></section>
          <section className="editor-section"><h3>Description</h3><textarea value={selected.description} onChange={(e) => update(selected.id, { description: e.target.value })} rows={3} /></section>
          <div className="object-actions"><button onClick={duplicate}>Duplicate</button><button className="danger" onClick={remove}>Delete</button></div>
        </> : <div className="empty-selection"><span className="empty-orbit" /><h2>No object selected</h2><p>Select a sphere to edit its position and form.</p></div>}
        <section className="editor-section axis-editor"><h3>Axis labels</h3>{(["x", "y", "z"] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input disabled={activeView.readOnly} value={activeView.axisLabels[axis]} onChange={(e) => editView((view) => ({ ...view, axisLabels: { ...view.axisLabels, [axis]: e.target.value } }))} /></label>)}</section>
        {!activeView.readOnly && <button className="primary-button" onClick={addObject}>+ Add object</button>}
      </aside>
    </section>
  </main>;
}
