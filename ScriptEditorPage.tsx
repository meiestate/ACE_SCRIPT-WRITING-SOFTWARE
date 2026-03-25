import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Loader2,
  AlertCircle,
} from "lucide-react";

/**
 * ScriptEditorPage - Backend API Connected Version
 *
 * Expected route example:
 * /projects/:projectId/scripts/:scriptId/editor
 *
 * Expected backend endpoints (matching the earlier API blueprint):
 * GET    /api/v1/projects/:projectId
 * GET    /api/v1/editor/projects/:projectId/scripts/:scriptId/current
 * PUT    /api/v1/editor/projects/:projectId/scripts/:scriptId/current
 * POST   /api/v1/projects/:projectId/scenes/parse-from-draft
 * GET    /api/v1/projects/:projectId/scenes
 * PATCH  /api/v1/projects/:projectId/scenes/:sceneId
 * GET    /api/v1/projects/:projectId/notes
 * GET    /api/v1/projects/:projectId/comments
 * POST   /api/v1/projects/:projectId/exports/pdf
 * POST   /api/v1/projects/:projectId/scenes
 */

type SaveState = "Saved just now" | "Saving..." | "Unsaved changes" | "Save failed";
type RightTab = "notes" | "comments" | "ai" | "scene";

type Project = {
  id: string;
  title: string;
  language?: string;
  genre?: string;
  format_type?: string;
};

type Scene = {
  id: string;
  number: string;
  heading: string;
  pages?: string;
  status?: string;
  tag?: string;
  summary?: string;
  location?: string;
  time?: string;
  mood?: string;
  goal?: string;
  conflict?: string;
  text?: string;
};

type NoteItem = {
  id: string;
  title?: string;
  note_text: string;
  note_type?: string;
};

type CommentItem = {
  id: string;
  user?: { full_name?: string };
  comment_text: string;
  created_at?: string;
};

type EditorPayload = {
  scriptId: string;
  scriptTitle?: string;
  currentVersionId?: string;
  content_raw: string;
  updated_at?: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

const API_BASE_URL = "/api/v1";

/**
 * Replace this with your real auth token getter.
 * Example:
 * localStorage.getItem("token")
 * or cookie-based auth where no Authorization header is needed.
 */
function getAccessToken() {
  return localStorage.getItem("token") || "";
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function timeAgo(dateString?: string) {
  if (!dateString) return "";
  const now = new Date().getTime();
  const then = new Date(dateString).getTime();
  const diffMin = Math.max(1, Math.floor((now - then) / 60000));
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day ago`;
}

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

function getSceneHeadingFromText(text: string, fallback = "UNTITLED SCENE") {
  const line = text
    .split("\n")
    .find((entry) => /^(INT\.|EXT\.|INT\/EXT\.|EST\.)/i.test(entry.trim()));
  return line?.trim() || fallback;
}

function ScreenplayPreview({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="rounded-2xl border border-zinc-800 bg-white text-black shadow-sm">
      <div className="mx-auto min-h-[900px] max-w-3xl px-12 py-14 font-mono text-[15px] leading-7">
        {lines.map((line, idx) => {
          const type = getElementType(line);

          if (type === "empty") return <div key={idx} className="h-5" />;

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
  /**
   * In a real app, get these from react-router params:
   * const { projectId, scriptId } = useParams();
   */
  const projectId = "proj_001";
  const scriptId = "script_001";

  const [project, setProject] = useState<Project | null>(null);
  const [scriptTitle, setScriptTitle] = useState("First Draft");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [rightTab, setRightTab] = useState<RightTab>("notes");
  const [darkMode, setDarkMode] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("Saved just now");
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autosaveTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const selectedScene = useMemo(() => {
    if (!selectedSceneId) return null;
    return scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  }, [scenes, selectedSceneId]);

  const filteredScenes = useMemo(() => {
    return scenes.filter((scene) => {
      const target = `${scene.heading} ${scene.summary || ""} ${scene.tag || ""}`.toLowerCase();
      return target.includes(searchTerm.toLowerCase());
    });
  }, [scenes, searchTerm]);

  const estimatedPages = useMemo(() => {
    const words = editorValue.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 180));
  }, [editorValue]);

  const estimatedRuntime = useMemo(() => estimatedPages, [estimatedPages]);

  async function loadBootData() {
    setIsBootLoading(true);
    setError(null);

    try {
      const [projectRes, editorRes, scenesRes, notesRes, commentsRes] = await Promise.all([
        apiFetch<ApiResponse<Project>>(`/projects/${projectId}`),
        apiFetch<ApiResponse<EditorPayload>>(`/editor/projects/${projectId}/scripts/${scriptId}/current`),
        apiFetch<ApiResponse<Scene[]>>(`/projects/${projectId}/scenes`),
        apiFetch<ApiResponse<NoteItem[]>>(`/projects/${projectId}/notes`),
        apiFetch<ApiResponse<CommentItem[]>>(`/projects/${projectId}/comments`),
      ]);

      setProject(projectRes.data);
      setScriptTitle(editorRes.data.scriptTitle || "First Draft");
      setEditorValue(editorRes.data.content_raw || "");
      setNotes(notesRes.data || []);
      setComments(commentsRes.data || []);

      const loadedScenes = (scenesRes.data || []).map((scene, index) => ({
        ...scene,
        number: scene.number || String(index + 1).padStart(2, "0"),
      }));

      setScenes(loadedScenes);
      setSelectedSceneId(loadedScenes[0]?.id || null);
      setSaveState("Saved just now");
      initializedRef.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load editor";
      setError(message);
    } finally {
      setIsBootLoading(false);
    }
  }

  useEffect(() => {
    void loadBootData();
  }, []);

  useEffect(() => {
    if (!selectedScene && scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedScene, selectedSceneId]);

  async function saveDraft(content: string) {
    setSaveState("Saving...");

    try {
      await apiFetch<ApiResponse<EditorPayload>>(
        `/editor/projects/${projectId}/scripts/${scriptId}/current`,
        {
          method: "PUT",
          body: JSON.stringify({ content_raw: content }),
        }
      );

      setSaveState("Saved just now");

      const heading = getSceneHeadingFromText(content, selectedScene?.heading || "UNTITLED SCENE");
      if (selectedSceneId) {
        setScenes((prev) =>
          prev.map((scene) =>
            scene.id === selectedSceneId
              ? {
                  ...scene,
                  heading,
                  text: content,
                }
              : scene
          )
        );
      }
    } catch {
      setSaveState("Save failed");
    }
  }

  function handleEditorChange(value: string) {
    setEditorValue(value);
    setSaveState("Unsaved changes");

    if (selectedSceneId) {
      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedSceneId ? { ...scene, text: value, heading: getSceneHeadingFromText(value, scene.heading) } : scene
        )
      );
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveDraft(value);
    }, 900);
  }

  async function refreshScenesFromDraft() {
    try {
      const response = await apiFetch<ApiResponse<Scene[]>>(`/projects/${projectId}/scenes/parse-from-draft`, {
        method: "POST",
      });

      const parsed = (response.data || []).map((scene, index) => ({
        ...scene,
        number: scene.number || String(index + 1).padStart(2, "0"),
      }));

      setScenes(parsed);
      if (!selectedSceneId && parsed[0]) {
        setSelectedSceneId(parsed[0].id);
      }
    } catch {
      // no-op for now
    }
  }

  async function switchScene(sceneId: string) {
    const next = scenes.find((scene) => scene.id === sceneId);
    if (!next) return;

    if (saveState === "Unsaved changes") {
      await saveDraft(editorValue);
    }

    setSelectedSceneId(sceneId);
    setEditorValue(next.text || editorValue);
    setSaveState("Saved just now");
  }

  async function addNewScene() {
    try {
      const response = await apiFetch<ApiResponse<Scene>>(`/projects/${projectId}/scenes`, {
        method: "POST",
        body: JSON.stringify({
          heading: "INT. NEW LOCATION - DAY",
          summary: "Write your new scene here.",
          status: "idea",
        }),
      });

      const newScene = response.data;
      const hydratedScene: Scene = {
        ...newScene,
        number: newScene.number || String(scenes.length + 1).padStart(2, "0"),
        text:
          newScene.text ||
          `INT. NEW LOCATION - DAY\n\nDescribe the scene here.\n\nCHARACTER NAME\nDialogue goes here.`,
      };

      setScenes((prev) => [...prev, hydratedScene]);
      setSelectedSceneId(hydratedScene.id);
      setEditorValue(hydratedScene.text || "");
      setSaveState("Unsaved changes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scene");
    }
  }

  async function exportPdf() {
    setIsExporting(true);
    try {
      const response = await apiFetch<ApiResponse<{ file_url?: string }>>(`/projects/${projectId}/exports/pdf`, {
        method: "POST",
        body: JSON.stringify({ script_id: scriptId }),
      });

      if (response.data?.file_url) {
        window.open(response.data.file_url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    if (!initializedRef.current) return;
    const timer = window.setTimeout(() => {
      void refreshScenesFromDraft();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [editorValue]);

  const pageShell = darkMode
    ? "min-h-screen bg-zinc-950 text-zinc-100"
    : "min-h-screen bg-zinc-100 text-zinc-900";

  const surface = darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const softSurface = darkMode ? "bg-zinc-900/60 border-zinc-800" : "bg-white/80 border-zinc-200";
  const muted = darkMode ? "text-zinc-400" : "text-zinc-500";
  const input = darkMode
    ? "border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
    : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400";

  if (isBootLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          <span className="text-sm">Loading script editor...</span>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <div className="max-w-md rounded-3xl border border-red-500/30 bg-zinc-900 p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold">Could not load the editor</h2>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
          <button
            onClick={() => void loadBootData()}
            className="mt-5 rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
                <span className="font-medium">Project: {project?.title || "Untitled Project"}</span>
                <span className={muted}>•</span>
                <span className={muted}>Draft: {scriptTitle}</span>
                <span className={muted}>•</span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    saveState === "Save failed" ? "text-red-400" : "text-emerald-400"
                  }`}
                >
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
            <button
              onClick={() => void exportPdf()}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExporting ? "Exporting..." : "Export"}
            </button>
            <button className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${surface}`}>
              <User className="h-4 w-4" />
              Writer
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 lg:px-6">
          {error}
        </div>
      )}

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className={`border-r ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
          <div className={`flex items-center justify-between border-b px-4 py-4 ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
            <div>
              <p className="text-sm font-semibold">Scene Navigator</p>
              <p className={`text-xs ${muted}`}>{filteredScenes.length} scenes • screenplay flow</p>
            </div>
            <button
              onClick={() => void addNewScene()}
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
                  onClick={() => void switchScene(scene.id)}
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
                      {scene.status || "idea"}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-sm font-semibold">{scene.heading}</p>
                  <p className={`mt-1 line-clamp-2 text-xs ${muted}`}>{scene.summary || "No summary yet"}</p>
                  <div className={`mt-3 flex items-center justify-between text-[11px] ${muted}`}>
                    <span>{scene.pages || "1.0"} pages</span>
                    <span>{scene.tag || "Scene"}</span>
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
                    <p className="mt-2 text-sm font-semibold">{selectedScene?.heading || "No scene selected"}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Scene purpose</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene?.goal || "Define purpose"}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Conflict</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene?.conflict || "Define conflict"}</p>
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
                    active ? "border-amber-400 bg-amber-400/10 text-amber-400" : surface
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
                {notes.length === 0 ? (
                  <div className={`rounded-2xl border p-4 text-sm ${softSurface}`}>No notes yet.</div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className={`rounded-2xl border p-4 ${softSurface}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">{note.title || "Untitled note"}</p>
                        <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase text-amber-400">
                          {note.note_type || "Note"}
                        </span>
                      </div>
                      <p className={`text-sm leading-6 ${muted}`}>{note.note_text}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {rightTab === "comments" && (
              <div className="space-y-3">
                <button className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${surface}`}>
                  <MessageSquare className="h-4 w-4" />
                  Add Comment
                </button>
                {comments.length === 0 ? (
                  <div className={`rounded-2xl border p-4 text-sm ${softSurface}`}>No comments yet.</div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={`rounded-2xl border p-4 ${softSurface}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">{comment.user?.full_name || "Collaborator"}</p>
                        <span className={`text-xs ${muted}`}>{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-sm leading-6">{comment.comment_text}</p>
                      <div className="mt-3 flex gap-2">
                        <button className={`rounded-xl border px-3 py-2 text-xs ${surface}`}>Reply</button>
                        <button className={`rounded-xl border px-3 py-2 text-xs ${surface}`}>Resolve</button>
                      </div>
                    </div>
                  ))
                )}
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
                    Connect this panel to your /api/v1/ai endpoints for rewrite, dialogue polish, summary, and translation.
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
                  <p className="mt-2 text-sm font-semibold">{selectedScene?.heading || "No scene selected"}</p>
                </div>
                <div className={`grid grid-cols-2 gap-3`}>
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Location</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene?.location || "—"}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${softSurface}`}>
                    <p className={`text-xs uppercase tracking-wider ${muted}`}>Time</p>
                    <p className="mt-2 text-sm font-semibold">{selectedScene?.time || "—"}</p>
                  </div>
                </div>
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Mood</p>
                  <p className="mt-2 text-sm font-semibold">{selectedScene?.mood || "—"}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Goal</p>
                  <p className="mt-2 text-sm font-semibold">{selectedScene?.goal || "—"}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Conflict</p>
                  <p className="mt-2 text-sm font-semibold">{selectedScene?.conflict || "—"}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${softSurface}`}>
                  <p className={`text-xs uppercase tracking-wider ${muted}`}>Summary</p>
                  <p className="mt-2 text-sm leading-6">{selectedScene?.summary || "No summary yet"}</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
