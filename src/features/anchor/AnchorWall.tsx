"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null;
  }

  supabaseClient ??= createClient();
  return supabaseClient;
}

function requireSupabaseClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase environment variables are not configured.");
  }
  return client;
}

type Anchor = {
  id: number;
  created_at: string;
  content: { html?: string; text?: string };
  category?: string;
  position?: number | null;
  updated_at?: string;
  last_returned_at?: string | null;
  return_count?: number | null;
  still_matters_count?: number | null;
  last_still_matters_at?: string | null;
  attribution?: string | null;
  archived_at?: string | null;
  user_id: string;
};

interface Props {
  columns?: number;
  gap?: number;
  style?: React.CSSProperties;
}

type AnchorCSSProperties = React.CSSProperties & {
  WebkitColumnBreakInside?: React.CSSProperties["breakInside"];
};

const COLORS: Record<string, string> = {
  default: "#FF4B24",
  personal: "#63D84E",
  thought: "#4D8DE8",
  work: "#FF7654",
  spiritual: "#8B5CF6",
  trading: "#EAB308",
};

type Category =
  | "default"
  | "personal"
  | "thought"
  | "work"
  | "spiritual"
  | "trading";

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: "default", label: "Anchor", color: COLORS.default },
  { value: "personal", label: "Personal", color: COLORS.personal },
  { value: "thought", label: "Thought", color: COLORS.thought },
  { value: "work", label: "Work", color: COLORS.work },
  { value: "spiritual", label: "Spiritual", color: COLORS.spiritual },
  { value: "trading", label: "Trading", color: COLORS.trading },
];

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c] || c,
  );

const sort = (a: Anchor[]) =>
  [...a].sort(
    (x, y) =>
      (x.position ?? Number.MAX_SAFE_INTEGER) -
        (y.position ?? Number.MAX_SAFE_INTEGER) ||
      x.created_at.localeCompare(y.created_at) ||
      x.id - y.id,
  );

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function AnchorWall({ columns = 3, gap = 20, style }: Props) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [returningId, setReturningId] = useState<number | null>(null);
  const [markingStillMatters, setMarkingStillMatters] = useState(false);
  const [stillMattersMarkedId, setStillMattersMarkedId] = useState<number | null>(null);
  const lastReturnedIdRef = useRef<number | null>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const draftShellRef = useRef<HTMLDivElement>(null);
  const [draftSlotHeight, setDraftSlotHeight] = useState(48);
  const savedRangeRef = useRef<Range | null>(null);
  const [draftEmpty, setDraftEmpty] = useState(true);
  const [draftFocused, setDraftFocused] = useState(false);
  const [draftCategory, setDraftCategory] = useState<Category>("default");
  const [hoveredDraftCategory, setHoveredDraftCategory] = useState<Category | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftAttribution, setDraftAttribution] = useState("");
  const [attributionOpen, setAttributionOpen] = useState(false);
  const attributionRef = useRef<HTMLInputElement>(null);
  const [toolbar, setToolbar] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [hoveredCategory, setHoveredCategory] = useState<Category | "all" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [wallMenuId, setWallMenuId] = useState<number | null>(null);
  const [hoveredAnchorId, setHoveredAnchorId] = useState<number | null>(null);
  const [archivedAnchor, setArchivedAnchor] = useState<Anchor | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedAnchors, setArchivedAnchors] = useState<Anchor[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const responsiveColumns =
    viewportWidth === null
      ? Math.max(1, columns)
      : viewportWidth < 700
        ? 1
        : viewportWidth < 1050
          ? Math.min(2, Math.max(1, columns))
          : Math.max(1, columns);

  const isMobile = viewportWidth !== null && viewportWidth < 700;

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);

  const startLongPress = useCallback(
    (anchorId: number, x: number, y: number) => {
      if (!isMobile) return;

      cancelLongPress();
      longPressTriggeredRef.current = false;
      longPressStartRef.current = { x, y };

      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        setReturningId(null);
        setSelectedId(null);
        setWallMenuId(anchorId);
        setHoveredAnchorId(null);
        longPressTimerRef.current = null;
      }, 500);
    },
    [cancelLongPress, isMobile],
  );

  const moveLongPress = useCallback(
    (x: number, y: number) => {
      const start = longPressStartRef.current;
      if (!start) return;

      const distance = Math.hypot(x - start.x, y - start.y);
      if (distance > 10) cancelLongPress();
    },
    [cancelLongPress],
  );

  useEffect(() => {
    const updateViewport = () => setViewportWidth(window.innerWidth);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const fetchAnchors = useCallback(async () => {
    try {
      const supabase = requireSupabaseClient();
      const {
        data: { user },
        error: ue,
      } = await supabase.auth.getUser();
      if (ue) throw ue;
      if (!user) {
        setError("Sign in to see your anchors.");
        setAnchors([]);
        return;
      }
      const { data, error } = await supabase
        .from("anchors")
        .select("id,created_at,content,category,position,updated_at,last_returned_at,return_count,still_matters_count,last_still_matters_at,attribution,archived_at,user_id")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      setAnchors(sort((data || []) as Anchor[]));
      setError("");
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Could not load anchors."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      void fetchAnchors();
    };
    queueMicrotask(refresh);
    window.addEventListener("anchor-created", refresh);
    return () => window.removeEventListener("anchor-created", refresh);
  }, [fetchAnchors]);

  const ordered = useMemo(() => sort(anchors), [anchors]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleAnchors = useMemo(() => {
    return ordered.filter((anchor) => {
      const matchesCategory =
        categoryFilter === "all" || (anchor.category || "default") === categoryFilter;

      if (!matchesCategory) return false;
      if (!normalizedSearchQuery) return true;

      const text = anchor.content?.text || "";
      const category =
        CATEGORIES.find((item) => item.value === anchor.category)?.label ||
        anchor.category ||
        "";

      return `${text} ${category}`.toLowerCase().includes(normalizedSearchQuery);
    });
  }, [ordered, normalizedSearchQuery, categoryFilter]);

  useEffect(() => {
    const onSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
        return;
      }

      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        setSearchOpen(false);
        setSearchQuery("");
        searchRef.current?.blur();
      }
    };

    window.addEventListener("keydown", onSearchShortcut);
    return () => window.removeEventListener("keydown", onSearchShortcut);
  }, [searchOpen]);

  useEffect(() => {
    if (wallMenuId === null) return;

    const closeWallMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".anchor-wall-actions")) return;

      setWallMenuId(null);
      setHoveredAnchorId(null);
    };

    document.addEventListener("mousedown", closeWallMenu);
    return () => document.removeEventListener("mousedown", closeWallMenu);
  }, [wallMenuId]);

  useEffect(() => {
    if (returningId === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReturningId(null);
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [returningId]);

  async function returnToOne() {
    if (ordered.length === 0) return;

    const now = Date.now();
    const available =
      ordered.length > 1
        ? ordered.filter((anchor) => anchor.id !== lastReturnedIdRef.current)
        : ordered;

    const weighted = available.map((anchor) => {
      const createdAt = new Date(anchor.created_at).getTime();
      const lastReturnedAt = anchor.last_returned_at
        ? new Date(anchor.last_returned_at).getTime()
        : null;
      const returnCount = anchor.return_count ?? 0;

      const daysSinceReturn = lastReturnedAt
        ? Math.max(1, (now - lastReturnedAt) / 86_400_000)
        : 120;
      const ageInDays = Math.max(1, (now - createdAt) / 86_400_000);

      const weight =
        daysSinceReturn * 2.4 +
        Math.min(ageInDays, 365) * 0.35 +
        (lastReturnedAt ? 0 : 180) -
        returnCount * 3;

      return { anchor, weight: Math.max(1, weight) };
    });

    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = weighted[weighted.length - 1].anchor;

    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        selected = item.anchor;
        break;
      }
    }

    const returnedAt = new Date().toISOString();
    const nextReturnCount = (selected.return_count ?? 0) + 1;

    lastReturnedIdRef.current = selected.id;
    setStillMattersMarkedId(null);
    setReturningId(selected.id);
    setSelectedId(null);
    setEditingId(null);

    setAnchors((current) =>
      current.map((anchor) =>
        anchor.id === selected.id
          ? {
              ...anchor,
              last_returned_at: returnedAt,
              return_count: nextReturnCount,
            }
          : anchor,
      ),
    );

    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from("anchors")
        .update({
          last_returned_at: returnedAt,
          return_count: nextReturnCount,
          updated_at: returnedAt,
        })
        .eq("id", selected.id)
        .eq("user_id", selected.user_id);

      if (error) throw error;
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Could not remember this return."));
      await fetchAnchors();
    }
  }

  async function markStillMatters(anchor: Anchor) {
    if (markingStillMatters || stillMattersMarkedId === anchor.id) return;

    const markedAt = new Date().toISOString();
    const nextCount = (anchor.still_matters_count ?? 0) + 1;

    setMarkingStillMatters(true);
    setStillMattersMarkedId(anchor.id);
    setAnchors((current) =>
      current.map((item) =>
        item.id === anchor.id
          ? {
              ...item,
              still_matters_count: nextCount,
              last_still_matters_at: markedAt,
            }
          : item,
      ),
    );

    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from("anchors")
        .update({
          still_matters_count: nextCount,
          last_still_matters_at: markedAt,
          updated_at: markedAt,
        })
        .eq("id", anchor.id)
        .eq("user_id", anchor.user_id);

      if (error) throw error;
    } catch (e: unknown) {
      setStillMattersMarkedId(null);
      setError(getErrorMessage(e, "Could not remember that this still matters."));
      await fetchAnchors();
    } finally {
      setMarkingStillMatters(false);
    }
  }

  async function reorder(source: number, target: number) {
    if (source === target || saving) return;
    const old = ordered;
    const next = [...ordered];
    const from = next.findIndex((a) => a.id === source);
    const to = next.findIndex((a) => a.id === target);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const normalized = next.map((a, i) => ({ ...a, position: i }));
    setAnchors(normalized);
    setSaving(true);
    try {
      const supabase = requireSupabaseClient();
      const results = await Promise.all(
        normalized.map((a, i) =>
          supabase
            .from("anchors")
            .update({
              position: i,
              updated_at: new Date().toISOString(),
            })
            .eq("id", a.id),
        ),
      );
      const bad = results.find((r) => r.error);
      if (bad?.error) throw bad.error;
    } catch (e: unknown) {
      setAnchors(old);
      setError(getErrorMessage(e, "Could not save order."));
      await fetchAnchors();
    } finally {
      setSaving(false);
    }
  }

  async function fetchArchivedAnchors() {
    setArchiveLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You are not signed in.");

      const { data, error } = await supabase
        .from("anchors")
        .select("id,created_at,content,category,position,updated_at,last_returned_at,return_count,still_matters_count,last_still_matters_at,attribution,archived_at,user_id")
        .eq("user_id", user.id)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });

      if (error) throw error;
      setArchivedAnchors((data || []) as Anchor[]);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Could not load archive."));
    } finally {
      setArchiveLoading(false);
    }
  }

  async function openArchive() {
    setArchiveOpen(true);
    setWallMenuId(null);
    await fetchArchivedAnchors();
  }

  async function restoreArchivedAnchor(anchor: Anchor) {
    const previous = archivedAnchors;
    setArchivedAnchors((current) => current.filter((item) => item.id !== anchor.id));

    try {
      const supabase = requireSupabaseClient();
      const restoredAt = new Date().toISOString();
      const { error } = await supabase
        .from("anchors")
        .update({ archived_at: null, updated_at: restoredAt })
        .eq("id", anchor.id)
        .eq("user_id", anchor.user_id);

      if (error) throw error;
      setAnchors((current) => sort([...current, { ...anchor, archived_at: null, updated_at: restoredAt }]));
    } catch (e: unknown) {
      setArchivedAnchors(previous);
      setError(getErrorMessage(e, "Could not restore this anchor."));
      await fetchAnchors();
    }
  }

  async function permanentlyDeleteArchivedAnchor(anchor: Anchor) {
    if (!window.confirm("Permanently delete this anchor? This cannot be undone.")) return;

    const previous = archivedAnchors;
    setArchivedAnchors((current) => current.filter((item) => item.id !== anchor.id));

    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from("anchors")
        .delete()
        .eq("id", anchor.id)
        .eq("user_id", anchor.user_id);

      if (error) throw error;
    } catch (e: unknown) {
      setArchivedAnchors(previous);
      setError(getErrorMessage(e, "Could not permanently delete this anchor."));
    }
  }

  async function archiveAnchor(anchorId: number) {
    const anchor = anchors.find((item) => item.id === anchorId);
    if (!anchor) return;
    const previous = anchors;
    const archivedAt = new Date().toISOString();
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setSelectedId(null);
    setWallMenuId(null);
    setAnchors((current) => current.filter((item) => item.id !== anchorId));
    setArchivedAnchor(anchor);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase environment variables are not configured.");
      setAnchors(previous);
      setArchivedAnchor(null);
      return;
    }
    const { error } = await supabase.from("anchors")
      .update({ archived_at: archivedAt, updated_at: archivedAt })
      .eq("id", anchorId).eq("user_id", anchor.user_id);
    if (error) {
      setError(error.message);
      setAnchors(previous);
      setArchivedAnchor(null);
      return;
    }
    undoTimerRef.current = setTimeout(() => {
      setArchivedAnchor((current) => current?.id === anchorId ? null : current);
      undoTimerRef.current = null;
    }, 5000);
  }

  async function undoArchive() {
    const anchor = archivedAnchor;
    if (!anchor) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setArchivedAnchor(null);
    setArchivedAnchors((current) => current.filter((item) => item.id !== anchor.id));
    setAnchors((current) => sort([...current, { ...anchor, archived_at: null }]));
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase environment variables are not configured.");
      await fetchAnchors();
      return;
    }
    const restoredAt = new Date().toISOString();
    const { error } = await supabase.from("anchors")
      .update({ archived_at: null, updated_at: restoredAt })
      .eq("id", anchor.id).eq("user_id", anchor.user_id);
    if (error) {
      setError(error.message);
      await fetchAnchors();
    }
  }

  async function saveText(anchor: Anchor, el: HTMLDivElement) {
    setEditingId(null);
    const text = el.innerText.trim();
    const html = el.innerHTML.trim();
    if (!text) {
      el.innerHTML =
        anchor.content?.html || escapeHtml(anchor.content?.text || "");
      return;
    }
    if (
      text === (anchor.content?.text || "").trim() &&
      html === (anchor.content?.html || "").trim()
    ) {
      return;
    }
    const content = { ...anchor.content, text, html };
    setAnchors((v) =>
      v.map((a) => (a.id === anchor.id ? { ...a, content } : a)),
    );
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase environment variables are not configured.");
      await fetchAnchors();
      return;
    }
    const { error } = await supabase
      .from("anchors")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", anchor.id);
    if (error) {
      setError(error.message);
      await fetchAnchors();
    }
  }

  async function updateCategory(anchor: Anchor, category: Category) {
    if (anchor.category === category) return;

    const updatedAt = new Date().toISOString();
    setAnchors((current) =>
      current.map((item) =>
        item.id === anchor.id ? { ...item, category, updated_at: updatedAt } : item,
      ),
    );

    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from("anchors")
        .update({ category, updated_at: updatedAt })
        .eq("id", anchor.id)
        .eq("user_id", anchor.user_id);
      if (error) throw error;
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Could not change this anchor's category."));
      await fetchAnchors();
    }
  }

  function syncDraft() {
    const text = draftRef.current?.innerText.trim() || "";
    setDraftEmpty(text.length === 0);
    if (text) setDraftMessage("");

    requestAnimationFrame(() => {
      const shell = draftShellRef.current;
      if (!shell) return;
      setDraftSlotHeight(
        Math.max(48, Math.ceil(shell.getBoundingClientRect().height)),
      );
    });
  }

  React.useEffect(() => {
    const shell = draftShellRef.current;
    if (!shell) return;

    const measure = () => {
      setDraftSlotHeight(
        Math.max(48, Math.ceil(shell.getBoundingClientRect().height)),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  function updateToolbar() {
    const editor = draftRef.current;
    const selection = window.getSelection();
    if (
      !editor ||
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      setToolbar(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    savedRangeRef.current = range.cloneRange();
    const rect = range.getBoundingClientRect();
    const host = editor.parentElement?.getBoundingClientRect();
    if (!host) return;
    const toolbarCenter = rect.left - host.left + rect.width / 2;
    const toolbarHalfWidth = 141;
    const safeLeft = Math.min(
      Math.max(toolbarCenter, toolbarHalfWidth + 4),
      Math.max(toolbarHalfWidth + 4, host.width - toolbarHalfWidth - 4),
    );

    setToolbar({
      left: safeLeft,
      top: rect.top - host.top - 6,
    });
  }

  function formatDraft(command: string, value?: string) {
    draftRef.current?.focus();
    const selection = window.getSelection();
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
    document.execCommand(command, false, value);
    syncDraft();
    requestAnimationFrame(updateToolbar);
  }

  async function createDraftAnchor() {
    const editor = draftRef.current;
    if (!editor || draftSaving) return;
    const text = editor.innerText.trim();
    const html = editor.innerHTML.trim();
    if (!text) {
      editor.focus();
      return;
    }

    setDraftSaving(true);
    setDraftMessage("Anchoring...");
    try {
      const supabase = requireSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You are not signed in.");

      const shifted = ordered.map((anchor, index) => ({
        id: anchor.id,
        position: index + 1,
      }));

      const shiftResults = await Promise.all(
        shifted.map((anchor) =>
          supabase
            .from("anchors")
            .update({
              position: anchor.position,
              updated_at: new Date().toISOString(),
            })
            .eq("id", anchor.id)
            .eq("user_id", user.id),
        ),
      );
      const shiftError = shiftResults.find((result) => result.error)?.error;
      if (shiftError) throw shiftError;

      const { error: insertError } = await supabase.from("anchors").insert({
        user_id: user.id,
        category: draftCategory,
        position: 0,
        content: { html, text },
        attribution: draftAttribution.trim() || null,
        updated_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      editor.innerHTML = "";
      savedRangeRef.current = null;
      setDraftEmpty(true);
      setDraftCategory("default");
      setDraftAttribution("");
      setAttributionOpen(false);
      setToolbar(null);
      setDraftMessage("");
      await fetchAnchors();

      // Keep the writing surface alive for the next Anchor.
      // After saving, immediately return the caret to the draft.
      requestAnimationFrame(() => {
        const nextEditor = draftRef.current;
        if (!nextEditor) return;
        nextEditor.focus();
        setDraftFocused(true);

        const range = document.createRange();
        range.selectNodeContents(nextEditor);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    } catch (e: unknown) {
      setDraftMessage(getErrorMessage(e, "Could not anchor this."));
    } finally {
      setDraftSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ ...styles.state, ...style }}>
        Returning to your anchors...
      </div>
    );
  }

  if (error && anchors.length === 0) {
    return <div style={{ ...styles.state, ...style }}>{error}</div>;
  }

  return (
    <div
      onClick={() => {
        setSelectedId(null);
        setWallMenuId(null);
        setHoveredAnchorId(null);
      }}
      style={{
        ...styles.root,
        ...(isMobile ? styles.mobileRoot : {}),
        ...style,
      }}
    >
      <style>{`
        @keyframes categoryLabelReveal {
          0% { opacity: 0; transform: translate(-50%, 4px); filter: blur(2px); }
          100% { opacity: 1; transform: translate(-50%, 0); filter: blur(0); }
        }

        @keyframes draftControlsReveal {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes anchorReturnReveal {
          0% {
            opacity: 0;
            transform: translateY(8px);
            filter: blur(3px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
      `}</style>

      {searchOpen && (
        <div style={styles.searchOverlay} onClick={(e) => e.stopPropagation()}>
          <div style={styles.searchShell}>
            <span aria-hidden="true" style={styles.searchIcon}>⌕</span>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find something you once wrote..."
              aria-label="Search anchors"
              style={styles.searchInput}
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  searchRef.current?.focus();
                }}
                style={styles.searchClear}
              >
                ×
              </button>
            ) : (
              <span style={styles.searchShortcut}><button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    setSearchOpen(false);
    setSearchQuery("");
  }}
  style={{
    border: 0,
    padding: 0,
    background: "transparent",
    color: "rgba(255,255,255,0.34)",
    fontFamily: "Figtree, sans-serif",
    fontSize: isMobile ? 18 : 11,
    lineHeight: 1,
    cursor: isMobile ? "pointer" : "default",
    pointerEvents: isMobile ? "auto" : "none",
  }}
  aria-label={isMobile ? "Close search" : undefined}
>
  {isMobile ? "×" : "esc"}
</button></span>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          ...styles.headerActions,
          top: isMobile ? -88 : -126,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Find an anchor"
          title="Find an anchor"
          onClick={() => {
            setSearchOpen(true);
            requestAnimationFrame(() => searchRef.current?.focus());
          }}
          style={{
            ...styles.searchTrigger,
            display: isMobile ? "flex" : "none",
          }}
        >
          ⌕
        </button>

        <button
          type="button"
          aria-label="Open archive"
          title="Archive"
          onClick={() => void openArchive()}
          style={styles.archiveTrigger}
        >
          Archive
        </button>

        <button
          type="button"
          onClick={() => void returnToOne()}
          style={styles.returnButton}
        >
          Return to one ↗
        </button>
      </div>

      {(error || saving) && (
        <div style={styles.status}>{saving ? "Saving order..." : error}</div>
      )}
      {archivedAnchor && (
        <div style={{ ...styles.undoToast, left: isMobile ? 20 : "50%", right: isMobile ? 20 : "auto", transform: isMobile ? "none" : "translateX(-50%)" }} onClick={(e) => e.stopPropagation()}>
          <span style={styles.undoText}>Anchor archived.</span>
          <button type="button" onClick={() => void undoArchive()} style={styles.undoButton}>Undo</button>
        </div>
      )}

      {!archiveOpen && returningId === null && selectedId === null && (
        <div
          style={{
            ...styles.categoryDock,
            bottom: archivedAnchor ? (isMobile ? 88 : 78) : (isMobile ? 20 : 24),
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Filter anchors by category"
        >
          <button
            type="button"
            aria-label="Show all anchors"
            onClick={() => setCategoryFilter("all")}
            onMouseEnter={() => setHoveredCategory("all")}
            onMouseLeave={() => setHoveredCategory(null)}
            style={{
              ...styles.wallDockDotButton,
              width: hoveredCategory === "all" ? 28 : 18,
            }}
          >
            {hoveredCategory === "all" && !isMobile && (
              <span style={styles.categoryHoverLabel}>ALL</span>
            )}
            <span
              style={{
                ...styles.wallAllCategoryDot,
                opacity: categoryFilter === "all" ? 1 : 0.42,
              }}
            />
          </button>

          {CATEGORIES.map((category) => {
            const active = categoryFilter === category.value;
            const hovered = hoveredCategory === category.value;

            return (
              <button
                key={category.value}
                type="button"
                aria-label={`Show ${category.label} anchors`}
                onClick={() =>
                  setCategoryFilter((current) =>
                    current === category.value ? "all" : category.value,
                  )
                }
                onMouseEnter={() => setHoveredCategory(category.value)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  ...styles.wallDockDotButton,
                  width: hovered ? 28 : 18,
                }}
              >
                {hovered && !isMobile && (
                  <span style={styles.categoryHoverLabel}>
                    {category.label.toUpperCase()}
                  </span>
                )}
                <span
                  style={{
                    ...styles.wallDockDot,
                    background: category.color,
                    opacity: active ? 1 : hovered ? 0.9 : 0.52,
                    boxShadow: active ? `0 0 0 2px ${category.color}33` : "none",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {archiveOpen && (
        <div style={styles.archiveOverlay} onClick={() => setArchiveOpen(false)}>
          <div style={{ ...styles.archivePanel, width: isMobile ? "calc(100% - 32px)" : "min(620px, calc(100% - 64px))" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.archiveHeader}>
              <div>
                <div style={styles.archiveEyebrow}>ARCHIVE</div>
                <h2 style={styles.archiveTitle}>words set aside.</h2>
              </div>
              <button type="button" aria-label="Close archive" onClick={() => setArchiveOpen(false)} style={styles.archiveClose}>×</button>
            </div>

            <div style={styles.archiveList}>
              {archiveLoading ? (
                <div style={styles.archiveState}>Returning to the archive...</div>
              ) : archivedAnchors.length === 0 ? (
                <div style={styles.archiveState}>Nothing set aside yet.</div>
              ) : (
                archivedAnchors.map((anchor) => {
                  const color = COLORS[anchor.category || "default"] || COLORS.default;
                  return (
                    <div key={anchor.id} style={styles.archiveItem}>
                      <div style={{ ...styles.archiveBar, background: color }} />
                      <div style={styles.archiveContent}>
                        <div
                          style={styles.archiveQuote}
                          dangerouslySetInnerHTML={{ __html: anchor.content?.html || escapeHtml(anchor.content?.text || "") }}
                        />
                        {anchor.attribution && (
                          <div style={styles.archiveAttribution}>— {anchor.attribution}</div>
                        )}
                        <div style={styles.archiveItemActions}>
                          <button type="button" onClick={() => void restoreArchivedAnchor(anchor)} style={styles.archiveRestore}>Restore</button>
                          <button type="button" onClick={() => void permanentlyDeleteArchivedAnchor(anchor)} style={styles.archiveDelete}>Delete forever</button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {returningId !== null &&
        (() => {
          const returnedAnchor = ordered.find(
            (anchor) => anchor.id === returningId,
          );

          if (!returnedAnchor) return null;

          const color =
            COLORS[returnedAnchor.category || "default"] || COLORS.default;

          return (
            <div
              style={{
                ...styles.focusOverlay,
                padding: isMobile ? 20 : 32,
              }}
              onClick={() => {
                setReturningId(null);
                setEditingId(null);
              }}
            >
              <div
                key={returningId}
                style={{
                  ...styles.focusStack,
                  width: isMobile
                    ? "100%"
                    : `calc((100% - ${Math.max(0, responsiveColumns - 1) * gap}px) / ${responsiveColumns})`,
                  maxWidth: isMobile ? "100%" : "none",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    ...styles.focusedAnchor,
                    paddingLeft: isMobile ? 14 : 18,
                  }}
                >
                  <div style={{ ...styles.bar, background: color }} />

                  <div
                    style={{
                      ...styles.card,
                      ...styles.focusCard,
                      padding: isMobile ? "14px 18px" : "18px 24px",
                    }}
                  >
                    <div
                      contentEditable={editingId === returnedAnchor.id}
                      suppressContentEditableWarning
                      ref={(element) => {
                        if (
                          element &&
                          editingId === returnedAnchor.id &&
                          document.activeElement !== element
                        ) {
                          requestAnimationFrame(() => {
                            if (element?.isConnected) element.focus();
                          });
                        }
                      }}
                      onBlur={(e) => {
                        if (editingId === returnedAnchor.id) {
                          void saveText(returnedAnchor, e.currentTarget);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (editingId === returnedAnchor.id && e.key === "Escape") {
                          e.preventDefault();
                          e.currentTarget.innerHTML =
                            returnedAnchor.content?.html ||
                            escapeHtml(returnedAnchor.content?.text || "");
                          setEditingId(null);
                        }
                        if (
                          editingId === returnedAnchor.id &&
                          e.key === "Enter" &&
                          (e.ctrlKey || e.metaKey)
                        ) {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      style={{
                        ...styles.quote,
                        ...styles.focusQuote,
                        fontSize: isMobile ? 19 : 22,
                        ...(editingId === returnedAnchor.id
                          ? styles.focusQuoteEditing
                          : {}),
                      }}
                      dangerouslySetInnerHTML={{
                        __html:
                          returnedAnchor.content?.html ||
                          escapeHtml(returnedAnchor.content?.text || ""),
                      }}
                    />
                    {returnedAnchor.attribution && (
                      <div style={{ ...styles.attribution, ...styles.focusAttribution }}>
                        — {returnedAnchor.attribution}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void markStillMatters(returnedAnchor)}
                  disabled={
                    markingStillMatters ||
                    stillMattersMarkedId === returnedAnchor.id
                  }
                  style={{
                    ...styles.stillMattersButton,
                    ...(stillMattersMarkedId === returnedAnchor.id
                      ? styles.stillMattersMarked
                      : {}),
                  }}
                >
                  {stillMattersMarkedId === returnedAnchor.id
                    ? "still matters."
                    : "still matters"}
                </button>
              </div>
            </div>
          );
        })()}

      <div
        ref={draftShellRef}
        hidden={normalizedSearchQuery.length > 0}
        style={{
          ...styles.draftOverlay,
          width: `calc((100% - ${
            Math.max(0, responsiveColumns - 1) * gap
          }px) / ${responsiveColumns})`,
        }}
      >
        <div style={styles.draftSurface}>
          <div
            ref={draftRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={() => {
              setDraftFocused(true);
              setDraftMessage("");
            }}
            onInput={syncDraft}
            onMouseUp={() => requestAnimationFrame(updateToolbar)}
            onKeyUp={() => requestAnimationFrame(updateToolbar)}
            onBlur={() =>
              window.setTimeout(() => {
                const active = document.activeElement;
                if (!active?.closest?.("[data-anchor-draft-controls]")) {
                  setDraftFocused(false);
                  setToolbar(null);
                }
              }, 0)
            }
            onKeyDown={(e) => {
              // Desktop: Enter saves; Shift + Enter creates a new line.
              // Mobile: Enter stays available for normal multiline writing.
              if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                e.preventDefault();
                void createDraftAnchor();
                return;
              }
              if (e.key === "Escape") {
                setToolbar(null);
                if (draftEmpty) e.currentTarget.blur();
              }
            }}
            style={styles.draftEditor}
          />

          {toolbar && (
            <div
              data-anchor-draft-controls
              style={{
                ...styles.floatingToolbar,
                left: toolbar.left,
                top: toolbar.top,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button style={styles.tool} onClick={() => formatDraft("bold")}>
                <b>B</b>
              </button>
              <button style={styles.tool} onClick={() => formatDraft("italic")}>
                <i>I</i>
              </button>
              <span style={styles.divider} />
              <button
                style={styles.tool}
                onClick={() => formatDraft("fontSize", "3")}
              >
                A
              </button>
              <button
                style={{ ...styles.tool, fontSize: 18 }}
                onClick={() => formatDraft("fontSize", "5")}
              >
                A
              </button>
              <span style={styles.divider} />
              <button
                style={styles.tool}
                onClick={() => formatDraft("justifyLeft")}
              >
                ≡
              </button>
              <button
                style={styles.tool}
                onClick={() => formatDraft("justifyCenter")}
              >
                ≡
              </button>
              <button
                style={styles.tool}
                onClick={() => formatDraft("justifyRight")}
              >
                ≡
              </button>
            </div>
          )}

          {!draftEmpty && draftFocused && attributionOpen && (
            <div
              data-anchor-draft-controls
              style={styles.attributionFieldWrap}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span style={styles.attributionDash}>—</span>
              <input
                ref={attributionRef}
                value={draftAttribution}
                onChange={(e) => setDraftAttribution(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAttributionOpen(false);
                    requestAnimationFrame(() => draftRef.current?.focus());
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setAttributionOpen(false);
                    requestAnimationFrame(() => draftRef.current?.focus());
                  }
                }}
                placeholder="Who said this?"
                style={styles.attributionInput}
              />
            </div>
          )}

          {!draftEmpty && draftFocused && (
            <div
              data-anchor-draft-controls
              style={styles.draftActions}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div style={styles.categoryDots}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onMouseEnter={() => setHoveredDraftCategory(c.value)}
                    onMouseLeave={() => setHoveredDraftCategory(null)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setDraftCategory(c.value);
                      requestAnimationFrame(() => draftRef.current?.focus());
                    }}
                    style={{
                      ...styles.categoryDotButton,
                      borderColor:
                        draftCategory === c.value ? c.color : "transparent",
                      opacity: draftCategory === c.value ? 1 : 0.64,
                    }}
                  >
                    {hoveredDraftCategory === c.value && !isMobile && (
                      <span style={styles.draftCategoryHoverLabel}>
                        {c.label.toUpperCase()}
                      </span>
                    )}
                    <span
                      style={{
                        ...styles.categoryDot,
                        background: c.color,
                      }}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                title="Add attribution"
                aria-label="Add attribution"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAttributionOpen((open) => !open);
                  requestAnimationFrame(() => attributionRef.current?.focus());
                }}
                style={{
                  ...styles.attributionToggle,
                  ...(attributionOpen || draftAttribution
                    ? styles.attributionToggleActive
                    : {}),
                }}
              >
                —
              </button>
              <span style={styles.draftMessage}>{draftMessage}</span>
              <button
                title={isMobile ? "Save anchor" : "Save anchor · Enter"}
                aria-label="Save anchor"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void createDraftAnchor()}
                disabled={draftSaving}
                style={{
                  ...styles.enterSave,
                  opacity: draftSaving ? 0.5 : 1,
                }}
              >
                {draftSaving ? "…" : "↵"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          ...styles.columns,
          display: "grid",
          gridTemplateColumns: `repeat(${responsiveColumns}, minmax(0, 1fr))`,
          gap,
          alignItems: "start",
        }}
      >
        {Array.from({ length: responsiveColumns }, (_, columnIndex) => (
          <div
            key={columnIndex}
            style={{
              display: "flex",
              flexDirection: "column",
              gap,
              minWidth: 0,
            }}
          >
            {columnIndex === 0 && !normalizedSearchQuery && (
              <div
                aria-hidden="true"
                style={{
                  ...styles.draftSpacer,
                  height: draftSlotHeight,
                }}
              />
            )}

            {visibleAnchors
              .filter(
                (_, anchorIndex) =>
                  (anchorIndex + 1) % responsiveColumns === columnIndex,
              )
              .map((anchor) => {
                const color =
                  COLORS[anchor.category || "default"] || COLORS.default;
                const editing = editingId === anchor.id;
                const textLength = (anchor.content?.text || "").trim().length;
                const isQuote =
                  Boolean(anchor.attribution) || /^["“‘]/.test(anchor.content?.text || "");
                const isBrief = textLength <= 56;
                const isLong = textLength > 220;
                const quoteSize = isBrief
                  ? 28
                  : textLength <= 120
                    ? 21
                    : isLong
                      ? 15
                      : 17;
                const cardPadding = isBrief ? "24px 25px" : "22px 24px";

                return (
                  <div
                    key={anchor.id}
                    className="anchor-wall-card"
                    onMouseEnter={() => setHoveredAnchorId(anchor.id)}
                    onMouseLeave={() => {
                      if (wallMenuId !== anchor.id) setHoveredAnchorId(null);
                    }}
                    draggable={!editing && !saving && !normalizedSearchQuery}
                    onClick={(e) => {
                      e.stopPropagation();

                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }

                      if (!editing) {
                        setReturningId(null);
                        setSelectedId(anchor.id);
                        setEditingId(anchor.id);
                      }
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      if (!touch || editing) return;
                      startLongPress(anchor.id, touch.clientX, touch.clientY);
                    }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      if (!touch) return;
                      moveLongPress(touch.clientX, touch.clientY);
                    }}
                    onTouchEnd={() => cancelLongPress()}
                    onTouchCancel={() => cancelLongPress()}
                    onDragStart={(e) => {
                      if (normalizedSearchQuery) {
                        e.preventDefault();
                        return;
                      }
                      setSelectedId(null);
                      setDragId(anchor.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(anchor.id));
                    }}
                    onDragOver={(e) => {
                      if (normalizedSearchQuery) return;
                      e.preventDefault();
                      setOverId(anchor.id);
                    }}
                    onDrop={(e) => {
                      if (normalizedSearchQuery) return;
                      e.preventDefault();
                      const source =
                        dragId ?? Number(e.dataTransfer.getData("text/plain"));
                      setOverId(null);
                      setDragId(null);
                      if (Number.isFinite(source)) reorder(source, anchor.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    style={{
                      ...styles.item,
                      opacity: dragId === anchor.id ? 0.35 : 1,
                      filter:
                        !isMobile &&
                        hoveredAnchorId !== null &&
                        hoveredAnchorId !== anchor.id
                          ? "blur(1.4px)"
                          : "blur(0)",
                      transform:
                        overId === anchor.id && dragId !== anchor.id
                          ? "translateY(3px)"
                          : `translateX(${(anchor.id % 3) * 2}px)`,
                    }}
                  >
                    <div
                      className="anchor-wall-actions"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        ...styles.wallActions,
                        opacity:
                          wallMenuId === anchor.id ||
                          (!isMobile && hoveredAnchorId === anchor.id)
                            ? 1
                            : 0,
                        pointerEvents:
                          wallMenuId === anchor.id ||
                          (!isMobile && hoveredAnchorId === anchor.id)
                            ? "auto"
                            : "none",
                      }}
                    >
                      {!isMobile && (
                        <button
                          type="button"
                          aria-label="Anchor actions"
                          title="Anchor actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWallMenuId((id) =>
                              id === anchor.id ? null : anchor.id,
                            );
                          }}
                          style={styles.wallMenuButton}
                        >
                          •••
                        </button>
                      )}
                      {wallMenuId === anchor.id && (
                        <div style={styles.wallMenu}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setWallMenuId(null); setSelectedId(anchor.id); setEditingId(anchor.id); }} style={styles.wallMenuItem}>Edit</button>
                          <button type="button" onClick={async (e) => { e.stopPropagation(); setWallMenuId(null); await archiveAnchor(anchor.id); }} style={{ ...styles.wallMenuItem, ...styles.wallDeleteItem }}>Archive</button>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        ...styles.card,
                        minHeight: isBrief ? 104 : textLength > 140 ? 156 : 124,
                        padding: cardPadding,
                        borderColor: editing ? `${color}66` : "rgba(255,255,255,0.075)",
                      }}
                    >
                      <div
                        contentEditable={editing}
                        suppressContentEditableWarning
                        ref={(element) => {
                          if (
                            element &&
                            editing &&
                            document.activeElement !== element
                          ) {
                            requestAnimationFrame(() => {
                              if (element.isConnected) element.focus();
                            });
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingId(anchor.id);
                          const editor = e.currentTarget;
                          requestAnimationFrame(() => {
                            if (editor?.isConnected) editor.focus();
                          });
                        }}
                        onBlur={(e) =>
                          editing && saveText(anchor, e.currentTarget)
                        }
                        onKeyDown={(e) => {
                          if (editing && e.key === "Escape") {
                            e.preventDefault();
                            e.currentTarget.innerHTML =
                              anchor.content?.html ||
                              escapeHtml(anchor.content?.text || "");
                            setEditingId(null);
                          }
                          if (
                            editing &&
                            e.key === "Enter" &&
                            (e.ctrlKey || e.metaKey)
                          ) {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        style={{
                          ...styles.quote,
                          fontSize: quoteSize,
                          fontStyle: isQuote ? "italic" : "normal",
                          outline: "none",
                        }}
                        dangerouslySetInnerHTML={{
                          __html:
                            anchor.content?.html ||
                            escapeHtml(anchor.content?.text || ""),
                        }}
                      />
                      {editing && (
                        <div style={styles.editPalette} onMouseDown={(e) => e.preventDefault()}>
                          {CATEGORIES.map((category) => (
                            <button
                              key={category.value}
                              type="button"
                              aria-label={`Set category to ${category.label}`}
                              title={category.label}
                              onClick={() => void updateCategory(anchor, category.value)}
                              style={{
                                ...styles.editPaletteDot,
                                background: category.color,
                                opacity: (anchor.category || "default") === category.value ? 1 : 0.48,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {anchor.attribution && (
                        <div style={styles.attribution}>— {anchor.attribution}</div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
        {(normalizedSearchQuery || categoryFilter !== "all") && visibleAnchors.length === 0 && (
          <div style={styles.noResults}>
            {normalizedSearchQuery
              ? `No anchors found for “${searchQuery.trim()}”.`
              : `No ${CATEGORIES.find((item) => item.value === categoryFilter)?.label || ""} anchors yet.`}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, AnchorCSSProperties> = {
  mobileRoot: {
    paddingBottom: 92,
  },
  headerActions: {
    position: "absolute",
    right: 0,
    display: "flex",
    alignItems: "center",
    gap: 12,
    zIndex: 60,
  },
  searchTrigger: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8,
    background: "rgba(20,20,20,0.72)",
    color: "rgba(255,255,255,0.48)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 16,
    cursor: "pointer",
  },
  searchOverlay: {
    position: "fixed",
    zIndex: 120,
    top: 28,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(calc(100% - 40px), 520px)",
  },
  searchShell: {
    width: "100%",
    height: 38,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 10px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    background: "rgba(17,17,17,0.88)",
    boxSizing: "border-box",
  },
  searchIcon: { color: "rgba(255,255,255,0.34)", fontSize: 16, lineHeight: 1 },
  searchInput: {
    width: "100%",
    minWidth: 0,
    border: 0,
    outline: "none",
    background: "transparent",
    color: "#F5F5F5",
    fontFamily: "Figtree, sans-serif",
    fontSize: 13,
    fontWeight: 500,
  },
  searchClear: {
    width: 22,
    height: 22,
    padding: 0,
    border: 0,
    borderRadius: 6,
    background: "transparent",
    color: "rgba(255,255,255,0.48)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
  },
  searchShortcut: {
    color: "rgba(255,255,255,0.24)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 10,
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  noResults: {
    gridColumn: "1 / -1",
    minHeight: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.32)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 13,
  },
  categoryDock: {
    position: "fixed",
    zIndex: 90,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: 0,
    border: 0,
    borderRadius: 999,
    background: "transparent",
    boxShadow: "none",
    transition: "bottom 180ms ease",
  },
  allCategoryDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "rgba(255,255,255,0.72)",
    transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease",
  },
  wallDockDotButton: {
    position: "relative",
    width: 18,
    height: 18,
    flex: "0 0 auto",
    padding: 0,
    border: 0,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    cursor: "pointer",
    overflow: "visible",
    transition: "width 180ms ease",
  },
  wallDockDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    transition: "opacity 180ms ease, box-shadow 180ms ease",
  },
  wallAllCategoryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.72)",
    transition: "opacity 180ms ease",
  },
  categoryHoverLabel: {
    position: "absolute",
    left: "50%",
    bottom: "calc(100% + 10px)",
    transform: "translateX(-50%)",
    padding: "5px 7px",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 6,
    background: "rgba(18,18,18,0.94)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.3)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "rgba(255,255,255,0.56)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: "0.06em",
    lineHeight: 1,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    animation: "categoryLabelReveal 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  archiveTrigger: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: "rgba(255,255,255,0.28)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },
  returnButton: {
    position: "relative",
    border: 0,
    padding: 0,
    background: "transparent",
    color: "rgba(255,255,255,0.42)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  archiveOverlay: {
    position: "fixed", zIndex: 150, inset: 0, display: "flex",
    alignItems: "center", justifyContent: "center", padding: 32,
    boxSizing: "border-box", background: "rgba(8,8,8,0.56)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
  },
  archivePanel: {
    maxHeight: "min(720px, calc(100vh - 64px))", display: "flex",
    flexDirection: "column", overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18,
    background: "rgba(18,18,18,0.97)", boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
  },
  archiveHeader: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    padding: "24px 24px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  archiveEyebrow: { color: "#FF4B24", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 },
  archiveTitle: { margin: 0, color: "#FFFFFF", fontSize: 24, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.1 },
  archiveClose: { width: 30, height: 30, padding: 0, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 19, cursor: "pointer" },
  archiveList: { overflowY: "auto", padding: "10px 14px 16px" },
  archiveState: { minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 },
  archiveItem: { position: "relative", display: "flex", padding: "14px 10px 14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  archiveBar: { position: "absolute", left: 4, top: 16, bottom: 16, width: 3, borderRadius: 999 },
  archiveContent: { width: "100%", minWidth: 0 },
  archiveQuote: { color: "rgba(255,255,255,0.78)", fontFamily: "Figtree, sans-serif", fontSize: 15, fontWeight: 500, lineHeight: "1.45em", whiteSpace: "pre-wrap" },
  archiveItemActions: { display: "flex", alignItems: "center", gap: 12, marginTop: 12 },
  archiveRestore: { border: 0, padding: 0, background: "transparent", color: "rgba(255,255,255,0.62)", fontFamily: "Figtree, sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" },
  archiveDelete: { border: 0, padding: 0, background: "transparent", color: "rgba(255,110,95,0.58)", fontFamily: "Figtree, sans-serif", fontSize: 11, fontWeight: 500, cursor: "pointer" },
  focusOverlay: {
    position: "fixed",
    zIndex: 100,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    boxSizing: "border-box",
    background: "rgba(8,8,8,0.42)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    cursor: "default",
  },
  focusedAnchor: {
    position: "relative",
    width: "100%",
    paddingLeft: 18,
    boxSizing: "border-box",
    animation: "anchorReturnReveal 220ms ease both",
    transformOrigin: "center center",
  },
  wallActions: {
    position: "absolute",
    top: 10,
    right: 10,
    opacity: 0,
    transition: "opacity 180ms ease",
  },
  wallMenuButton: {
    position: "relative",
    width: 24,
    height: 28,
    padding: 0,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 7,
    background: "rgba(18,18,18,0.92)",
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
  },
  wallMenu: { position: "absolute", zIndex: 100, isolation: "isolate", top: 29, right: 0, width: 112, padding: 5, display: "flex", flexDirection: "column", gap: 2, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, background: "rgba(20,20,20,0.96)", boxShadow: "0 18px 50px rgba(0,0,0,0.42)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" },
  wallMenuItem: { width: "100%", padding: "8px 10px", border: 0, borderRadius: 7, background: "transparent", color: "rgba(255,255,255,0.72)", fontFamily: "Figtree, sans-serif", fontSize: 12, fontWeight: 500, textAlign: "left", cursor: "pointer" },
  wallDeleteItem: { color: "rgba(255,110,95,0.82)" },
  focusCard: {
    width: "100%",
    padding: "18px 24px",
    borderRadius: 10,
    boxSizing: "border-box",
    background: "#1a1a18",
    
  },
  focusQuote: {
    width: "100%",
    fontSize: 22,
    lineHeight: "1.42em",
    letterSpacing: "-0.025em",
  },
  focusQuoteEditing: {
    outline: "none",
    cursor: "text",
    caretColor: "#FFFFFF",
  },
  stillMattersButton: {
    display: "block",
    alignSelf: "center",
    margin: "18px 0 0",
    padding: 0,
    border: 0,
    background: "transparent",
    color: "rgba(255,255,255,0.42)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "-0.01em",
    cursor: "pointer",
    transition: "color 180ms ease, opacity 180ms ease, transform 180ms ease",
  },
  stillMattersMarked: {
    color: "rgba(255,255,255,0.58)",
    cursor: "default",
    transform: "translateY(-1px)",
  },
  root: {
    position: "relative",
    width: "100%",
    paddingBottom: 112,
    boxSizing: "border-box",
    fontFamily: "Figtree, Inter, sans-serif",
  },
  columns: { width: "100%" },
  draftOverlay: {
    position: "absolute",
    zIndex: 30,
    left: 0,
    top: 0,
    boxSizing: "border-box",
  },
  draftSpacer: {
    display: "inline-block",
    width: "100%",
    boxSizing: "border-box",
    breakInside: "avoid",
    WebkitColumnBreakInside: "avoid",
    verticalAlign: "top",
  },
  item: {
    position: "relative",
    display: "inline-block",
    width: "100%",
    paddingLeft: 0,
    boxSizing: "border-box",
    breakInside: "avoid",
    WebkitColumnBreakInside: "avoid",
    verticalAlign: "top",
    transition: "opacity 180ms ease, transform 180ms ease, filter 180ms ease",
    cursor: "grab",
  },
  deleteButton: {
    position: "absolute",
    zIndex: 40,
    right: 8,
    top: 8,
    width: 26,
    height: 26,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    background: "rgba(12,12,12,0.92)",
    color: "rgba(255,255,255,0.72)",
    fontFamily: "inherit",
    fontSize: 20,
    lineHeight: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },
  bar: {
    position: "absolute",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    width: 4,
    height: "89.6%",
    borderRadius: 999,
  },
  card: {
    width: "100%",
    padding: "22px 24px",
    border: "1px solid rgba(255,255,255,0.075)",
    borderRadius: 10,
    background: "#1a1a18",
    boxShadow: "0 3px 12px rgba(0,0,0,0.12)",
    boxSizing: "border-box",
  },
  quote: {
    whiteSpace: "pre-wrap",
    color: "rgba(255,255,255,0.92)",
    fontFamily: "Figtree, sans-serif",
    fontWeight: 450,
    fontSize: 17,
    letterSpacing: "-0.032em",
    lineHeight: "1.42em",
    borderRadius: 6,
  },
  draftItem: {
    position: "relative",
    display: "inline-block",
    width: "100%",
    breakInside: "avoid",
    WebkitColumnBreakInside: "avoid",
    verticalAlign: "top",
    boxSizing: "border-box",
  },
  draftSurface: {
    position: "relative",
    width: "100%",
    minHeight: 48,
    overflow: "visible",
    boxSizing: "border-box",
  },
  draftPlaceholder: {
    position: "absolute",
    left: 4,
    top: 10,
    color: "#565656",
    fontSize: 18,
    lineHeight: 1.6,
    pointerEvents: "none",
    userSelect: "none",
  },
  draftEditor: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    minHeight: 48,
    padding: "10px 4px",
    outline: "none",
    border: "none",
    background: "transparent",
    color: "#F5F5F5",
    fontSize: 18,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    boxSizing: "border-box",
    cursor: "text",
    caretColor: "#FFFFFF",
    transition: "color 160ms ease",
  },
  floatingToolbar: {
    position: "absolute",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    gap: 2,
    padding: 5,
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: 10,
    background: "#191919",
    boxShadow: "0 12px 32px rgba(0,0,0,.4)",
    width: "max-content",
    maxWidth: "calc(100% - 8px)",
    boxSizing: "border-box",
    transform: "translate(-50%, -100%)",
    animation: "draftControlsReveal 160ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  tool: {
    width: 30,
    height: 30,
    border: 0,
    borderRadius: 6,
    background: "transparent",
    color: "#B7B7B7",
    fontSize: 13,
    cursor: "pointer",
  },
  divider: {
    width: 1,
    height: 17,
    margin: "0 4px",
    background: "rgba(255,255,255,.09)",
  },
  attribution: {
    marginTop: 14,
    color: "rgba(255,255,255,0.38)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 12,
    fontWeight: 500,
    fontStyle: "italic",
    letterSpacing: "0.01em",
    lineHeight: "1.35em",
  },
  editPalette: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    opacity: 0.82,
    animation: "draftControlsReveal 180ms ease both",
  },
  editPaletteDot: {
    width: 10,
    height: 10,
    padding: 0,
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 999,
    cursor: "pointer",
    transition: "opacity 180ms ease",
  },
  focusAttribution: {
    marginTop: 14,
    fontSize: 15,
  },
  archiveAttribution: {
    marginTop: 8,
    color: "rgba(255,255,255,0.42)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 12,
    fontWeight: 500,
    fontStyle: "italic",
  },
  attributionFieldWrap: {
    position: "absolute",
    zIndex: 24,
    left: 4,
    bottom: "calc(100% + 58px)",
    display: "flex",
    alignItems: "center",
    gap: 7,
    minWidth: 190,
    padding: "7px 10px",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 9,
    background: "rgba(20,20,20,0.96)",
    boxShadow: "0 10px 28px rgba(0,0,0,.28)",
    animation: "draftControlsReveal 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  attributionDash: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 13,
  },
  attributionInput: {
    width: 150,
    padding: 0,
    border: 0,
    outline: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.76)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 12,
    fontWeight: 500,
  },
  attributionToggle: {
    width: 25,
    height: 25,
    padding: 0,
    border: 0,
    borderRadius: 7,
    background: "transparent",
    color: "rgba(255,255,255,0.42)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 16,
    cursor: "pointer",
  },
  attributionToggleActive: {
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.82)",
  },
  draftActions: {
    position: "absolute",
    zIndex: 20,
    left: 4,
    right: "auto",
    bottom: "calc(100% + 10px)",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 5px",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 10,
    background: "rgba(20,20,20,.94)",
    boxShadow: "0 10px 28px rgba(0,0,0,.28)",
    animation: "draftControlsReveal 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
    transformOrigin: "left bottom",
    width: "max-content",
    maxWidth: "calc(100% - 8px)",
    boxSizing: "border-box",
  },
  draftCategoryHoverLabel: {
    position: "absolute",
    left: "50%",
    bottom: "calc(100% + 10px)",
    transform: "translateX(-50%)",
    padding: "5px 7px",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 6,
    background: "rgba(18,18,18,0.94)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.3)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "rgba(255,255,255,0.56)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: "0.06em",
    lineHeight: 1,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    animation: "categoryLabelReveal 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  inlineTools: {
    display: "flex",
    alignItems: "center",
    gap: 1,
  },
  categoryDots: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  categoryDotButton: {
    position: "relative",
    width: 25,
    height: 25,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "1px solid",
    borderRadius: 999,
    background: "rgba(17,17,17,.72)",
    cursor: "pointer",
    transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease",
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  draftMessage: {
    color: "#666",
    fontSize: 10,
    maxWidth: 110,
  },
  enterSave: {
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: 0,
    borderRadius: 8,
    background: "#F3F3F3",
    color: "#111",
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  },
  anchorThis: {
    height: 32,
    padding: "0 12px",
    border: 0,
    borderRadius: 8,
    background: "#F3F3F3",
    color: "#111",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  state: {
    width: "100%",
    minHeight: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
  },
  status: { fontSize: 12, color: "#777", marginBottom: 8 },
  undoToast: { position: "fixed", zIndex: 200, bottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28, minWidth: 250, padding: "10px 12px 10px 14px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(20,20,20,0.96)", boxShadow: "0 18px 50px rgba(0,0,0,0.42)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxSizing: "border-box" },
  undoText: { color: "rgba(255,255,255,0.72)", fontFamily: "Figtree, sans-serif", fontSize: 12, fontWeight: 500 },
  undoButton: { border: 0, padding: "6px 8px", borderRadius: 7, background: "rgba(255,255,255,0.07)", color: "#FFFFFF", fontFamily: "Figtree, sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" },
};
