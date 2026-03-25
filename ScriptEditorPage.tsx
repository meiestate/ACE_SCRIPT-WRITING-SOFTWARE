import React, { useMemo, useState } from "react";
import {
  Search,
  Bell,
  Save,
  FileText,
  PanelLeft,
  PanelRight,
  Sparkles,
  MessageSquare,
  StickyNote,
  User,
  Clock3,
  ChevronDown,
  Download,
  Plus,
  Filter,
  Moon,
  Sun,
  GripVertical,
} from "lucide-react";

const initialScenes = [
  {
    id: 1,
    number: "01",
    heading: "INT. SMALL HOUSE - NIGHT",
    pages: "2.1",
    status: "draft",
    tag: "Act 1",
    summary: "Hero sits alone and hears a strange knock at midnight.",
    location: "Small House",
    time: "Night",
    mood: "Tense",
    goal: "Introduce mystery",
    conflict: "Fear vs curiosity",
    text: `INT. SMALL HOUSE - NIGHT\n\nRain taps the roof like impatient fingers.\n\nARUN, 32, sits under a dim bulb, staring at an old photograph.\n\nA sudden knock at the door.\n\nARUN\n(whispers)\nAt this hour...?\n\nHe slowly rises.\n\nAnother knock. Louder this time.`,
  },
  {
    id: 2,
    number: "02",
    heading: "EXT. LONELY STREET - NIGHT",
    pages: "1.4",
    status: "review",
    tag: "Act 1",
    summary: "The street outside is empty, but something feels alive in the dark.",
    location: "Lonely Street",
    time: "Night",
    mood: "Suspense",
    goal: "Expand atmosphere",
    conflict: "Silence vs hidden threat",
    text: `EXT. LONELY STREET - NIGHT\n\nThe street is wet and empty.\n\nA flickering streetlight struggles against the darkness.\n\nARUN opens the door and peers out.\n\nNothing.\n\nThen, from the far end of the lane, a SHADOW moves.`,
  },
  {
    id: 3,
    number: "03",
    heading: "INT. HOUSE DOORWAY - CONTINUOUS",
    pages: "1.0",
    status: "idea",
    tag: "Act 1",
    summary: "Arun discovers an envelope placed at the doorstep.",
    location: "House Doorway",
    time: "Continuous",
    mood: "Curious",
    goal: "Trigger plot",
    conflict: "Truth vs safety",
    text: `INT. HOUSE DOORWAY - CONTINUOUS\n\nAt the doorstep lies a sealed brown envelope.\n\nNo name. No stamp. Just one word written in red ink:\n\n"OPEN."\n\nARUN bends down, hesitates, then picks it up.`,
  },
];

const notesSeed = [
  {
    id: 1,
    title: "Scene tone",
    text: "Keep this opening visual and quiet. Let the silence do half the writing.",
    type: "Scene Note",
  },
  {
    id: 2,
    title: "Character reminder",
    text: "Arun speaks less. Fear should show in action, not long explanation.",
    type: "Character Note",
  },
];

const commentsSeed = [
  {
    id: 1,
    user: "Director",
    text: "Opening is strong. Maybe make the second knock even more disturbing.",
    time: "8 min ago",
  },
  {
    id: 2,
    user: "Co-Writer",
    text: "Scene heading feels clean. Add one visual object that hints at backstory.",
    time: "21 min ago",
  },
];

type RightTab = "notes" | "comments" | "ai" | "scene";

function getElementType(line: string) {
  const trimmed = line.trim();

  if (!trimmed) return "empty";
  if (/^(INT\.|EXT\.|INT\/EXT\.|EST\.)/i.test(trimmed)) return "scene";
  if (/^(CUT TO:|FADE IN:|FADE OUT:|SMASH CUT TO:|DISSOLVE TO:)$/i.test(trimmed)) return "transition";
  if (/^\(.+\)$/.test(trimmed)) return "parenthetical";
  if (
    trimmed === trimmed.toUpperCase() &&
    trimmed.length < 30 &&
    /^[A-Z0-9 .,'()\-]+$/.test(trimmed) &&
    !trimmed.includes(".")
  ) {
    return "character";
  }
  return "action";
}

function ScreenplayPreview({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="rounded-2xl border border-zinc-800 bg-white text-black shadow-sm">
      <div className="mx-auto min-h-[900px] max-w-3xl px-12 py-14 font-mono text-[15px] leading-7">
        {lines.map((line, idx) => {
          const type = getElementType(line);

          if (type === "empty") {
            return <div key={idx} className="h-5" />;
          }

          if (type === "scene") {
            return (
              <p key={idx} className="mb-2 font-bold uppercase tracking-wide">
                {line}
              </p>
            );
          }

          if (type === "transition") {
            return (
              <p key={idx} className="mb-2 text-right font-bold uppercase tracking-wide">
                {line}
              </p>
            );
          }

          if (type === "character") {
            return (
              <p key={idx} className="mb-0 mt-4 pl-40 font-bold uppercase tracking-wide">
                {line}
              </p>
            );
          }

          if (type === "parenthetical") {
            return (
              <p key={idx} className="pl-32 italic text-zinc-700">
                {line}
              </p>
            );
          }

          const prev = lines[idx - 1] ? getElementType(lines[idx - 1]) : "";
          const isDialogue = prev === "character" || prev === "parenthetical";

          if (isDialogue) {
            return (
              <p key={idx} className="max-w-md pl-24 pr-16">
                {line}
              </p>
            );
          }

          return (
            <p key={idx} className="mb-1">
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export default function ScriptEditorPage() {
  const [scenes, setScenes] = useState(initialScenes);
  const [selectedSceneId, setSelectedSceneId] = useState(initialScenes[0].id);
  const [editorValue, setEditorValue] = useState(initialScenes[0].text);
  const [searchTerm, setSearchTerm] = useState("");
  const [rightTab, setRightTab] = useState<RightTab>("notes");
  const [darkMode, setDarkMode] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveState, setSaveState] = useState<"Saved just now" | "Saving..." | "Unsaved changes">("Saved just now");

  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) ?? scenes[0],
    [scenes, selectedSceneId]
  );

  const filteredScenes = useMemo(() => {
    return scenes.filter((scene) => {
      const target = `${scene.heading} ${scene.summary} ${scene.tag}`.toLowerCase();
      return target.includes(searchTerm.toLowerCase());
    });
  }, [scenes, searchTerm]);

  const estimatedPages = useMemo(() => {
    const words = editorValue.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 180));
  }, [editorValue]);

  const estimatedRuntime = useMemo(() => estimatedPages, [estimatedPages]);

  const switchScene = (sceneId: number) => {
    const next = scenes.find((s) => s.id === sceneId);
    if (!next) return;
    setSelectedSceneId(sceneId);
    setEditorValue(next.text);
    setSaveState("Saved just now");
  };

  const handleEditorChange = (value: string) => {
    setEditorValue(value);
    setSaveState("Unsaved changes");

    window.clearTimeout((window as any).__scriptSaveTimer);
    (window as any).__scriptSaveTimer = window.setTimeout(() => {
      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedSceneId
            ? {
                ...scene,
                text: value,
                heading:
                  value
                    .split("\n")
                    .find((line) => /^(INT\.|EXT\.|INT\/EXT\.|EST\.)/i.test(line.trim()))
                    ?.trim() || scene.heading,
              }
            : scene
        )
      );
      setSaveState("Saving...");
      setTimeout(() => setSaveState("Saved just now"), 500);
    }, 800);
  };

  const addNewScene = () => {
    const newId = scenes.length + 1;
    const newScene = {
      id: newId,
      number: String(newId).padStart(2, "0"),
      heading: `INT. NEW LOCATION - DAY`,
      pages: "1.0",
      status: "idea",
      tag: "New",
      summary: "Write your new scene here.",
      location: "New Location",
      time: "Day",
      mood: "Open",
      goal: "Define scene purpose",
      conflict: "Unknown",
      text: `INT. NEW LOCATION - DAY\n\nDescribe the scene here.\n\nCHARACTER NAME\nDialogue goes here.`,
    };

    setScenes((prev) => [...prev, newScene]);
    setSelectedSceneId(newId);
    setEditorValue(newScene.text);
    setSaveState("Unsaved changes");
  };

  const pageShell = darkMode
    ? "min-h-screen bg-zinc-950 text-zinc-100"
    : "min-h-screen bg-zinc-100 text-zinc-900";

  const surface = darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const softSurface = darkMode ? "bg-zinc-900/60 border-zinc-800" : "bg-white/80 border-zinc-200";
  const muted = darkMode ? "text-zinc-400" : "text-zinc-500";
  const input = darkMode
    ? "border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
    : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400";

  return (
    <div className={pageShell}>
      <div className={`sticky top-0 z-30 border-b backdrop-blur ${darkMode ? "border-zinc-800 bg-zinc-950/90" : "border-zinc-200 bg-white/90"}`}>
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-black shadow-lg">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-wide text-amber-400">MEI Script Studio</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">Project: Thiraiyin Iravu</span>
                <span className={muted}>•</span>
                <span className={muted}>Draft: First Draft</span>
                <span className={muted}>•</span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Save className="h-4 w-4" />
                  {saveState}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden max-w-xl flex-1 items-center justify-center lg:flex">
            <div className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2 ${input}`}>
              <Search className="h-4 w-4" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search scene, dialogue, note, character..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode((p) => !p)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${surface}`}
            >
              <PanelRight className="h-4 w-4" />
              {previewMode ? "Editor" : "Preview"}
            </button>
            <button
              onClick={() => setDarkMode((p) => !p)}
              className={`rounded-xl border p-2 transition ${surface}`}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button className={`rounded-xl border p-2 transition ${surface}`}>
              <Sparkles className="h-4 w-4 text-violet-400" />
            </button>
            <button className={`rounded-xl border p-2 transition ${surface}`}>
              <Bell className="h-4 w-4" />
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-semibold text-black transition hover:bg-amber-300">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${surface}`}>
              <User className="h-4 w-4" />
              Balraj
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className={`border-r ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
          <div className={`flex items-center justify-between border-b px-4 py-4 ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
            <div>
              <p className="text-sm font-semibold">Scene Navigator</p>
              <p className={`text-xs ${muted}`}>{filteredScenes.length} scenes • screenplay flow</p>
            </div>
            <button
              onClick={addNewScene}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>

          <div className="px-4 py-3">
            <div className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 ${input}`}>
              <Search className="h-4 w-4" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search scenes"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="mb-3 flex items-center gap-2">
              <button className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${softSurface}`}>
                <Filter className="h-3.5 w-3.5" /> All
              </button>
              <button className={`rounded-xl border px-3 py-2 text-xs ${softSurface}`}>INT/EXT</button>
              <button className={`rounded-xl border px-3 py-2 text-xs ${softSurface}`}>Day/Night</button>
            </div>
          </div>

          <div className="space-y-2 px-3 pb-4">
            {filteredScenes.map((scene) => {
              const active = scene.id === selectedSceneId;
              return (
                <button
                  key={scene.id}
                  onClick={() => switchScene(scene.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    active
                      ? "border-amber-400 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]"
                      : darkMode
                      ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className={`h-4 w-4 ${muted}`} />
                      <span className="text-xs font-bold tracking-wide text-amber-400">SCENE {scene.number}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                        scene.status === "review"
                          ? "bg-blue-500/15 text-blue-400"
                          : scene.status === "draft"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-zinc-500/15 text-zinc-400"
                      }`}
                    >
                      {scene.status}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-sm font-semibold">{scene.heading}</p>
                  <p className={`mt-1 line-clamp-2 text-xs ${muted}`}>{scene.summary}</p>
                  <div className={`mt-3 flex items-center justify-between text-[11px] ${muted}`}>
                    <span>{scene.pages} pages</span>
                    <span>{scene.tag}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0">
          <div className={`flex items-center justify-between border-b px-4 py-3 lg:px-6 ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
            <div className="flex items-center gap-2 text-sm">
              <button className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${surface}`}>
                <PanelLeft className="h-4 w-4" />
                Script
              </button>
              <button className={`rounded-xl border px-3 py-2 ${surface}`}>Scene Heading</button>
              <button className={`rounded-xl border px-3 py-2 ${surface}`}>Action</button>
              <button className={`rounded-xl border px-3 py-2 ${surface}`}>Character</button>
              <button className={`rounded-xl border px-3 py-2 ${surface}`}>Dialogue</button>
            </div>
            <div className={`flex items-center gap-4 text-xs ${muted}`}>
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {estimatedPages} pages</span>
              <span>{estimatedRuntime} min est.</span>
            </div>
          </div>

          <div className="h-[calc(100vh-130px)] overflow-auto px-4 py-4 lg:px-6 lg:py-6">
            {!previewMode ? (
              <div className="mx-auto max-w-5xl">
                <div className="mb-4 grid gap-4 md:grid-cols-3">
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Current scene</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene.heading}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Scene purpose</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene.goal}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Conflict</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene.conflict}</p>
                  </div>
                </div>

                <div className={`overflow-hidden rounded-[28px] border ${darkMode ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
                    <div>
                      <p className="text-sm font-semibold">Editor Canvas</p>
                      <p className={`text-xs ${muted}`}>Write. shape. rewrite. shoot.</p>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${muted}`}>
                      <span className="rounded-full border px-2 py-1">Autosave on</span>
                      <span className="rounded-full border px-2 py-1">Screenplay mode</span>
                    </div>
                  </div>
                  <textarea
                    value={editorValue}
                    onChange={(e) => handleEditorChange(e.target.value)}
                    className={`min-h-[780px] w-full resize-none border-0 p-6 font-mono text-[15px] leading-7 outline-none ${
                      darkMode ? "bg-zinc-900 text-zinc-100" : "bg-white text-zinc-900"
                    }`}
                    spellCheck={false}
                  />
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-5xl">
                <ScreenplayPreview text={editorValue} />
              </div>
            )}
          </div>
        </main>

        <aside className={`border-l ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
          <div className={`flex items-center justify-between border-b px-4 py-4 ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
            <div>
              <p className="text-sm font-semibold">Utility Panel</p>
              <p className={`text-xs ${muted}`}>Notes, comments, AI, scene info</p>
            </div>
            <button className={`rounded-xl border p-2 ${surface}`}>
              <PanelRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 px-4 py-3">
            {[
              { key: "notes", label: "Notes", icon: StickyNote },
              { key: "comments", label: "Comments", icon: MessageSquare },
              { key: "ai", label: "AI", icon: Sparkles },
              { key: "scene", label: "Scene", icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              const active = rightTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setRightTab(item.key as RightTab)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-xs transition ${
                    active
                      ? "border-amber-400 bg-amber-400/10 text-amber-400"
                      : surface
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="h-[calc(100vh-168px)] overflow-auto px-4 pb-5">
            {rightTab === "notes" && (
              <div className="space-y-3">
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400">
                  <Plus className="h-4 w-4" />
                  Add Quick Note
                </button>
                {notesSeed.map((note) => (
                  <div key={note.id} className={`rounded-2xl border p-4 ${softSurface}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">{note.title}</p>
                      <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase text-amber-400">
                        {note.type}
                      </span>
                    </div>
                    <p className={`text-sm leading-6 ${muted}`}>{note.text}</p>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "comments" && (
              <div className="space-y-3">
                <button className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${surface}`}>
                  <MessageSquare className="h-4 w-4" />
                  Add Comment
                </button>
                {commentsSeed.map((comment) => (
                  <div key={comment.id} className={`rounded-2xl border p-4 ${softSurface}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">{comment.user}</p>
                      <span className={`text-xs ${muted}`}>{comment.time}</span>
                    </div>
                    <p className="text-sm leading-6">{comment.text}</p>
                    <div className="mt-3 flex gap-2">
                      <button className={`rounded-xl border px-3 py-2 text-xs ${surface}`}>Reply</button>
                      <button className={`rounded-xl border px-3 py-2 text-xs ${surface}`}>Resolve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "ai" && (
              <div className="space-y-3">
                <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-violet-400" />
                    <p className="text-sm font-semibold">AI Writer Assistant</p>
                  </div>
                  <p className={`text-sm leading-6 ${muted}`}>
                    Scene rewrite, dialogue polish, emotional lift, visual sharpness — all from one side panel.
                  </p>
                </div>
                {[
                  "Rewrite this scene",
                  "Make dialogue more cinematic",
                  "Increase tension",
                  "Shorten exposition",
                  "Translate Tamil ↔ English",
                ].map((action) => (
                  <button
                    key={action}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm ${surface}`}
                  >
                    <span>{action}</span>
                    <Sparkles className="h-4 w-4 text-violet-400" />
                  </button>
                ))}
              </div>
            )}

            {rightTab === "scene" && (
              <div className="space-y-3">
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Heading</p>
                  <p className="mt-2 text-sm font-semibold">{selectedScene.heading}</p>
                </div>
                <div className={`grid grid-cols-2 gap-3`}>
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Location</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene.location}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Time</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene.time}</p>
                  </div>
                </div>
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Mood</p>
                  <p className="mt-2 text-sm font-semibold">{selectedScene.mood}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Goal</p>
                  <p className="mt-2 text-sm font-semibold">{selectedScene.goal}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Conflict</p>
                  <p className="mt-2 text-sm font-semibold">{selectedScene.conflict}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Summary</p>
                  <p className="mt-2 text-sm leading-6">{selectedScene.summary}</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
