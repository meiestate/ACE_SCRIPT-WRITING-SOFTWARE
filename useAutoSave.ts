// src/features/script-editor/hooks/useAutoSave.ts

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus =
  | "idle"
  | "unsaved"
  | "saving"
  | "saved"
  | "error";

export type UseAutoSaveParams<T> = {
  value: T;
  delay?: number;
  enabled?: boolean;
  onSave: (value: T) => Promise<void>;
  onBeforeSave?: (value: T) => void;
  onAfterSave?: (value: T) => void;
  onError?: (error: Error) => void;
  compare?: (a: T, b: T) => boolean;
};

export type UseAutoSaveReturn<T> = {
  status: AutoSaveStatus;
  error: string | null;
  lastSavedAt: Date | null;
  markDirty: () => void;
  saveNow: () => Promise<void>;
  cancelPendingSave: () => void;
  resetAutoSave: (nextValue?: T) => void;
};

function defaultCompare<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useAutoSave<T>({
  value,
  delay = 900,
  enabled = true,
  onSave,
  onBeforeSave,
  onAfterSave,
  onError,
  compare = defaultCompare,
}: UseAutoSaveParams<T>): UseAutoSaveReturn<T> {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const valueRef = useRef<T>(value);
  const lastSavedValueRef = useRef<T>(value);
  const isSavingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelPendingSave = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const performSave = useCallback(async () => {
    if (!enabled) return;
    if (isSavingRef.current) return;

    const currentValue = valueRef.current;
    const unchanged = compare(currentValue, lastSavedValueRef.current);

    if (unchanged) {
      setStatus("saved");
      return;
    }

    isSavingRef.current = true;
    setStatus("saving");
    setError(null);

    try {
      onBeforeSave?.(currentValue);
      await onSave(currentValue);
      lastSavedValueRef.current = currentValue;
      setLastSavedAt(new Date());
      setStatus("saved");
      onAfterSave?.(currentValue);
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error("Auto save failed");

      setStatus("error");
      setError(normalizedError.message);
      onError?.(normalizedError);
    } finally {
      isSavingRef.current = false;
    }
  }, [compare, enabled, onAfterSave, onBeforeSave, onError, onSave]);

  const saveNow = useCallback(async () => {
    clearTimer();
    await performSave();
  }, [clearTimer, performSave]);

  const markDirty = useCallback(() => {
    if (!enabled) return;
    setStatus("unsaved");
  }, [enabled]);

  const resetAutoSave = useCallback(
    (nextValue?: T) => {
      clearTimer();

      const finalValue = nextValue !== undefined ? nextValue : valueRef.current;
      valueRef.current = finalValue;
      lastSavedValueRef.current = finalValue;

      setError(null);
      setStatus("idle");
    },
    [clearTimer]
  );

  useEffect(() => {
    valueRef.current = value;

    if (!mountedRef.current) {
      mountedRef.current = true;
      lastSavedValueRef.current = value;
      return;
    }

    if (!enabled) return;

    const unchanged = compare(value, lastSavedValueRef.current);

    if (unchanged) return;

    setStatus("unsaved");
    setError(null);

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      void performSave();
    }, delay);

    return clearTimer;
  }, [value, delay, enabled, compare, performSave, clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    status,
    error,
    lastSavedAt,
    markDirty,
    saveNow,
    cancelPendingSave,
    resetAutoSave,
  };
}