"use client";

import { Html, OrbitControls, PerspectiveCamera, TransformControls } from "@react-three/drei";
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
  categoryId?: string;
  colorId?: string;
  customColor?: string;
};

type MapObject = Concept & ViewObject;
type TransformMode = "translate" | "scale";
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
  connections: unknown[];
  layers: unknown[];
  palette: PaletteColor[];
  categories: CategoryDefinition[];
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

const createView = (id: string, name: string, ownerName: string, offset = 0, readOnly = false): MapView => ({
  id, roomId: "demo-room", name, ownerName, readOnly, axisLabels: { ...axisLabels }, camera: [12, 10, 14],
  objects: initialObjects.map((object, index) => ({ ...object, x: object.x + (index % 2 ? offset : -offset), z: object.z + offset * 0.5 })),
  connections: [], layers: [], palette: defaultPalette, categories: defaultCategories, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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

function ObjectMesh({ object, selected, mode, onSelect, onTransform, onDragging }: {
  object: MapObject;
  selected: boolean;
  mode: TransformMode;
  onSelect: () => void;
  onTransform: (patch: Partial<MapObject>) => void;
  onDragging: (dragging: boolean) => void;
}) {
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const dragging = useRef(false);
  const dragPlane = useRef(new Plane());
  const dragOffset = useRef(new Vector3());
  const dragPoint = useRef(new Vector3());
  const startClientY = useRef(0);
  const startZ = useRef(0);
  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    if (mode !== "translate") return;
    event.stopPropagation(); onSelect(); dragging.current = true; onDragging(true);
    startClientY.current = event.nativeEvent.clientY; startZ.current = object.z;
    const normal = camera.getWorldDirection(new Vector3());
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, new Vector3(object.x, object.y, object.z));
    event.ray.intersectPlane(dragPlane.current, dragPoint.current);
    dragOffset.current.copy(dragPoint.current).sub(new Vector3(object.x, object.y, object.z));
    (event.target as Element).setPointerCapture(event.pointerId); document.body.style.cursor = "grabbing";
  };
  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    event.stopPropagation();
    if (event.nativeEvent.shiftKey) onTransform({ z: startZ.current + (startClientY.current - event.nativeEvent.clientY) * 0.025 });
    else if (event.ray.intersectPlane(dragPlane.current, dragPoint.current)) onTransform({ x: dragPoint.current.x - dragOffset.current.x, y: dragPoint.current.y - dragOffset.current.y, z: dragPoint.current.z - dragOffset.current.z });
  };
  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false; onDragging(false); event.stopPropagation();
    (event.target as Element).releasePointerCapture(event.pointerId); document.body.style.cursor = "auto";
  };
  const body = (
    <group ref={group} position={[object.x, object.y, object.z]} scale={[object.scaleX, object.scaleY, object.scaleZ]}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect(); }} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerOver={() => { if (mode === "translate") document.body.style.cursor = "grab"; }} onPointerOut={() => { if (!dragging.current) document.body.style.cursor = "auto"; }} renderOrder={object.opacity < 1 ? 2 : 0}>
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

function MappingScene({ objects, axisLabels, selectedId, mode, onSelect, onChange, onDragging, dragging, editable, onAxisSave }: {
  objects: MapObject[];
  axisLabels: AxisLabels;
  selectedId: string;
  mode: TransformMode;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<MapObject>) => void;
  onDragging: (dragging: boolean) => void;
  dragging: boolean;
  editable: boolean;
  onAxisSave: (axis: keyof AxisLabels, value: string) => void;
}) {
  return <>
    <color attach="background" args={["#101916"]} /><fog attach="fog" args={["#101916", 18, 36]} />
    <PerspectiveCamera makeDefault position={[12, 10, 14]} fov={45} />
    <ambientLight intensity={0.85} /><directionalLight position={[8, 12, 10]} intensity={2.2} color="#fff8e7" /><directionalLight position={[-8, 3, -6]} intensity={0.8} color="#b8d8cb" />
    <gridHelper args={[24, 24, "#446158", "#263b35"]} position={[0, -5.5, 0]} /><axesHelper args={[7]} />
    <mesh><sphereGeometry args={[0.13, 24, 24]} /><meshBasicMaterial color="#f0eadc" /></mesh>
    <AxisLabel position={[-7.7, 0, 0]} label={`−X · ${axisLabels.xNegative}`} tone="#e58c7a" editable={editable} onSave={(value) => onAxisSave("xNegative", value.replace(/^−?X\s*·\s*/, ""))} />
    <AxisLabel position={[7.7, 0, 0]} label={`+X · ${axisLabels.xPositive}`} tone="#e58c7a" editable={editable} onSave={(value) => onAxisSave("xPositive", value.replace(/^\+?X\s*·\s*/, ""))} />
    <AxisLabel position={[0, -4.8, 0]} label={`−Y · ${axisLabels.yNegative}`} tone="#8ebc88" editable={editable} onSave={(value) => onAxisSave("yNegative", value.replace(/^−?Y\s*·\s*/, ""))} />
    <AxisLabel position={[0, 7.7, 0]} label={`+Y · ${axisLabels.yPositive}`} tone="#8ebc88" editable={editable} onSave={(value) => onAxisSave("yPositive", value.replace(/^\+?Y\s*·\s*/, ""))} />
    <AxisLabel position={[0, 0, -7.7]} label={`−Z · ${axisLabels.zNegative}`} tone="#7ea9d6" editable={editable} onSave={(value) => onAxisSave("zNegative", value.replace(/^−?Z\s*·\s*/, ""))} />
    <AxisLabel position={[0, 0, 7.7]} label={`+Z · ${axisLabels.zPositive}`} tone="#7ea9d6" editable={editable} onSave={(value) => onAxisSave("zPositive", value.replace(/^\+?Z\s*·\s*/, ""))} />
    {objects.map((object) => <ObjectMesh key={object.id} object={object} selected={object.id === selectedId} mode={mode} onSelect={() => onSelect(object.id)} onTransform={(patch) => onChange(object.id, patch)} onDragging={onDragging} />)}
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
    try { const restored = JSON.parse(raw) as MapView[]; return Array.isArray(restored) && restored.length ? restored.map(normalizeViewAxisLabels) : starterViews; } catch { return starterViews; }
  });
  const [activeViewId, setActiveViewId] = useState("default");
  const [selectedId, setSelectedId] = useState("embodied-placement");
  const [mode, setMode] = useState<TransformMode>("translate");
  const [draggingObject, setDraggingObject] = useState(false);
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
  const selected = objects.find((object) => object.id === selectedId) ?? null;
  const editView = (change: (view: MapView) => MapView) => setViews((items) => items.map((view) => view.id === activeViewId ? { ...change(view), updatedAt: new Date().toISOString() } : view));
  const update = (id: string, patch: Partial<MapObject>) => {
    if (activeView.readOnly) return;
    editView((view) => ({ ...view, objects: view.objects.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  };

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.from("ecm_views").select("data").eq("room_id", roomId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setSyncState("error"); return; }
      const remote = (data ?? []).map((row) => row.data as MapView);
      if (remote.length) { const normalized = remote.map(normalizeViewAxisLabels); setViews(normalized); setActiveViewId(normalized[0].id); }
      setSyncState("online");
    });
    return () => { cancelled = true; };
  }, [roomId]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client.channel(`ecm:${roomId}:${activeViewId}`, { config: { presence: { key: presenceKey.current } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "ecm_views", filter: `room_id=eq.${roomId}` }, (payload) => {
        const record = payload.new as { data?: MapView };
        const remote = record.data;
        if (!remote || remote.id !== activeViewId) return;
        applyingRemote.current = true;
        setViews((items) => items.map((view) => view.id === remote.id ? normalizeViewAxisLabels(remote) : view));
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
    <header className="topbar"><div className="brand-block"><span className="brand-mark">ECM</span><div><h1>Embodied Cognitive Mapping</h1><p>Interactive multidimensional mapping of cognitive theories</p></div></div><div className="topbar-actions"><span className={`sync-dot ${syncState}`}>{syncState === "online" ? "Realtime ready" : syncState === "local" ? "Local mode" : syncState}</span><span className="view-name">Room · {roomId}</span><button className="quiet-button" type="button" onClick={() => void copyRoomUrl()}>Copy URL</button><button className="quiet-button" type="button" onClick={joinRoom}>Join</button><button className="quiet-button" type="button" onClick={createRoom}>New room</button></div></header>
    <nav className="viewbar" aria-label="Researcher views"><span className="eyebrow">Views</span><div className="viewtabs">{views.map((view) => <button key={view.id} className={view.id === activeViewId ? "active" : ""} onClick={() => { setActiveViewId(view.id); setSelectedId(""); }}>{view.name}{view.readOnly && <small> read only</small>}</button>)}<button className="add-view" onClick={newView}>+</button></div><div className="view-actions"><button onClick={renameView} disabled={activeView.readOnly}>Rename</button><button onClick={duplicateView}>Duplicate</button><button onClick={() => void saveViews()}>{saved ? "Saved" : "Save"}</button><button onClick={exportView}>Export</button><button onClick={() => importRef.current?.click()}>Import</button><button className="danger" onClick={deleteView}>Delete</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(e) => void importView(e.target.files?.[0])} /></div></nav>
    <section className="workspace">
      <div className="viewport" aria-label="Interactive three-dimensional concept map">
        <div className="viewport-meta"><span className="eyebrow">Viewing: {activeView.ownerName} · {collaborators} online</span><div className="tool-toggle"><button className={mode === "translate" ? "active" : ""} onClick={() => setMode("translate")}>Move</button><button className={mode === "scale" ? "active" : ""} onClick={() => setMode("scale")}>Shape</button><button disabled title="Coming in Ver.2.1">Connect</button></div><span className="object-count">{activeView.readOnly ? "Read Only · " : "Edit Mode · "}{objects.length} objects</span></div>
        <Canvas dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }} onPointerMissed={() => setSelectedId("")}><MappingScene objects={objects} axisLabels={activeView.axisLabels} selectedId={activeView.readOnly ? "" : selectedId} mode={mode} onSelect={setSelectedId} onChange={update} onDragging={setDraggingObject} dragging={draggingObject} editable={!activeView.readOnly} onAxisSave={(axis, value) => editView((view) => ({ ...view, axisLabels: { ...view.axisLabels, [axis]: value } }))} /></Canvas>
        <div className="control-hint"><span><b>Drag sphere</b> screen plane</span><span><b>Shift + drag</b> depth (Z)</span><span><b>Drag space</b> rotate</span></div>
      </div>
      <aside className="inspector">
        <div className="inspector-head"><span className="eyebrow">Object editor</span><span className="phase-badge">{activeView.readOnly ? "Read only" : "Edit mode"}</span></div>
        {selected ? <>
          <div className="selection-title"><span className="color-chip" style={{ backgroundColor: selected.color }} /><div><input className="title-input" value={selected.name} onChange={(e) => update(selected.id, { name: e.target.value })} /><select className="category-input" value={selected.categoryId ?? "other"} onChange={(e) => { const category = categories.find((item) => item.id === e.target.value); const color = palette.find((item) => item.id === category?.defaultColorId); if (category && color) update(selected.id, { categoryId: category.id, category: category.name, colorId: color.id, customColor: undefined, color: color.hex }); }}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div></div>
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
