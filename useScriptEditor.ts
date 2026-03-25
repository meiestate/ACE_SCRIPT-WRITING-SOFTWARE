// src/features/script-editor/hooks/useScriptEditor.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CommentItem,
  EditorPayload,
  exportPdf,
  getComments,
  getNotes,
  getScenes,
  loadProject,
  parseScenesFromDraft,
  Project,
  saveCurrentDraft,
  Scene,
  createScene as createSceneApi,
  updateScene as updateSceneApi,
  NoteItem,
} from "../api/scriptEditor.api";

export type SaveState =
  | "Saved just now"
  | "Saving..."
  | "Unsaved changes"
  | "Save failed";

export type RightTab = "notes" | "comments" | "ai" | "scene";

export type UseScriptEditorParams = {
  projectId: string;
  scriptId: string;
  autosaveDelay?: number;
  autoParseDelay?: number;
  enabled?: boolean;
};

export type CreateSceneInput = {
  heading?: string;
  summary?: string;
  status?: string;
};

export type UpdateSceneInput = Partial<{
  heading: string;
  summary: string;
  status: string;
  location: string;
  time: string;
  mood: string;
  goal: string;
  conflict: string;
}>;

export type UseScriptEditorReturn = {
  project: Project | null;
  scriptTitle: string;
  currentVersionId: string | null;

  scenes: Scene[];
  filteredScenes: Scene[];
  notes: NoteItem[];
  comments: CommentItem[];

  selectedSceneId: string | null;
  selectedScene: Scene | null;

  editorValue: string;
  searchTerm: string;
  rightTab: RightTab;
  darkMode: boolean;
  previewMode: boolean;
  saveState: SaveState;

  isBootLoading: boolean;
  isSaving: boolean;
  isExporting: boolean;
  isParsingScenes: boolean;
  isCreatingScene: boolean;

  error: string | null;

  estimatedPages: number;
  estimatedRuntime: number;

  setSearchTerm: (value: string) => void;
  setRightTab: (tab: RightTab) => void;
  setDarkMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  setPreviewMode: (value: boolean | ((prev: boolean) => boolean)) => void;

  handleEditorChange: (value: string) => void;
  switchScene: (sceneId: string) => Promise<void>;
  createScene: (input?: CreateSceneInput) => Promise<void>;
  updateSceneMeta: (sceneId: string, input: UpdateSceneInput) => Promise<void>;
  refreshScenesFromDraft: () => Promise<void>;
  manualSave: () => Promise<void>;
  runExportPdf: () => Promise<string | undefined>;
  reloadAll: () => Promise<void>;
  clearError: () => void;
};

function getSceneHeadingFromText(text: string, fallback = "UNTITLED SCENE") {
  const heading = text
    .split("\n")
    .find((line) => /^(INT\.|EXT\.|INT\/EXT\.|EST\.)/i.test(line.trim()));

  return heading?.trim() || fallback;
}

function calculateEstimatedPages(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function hydrateCreatedScene(scene: Scene, fallbackCount: number): Scene {
  return {
    ...scene,
    number: scene.number || String(fallbackCount).padStart(2, "0"),
    status: scene.status || "idea",
    summary: scene.summary || "Write your new scene here.",
    pages: scene.pages || "1.0",
    tag: scene.tag || "New",
    location: scene.location || "",
    time: scene.time || "",
    mood: scene.mood || "",
    goal: scene.goal || "",
    conflict: scene.conflict || "",
    text:
      scene.text ||
      `INT. NEW LOCATION - DAY

Describe the scene here.

CHARACTER NAME
Dialogue goes here.`,
  };
}

export function useScriptEditor({
  projectId,
  scriptId,
  autosaveDelay = 900,
  autoParseDelay = 1200,
  enabled = true,
}: UseScriptEditorParams): UseScriptEditorReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [scriptTitle, setScriptTitle] = useState("First Draft");
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);

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
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isParsingScenes, setIsParsingScenes] = useState(false);
  const [isCreatingScene, setIsCreatingScene] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const autosaveTimerRef = useRef<number | null>(null);
  const autoParseTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const latestEditorValueRef = useRef("");

  const selectedScene = useMemo(() => {
    if (!selectedSceneId) return null;
    return scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  }, [scenes, selectedSceneId]);

  const filteredScenes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return scenes;

    return scenes.filter((scene) => {
      const target = `${scene.heading} ${scene.summary || ""} ${scene.tag || ""}`.toLowerCase();
      return target.includes(term);
    });
  }, [scenes, searchTerm]);

  const estimatedPages = useMemo(
    () => calculateEstimatedPages(editorValue),
    [editorValue]
  );

  const estimatedRuntime = useMemo(() => estimatedPages, [estimatedPages]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const clearAutoParseTimer = useCallback(() => {
    if (autoParseTimerRef.current) {
      window.clearTimeout(autoParseTimerRef.current);
      autoParseTimerRef.current = null;
    }
  }, []);

  const applyEditorPayload = useCallback((editor: EditorPayload) => {
    setScriptTitle(editor.scriptTitle || "First Draft");
    setCurrentVersionId(editor.currentVersionId || null);
    setEditorValue(editor.content_raw || "");
    latestEditorValueRef.current = editor.content_raw || "";
  }, []);

  const loadBootData = useCallback(async () => {
    if (!enabled || !projectId || !scriptId) return;

    setIsBootLoading(true);
    setError(null);

    try {
      const [projectData, editorData, scenesData, notesData, commentsData] =
        await Promise.all([
          loadProject(projectId),
          import("../api/scriptEditor.api").then((m) =>
            m.loadCurrentDraft(projectId, scriptId)
          ),
          getScenes(projectId),
          getNotes(projectId),
          getComments(projectId),
        ]);

      setProject(projectData);
      applyEditorPayload(editorData);
      setScenes(scenesData || []);
      setNotes(notesData || []);
      setComments(commentsData || []);

      setSelectedSceneId((prev) => prev || scenesData?.[0]?.id || null);
      setSaveState("Saved just now");
      initializedRef.current = true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load script editor";
      setError(message);
    } finally {
      setIsBootLoading(false);
    }
  }, [applyEditorPayload, enabled, projectId, scriptId]);

  useEffect(() => {
    void loadBootData();

    return () => {
      clearAutosaveTimer();
      clearAutoParseTimer();
    };
  }, [loadBootData, clearAutosaveTimer, clearAutoParseTimer]);

  const syncSelectedSceneTextLocally = useCallback(
    (content: string) => {
      if (!selectedSceneId) return;

      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedSceneId
            ? {
                ...scene,
                text: content,
                heading: getSceneHeadingFromText(content, scene.heading),
              }
            : scene
        )
      );
    },
    [selectedSceneId]
  );

  const manualSave = useCallback(async () => {
    if (!projectId || !scriptId) return;

    clearAutosaveTimer();
    setIsSaving(true);
    setSaveState("Saving...");

    try {
      const saved = await saveCurrentDraft(projectId, scriptId, {
        content_raw: latestEditorValueRef.current,
      });

      setCurrentVersionId(saved.currentVersionId || null);
      setScriptTitle(saved.scriptTitle || "First Draft");
      setSaveState("Saved just now");
      syncSelectedSceneTextLocally(latestEditorValueRef.current);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save draft";
      setError(message);
      setSaveState("Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [clearAutosaveTimer, projectId, scriptId, syncSelectedSceneTextLocally]);

  const refreshScenesFromDraft = useCallback(async () => {
    if (!projectId) return;

    setIsParsingScenes(true);

    try {
      const parsedScenes = await parseScenesFromDraft(projectId);
      setScenes(parsedScenes || []);

      setSelectedSceneId((prev) => {
        if (prev && parsedScenes.some((scene) => scene.id === prev)) return prev;
        return parsedScenes[0]?.id || null;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse scenes";
      setError(message);
    } finally {
      setIsParsingScenes(false);
    }
  }, [projectId]);

  const scheduleAutoSave = useCallback(
    (value: string) => {
      clearAutosaveTimer();

      autosaveTimerRef.current = window.setTimeout(() => {
        latestEditorValueRef.current = value;
        void manualSave();
      }, autosaveDelay);
    },
    [autosaveDelay, clearAutosaveTimer, manualSave]
  );

  const scheduleAutoParse = useCallback(() => {
    clearAutoParseTimer();

    autoParseTimerRef.current = window.setTimeout(() => {
      void refreshScenesFromDraft();
    }, autoParseDelay);
  }, [autoParseDelay, clearAutoParseTimer, refreshScenesFromDraft]);

  const handleEditorChange = useCallback(
    (value: string) => {
      setEditorValue(value);
      latestEditorValueRef.current = value;
      setSaveState("Unsaved changes");

      syncSelectedSceneTextLocally(value);
      scheduleAutoSave(value);

      if (initializedRef.current) {
        scheduleAutoParse();
      }
    },
    [scheduleAutoParse, scheduleAutoSave, syncSelectedSceneTextLocally]
  );

  const switchScene = useCallback(
    async (sceneId: string) => {
      const nextScene = scenes.find((scene) => scene.id === sceneId);
      if (!nextScene) return;

      if (saveState === "Unsaved changes") {
        await manualSave();
      }

      setSelectedSceneId(sceneId);
      setEditorValue(nextScene.text || "");
      latestEditorValueRef.current = nextScene.text || "";
      setSaveState("Saved just now");
    },
    [manualSave, saveState, scenes]
  );

  const createScene = useCallback(
    async (input?: CreateSceneInput) => {
      if (!projectId) return;

      setIsCreatingScene(true);

      try {
        const created = await createSceneApi(projectId, {
          heading: input?.heading || "INT. NEW LOCATION - DAY",
          summary: input?.summary || "Write your new scene here.",
          status: input?.status || "idea",
        });

        const hydrated = hydrateCreatedScene(created, scenes.length + 1);

        setScenes((prev) => [...prev, hydrated]);
        setSelectedSceneId(hydrated.id);
        setEditorValue(hydrated.text || "");
        latestEditorValueRef.current = hydrated.text || "";
        setSaveState("Unsaved changes");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create scene";
        setError(message);
      } finally {
        setIsCreatingScene(false);
      }
    },
    [projectId, scenes.length]
  );

  const updateSceneMeta = useCallback(
    async (sceneId: string, input: UpdateSceneInput) => {
      if (!projectId || !sceneId) return;

      try {
        const updated = await updateSceneApi(projectId, sceneId, input);

        setScenes((prev) =>
          prev.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  ...updated,
                }
              : scene
          )
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update scene";
        setError(message);
      }
    },
    [projectId]
  );

  const runExportPdf = useCallback(async (): Promise<string | undefined> => {
    if (!projectId || !scriptId) return undefined;

    setIsExporting(true);

    try {
      const result = await exportPdf(projectId, scriptId);
      return result.file_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export PDF";
      setError(message);
      return undefined;
    } finally {
      setIsExporting(false);
    }
  }, [projectId, scriptId]);

  const reloadAll = useCallback(async () => {
    const [notesData, commentsData, scenesData] = await Promise.all([
      getNotes(projectId),
      getComments(projectId),
      getScenes(projectId),
    ]);

    setNotes(notesData || []);
    setComments(commentsData || []);
    setScenes(scenesData || []);
  }, [projectId]);

  useEffect(() => {
    if (!selectedScene && scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [selectedScene, scenes, selectedSceneId]);

  return {
    project,
    scriptTitle,
    currentVersionId,

    scenes,
    filteredScenes,
    notes,
    comments,

    selectedSceneId,
    selectedScene,

    editorValue,
    searchTerm,
    rightTab,
    darkMode,
    previewMode,
    saveState,

    isBootLoading,
    isSaving,
    isExporting,
    isParsingScenes,
    isCreatingScene,

    error,

    estimatedPages,
    estimatedRuntime,

    setSearchTerm,
    setRightTab,
    setDarkMode,
    setPreviewMode,

    handleEditorChange,
    switchScene,
    createScene,
    updateSceneMeta,
    refreshScenesFromDraft,
    manualSave,
    runExportPdf,
    reloadAll,
    clearError,
  };
}