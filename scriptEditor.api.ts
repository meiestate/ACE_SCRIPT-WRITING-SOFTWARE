// src/features/script-editor/api/scriptEditor.api.ts

export const API_BASE_URL = "/api/v1";

/* =========================
   Types
========================= */

export type ApiSuccessResponse<T> = {
  success: true;
  message?: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message?: string;
  errors?: Record<string, string[]>;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type Project = {
  id: string;
  title: string;
  language?: string;
  genre?: string;
  format_type?: string;
  logline?: string;
  synopsis?: string;
  created_at?: string;
  updated_at?: string;
};

export type EditorPayload = {
  scriptId: string;
  scriptTitle?: string;
  currentVersionId?: string;
  content_raw: string;
  updated_at?: string;
};

export type Scene = {
  id: string;
  number?: string;
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
  created_at?: string;
  updated_at?: string;
};

export type NoteItem = {
  id: string;
  title?: string;
  note_text: string;
  note_type?: string;
  created_at?: string;
  updated_at?: string;
};

export type CommentUser = {
  id?: string;
  full_name?: string;
  email?: string;
};

export type CommentItem = {
  id: string;
  comment_text: string;
  user?: CommentUser;
  created_at?: string;
  updated_at?: string;
};

export type ExportPdfResponse = {
  file_url?: string;
};

export type CreateScenePayload = {
  heading: string;
  summary?: string;
  status?: string;
};

export type UpdateScenePayload = Partial<{
  heading: string;
  summary: string;
  status: string;
  location: string;
  time: string;
  mood: string;
  goal: string;
  conflict: string;
}>;

export type SaveDraftPayload = {
  content_raw: string;
};

export type RequestConfig = {
  token?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
};

/* =========================
   Helpers
========================= */

function getStoredAccessToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

function buildHeaders(config?: RequestConfig, hasJsonBody = true): HeadersInit {
  const token = config?.token ?? getStoredAccessToken();

  return {
    ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(config?.headers || {}),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const payload = isJson ? (await response.json()) : null;

  if (!response.ok) {
    const message =
      payload?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}

async function apiGet<T>(path: string, config?: RequestConfig): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: buildHeaders(config, false),
    signal: config?.signal,
  });

  return parseResponse<T>(response);
}

async function apiPost<T>(
  path: string,
  body?: unknown,
  config?: RequestConfig
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: buildHeaders(config, true),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: config?.signal,
  });

  return parseResponse<T>(response);
}

async function apiPut<T>(
  path: string,
  body?: unknown,
  config?: RequestConfig
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: buildHeaders(config, true),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: config?.signal,
  });

  return parseResponse<T>(response);
}

async function apiPatch<T>(
  path: string,
  body?: unknown,
  config?: RequestConfig
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: buildHeaders(config, true),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: config?.signal,
  });

  return parseResponse<T>(response);
}

/* =========================
   Normalizers
========================= */

function normalizeScene(scene: Scene, index: number): Scene {
  return {
    ...scene,
    number: scene.number || String(index + 1).padStart(2, "0"),
    status: scene.status || "idea",
    summary: scene.summary || "",
    pages: scene.pages || "1.0",
    tag: scene.tag || "Scene",
    location: scene.location || "",
    time: scene.time || "",
    mood: scene.mood || "",
    goal: scene.goal || "",
    conflict: scene.conflict || "",
    text: scene.text || "",
  };
}

function normalizeScenes(scenes: Scene[]): Scene[] {
  return scenes.map((scene, index) => normalizeScene(scene, index));
}

/* =========================
   Project APIs
========================= */

export async function loadProject(
  projectId: string,
  config?: RequestConfig
): Promise<Project> {
  const response = await apiGet<ApiResponse<Project>>(
    `/projects/${projectId}`,
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to load project");
  }

  return response.data;
}

/* =========================
   Editor APIs
========================= */

export async function loadCurrentDraft(
  projectId: string,
  scriptId: string,
  config?: RequestConfig
): Promise<EditorPayload> {
  const response = await apiGet<ApiResponse<EditorPayload>>(
    `/editor/projects/${projectId}/scripts/${scriptId}/current`,
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to load draft");
  }

  return response.data;
}

export async function saveCurrentDraft(
  projectId: string,
  scriptId: string,
  payload: SaveDraftPayload,
  config?: RequestConfig
): Promise<EditorPayload> {
  const response = await apiPut<ApiResponse<EditorPayload>>(
    `/editor/projects/${projectId}/scripts/${scriptId}/current`,
    payload,
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to save draft");
  }

  return response.data;
}

/* =========================
   Scene APIs
========================= */

export async function getScenes(
  projectId: string,
  config?: RequestConfig
): Promise<Scene[]> {
  const response = await apiGet<ApiResponse<Scene[]>>(
    `/projects/${projectId}/scenes`,
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to load scenes");
  }

  return normalizeScenes(response.data || []);
}

export async function parseScenesFromDraft(
  projectId: string,
  config?: RequestConfig
): Promise<Scene[]> {
  const response = await apiPost<ApiResponse<Scene[]>>(
    `/projects/${projectId}/scenes/parse-from-draft`,
    {},
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to parse scenes");
  }

  return normalizeScenes(response.data || []);
}

export async function createScene(
  projectId: string,
  payload: CreateScenePayload,
  config?: RequestConfig
): Promise<Scene> {
  const response = await apiPost<ApiResponse<Scene>>(
    `/projects/${projectId}/scenes`,
    payload,
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to create scene");
  }

  return normalizeScene(response.data, 0);
}

export async function updateScene(
  projectId: string,
  sceneId: string,
  payload: UpdateScenePayload,
  config?: RequestConfig
): Promise<Scene> {
  const response = await apiPatch<ApiResponse<Scene>>(
    `/projects/${projectId}/scenes/${sceneId}`,
    payload,
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to update scene");
  }

  return response.data;
}

/* =========================
   Notes APIs
========================= */

export async function getNotes(
  projectId: string,
  config?: RequestConfig
): Promise<NoteItem[]> {
  const response = await apiGet<ApiResponse<NoteItem[]>>(
    `/projects/${projectId}/notes`,
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to load notes");
  }

  return response.data || [];
}

/* =========================
   Comments APIs
========================= */

export async function getComments(
  projectId: string,
  config?: RequestConfig
): Promise<CommentItem[]> {
  const response = await apiGet<ApiResponse<CommentItem[]>>(
    `/projects/${projectId}/comments`,
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to load comments");
  }

  return response.data || [];
}

/* =========================
   Export APIs
========================= */

export async function exportPdf(
  projectId: string,
  scriptId: string,
  config?: RequestConfig
): Promise<ExportPdfResponse> {
  const response = await apiPost<ApiResponse<ExportPdfResponse>>(
    `/projects/${projectId}/exports/pdf`,
    { script_id: scriptId },
    config
  );

  if (!response.success) {
    throw new Error(response.message || "Failed to export PDF");
  }

  return response.data;
}

/* =========================
   Combined Boot Loader
========================= */

export type ScriptEditorBootData = {
  project: Project;
  editor: EditorPayload;
  scenes: Scene[];
  notes: NoteItem[];
  comments: CommentItem[];
};

export async function loadScriptEditorBootData(
  projectId: string,
  scriptId: string,
  config?: RequestConfig
): Promise<ScriptEditorBootData> {
  const [project, editor, scenes, notes, comments] = await Promise.all([
    loadProject(projectId, config),
    loadCurrentDraft(projectId, scriptId, config),
    getScenes(projectId, config),
    getNotes(projectId, config),
    getComments(projectId, config),
  ]);

  return {
    project,
    editor,
    scenes,
    notes,
    comments,
  };
}