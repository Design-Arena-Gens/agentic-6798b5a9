"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { loadSnippets, persistSnippets, type CommandSnippet } from "@/lib/storage";
import { CheckIcon, ClipboardIcon, FunnelIcon, HeartIcon, PencilIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";
import classNames from "classnames";

const BLANK_FORM = {
  id: "",
  title: "",
  command: "",
  category: "",
  notes: "",
  favorite: false
};

const categories = [
  "General",
  "Git",
  "Docker",
  "Networking",
  "Database",
  "Build",
  "Scripting"
];

type FormState = typeof BLANK_FORM;

const createSnippet = (form: FormState): CommandSnippet => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: form.title.trim(),
    command: form.command.trim(),
    category: form.category.trim() || "General",
    notes: form.notes.trim() || undefined,
    favorite: form.favorite,
    createdAt: now,
    updatedAt: now
  };
};

const sanitizeSnippet = (snippet: CommandSnippet, form: FormState): CommandSnippet => {
  return {
    ...snippet,
    title: form.title.trim(),
    command: form.command.trim(),
    category: form.category.trim() || "General",
    notes: form.notes.trim() || undefined,
    favorite: form.favorite,
    updatedAt: new Date().toISOString()
  };
};

type Toast = {
  id: string;
  message: string;
  tone: "success" | "neutral";
};

export function CommandVault() {
  const [snippets, setSnippets] = useState<CommandSnippet[]>([]);
  const [query, setQuery] = useState("");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setSnippets(loadSnippets());
  }, []);

  useEffect(() => {
    persistSnippets(snippets);
  }, [snippets]);

  const sortedSnippets = useMemo(() => {
    return [...snippets].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      const updatedA = new Date(a.updatedAt).getTime();
      const updatedB = new Date(b.updatedAt).getTime();
      return updatedB - updatedA;
    });
  }, [snippets]);

  const filteredSnippets = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return sortedSnippets.filter((snippet) => {
      if (filterFavorites && !snippet.favorite) {
        return false;
      }

      if (categoryFilter !== "all" && snippet.category !== categoryFilter) {
        return false;
      }

      if (!lowerQuery) {
        return true;
      }

      const haystack = [
        snippet.title,
        snippet.command,
        snippet.category,
        snippet.notes ?? ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(lowerQuery);
    });
  }, [sortedSnippets, query, filterFavorites, categoryFilter]);

  const openDialog = useCallback((snippet?: CommandSnippet) => {
    if (snippet) {
      setEditingId(snippet.id);
      setForm({
        id: snippet.id,
        title: snippet.title,
        command: snippet.command,
        category: snippet.category,
        notes: snippet.notes ?? "",
        favorite: snippet.favorite ?? false
      });
    } else {
      setEditingId(null);
      setForm(BLANK_FORM);
    }

    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setTimeout(() => {
      setForm(BLANK_FORM);
      setEditingId(null);
    }, 200);
  }, []);

  const showToast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToasts((prev) => {
      const toast = { id: crypto.randomUUID(), message, tone };
      return [...prev, toast].slice(-3);
    });
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 2400);

    return () => clearTimeout(timer);
  }, [toasts]);

  const upsertSnippet = useCallback(() => {
    if (!form.title.trim() || !form.command.trim()) {
      showToast("Title and command are required", "neutral");
      return;
    }

    setSnippets((prev) => {
      if (editingId) {
        return prev.map((item) =>
          item.id === editingId ? sanitizeSnippet(item, form) : item
        );
      }

      return [createSnippet(form), ...prev];
    });

    showToast(editingId ? "Command updated" : "Command added");
    closeDialog();
  }, [form, editingId, showToast, closeDialog]);

  const removeSnippet = useCallback(
    (id: string) => {
      setSnippets((prev) => prev.filter((item) => item.id !== id));
      showToast("Command removed", "neutral");
    },
    [showToast]
  );

  const toggleFavorite = useCallback((id: string) => {
    setSnippets((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              favorite: !item.favorite,
              updatedAt: new Date().toISOString()
            }
          : item
      )
    );
  }, []);

  const copyToClipboard = useCallback(async (snippet: CommandSnippet) => {
    try {
      setCopyingId(snippet.id);
      await navigator.clipboard.writeText(snippet.command);
      showToast("Copied to clipboard");
    } catch (error) {
      console.error("Copy failed", error);
      showToast("Copy failed", "neutral");
    } finally {
      setTimeout(() => setCopyingId(null), 800);
    }
  }, [showToast]);

  const derivedCategories = useMemo(() => {
    const set = new Set(["General", ...categories]);
    snippets.forEach((snippet) => set.add(snippet.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [snippets]);

  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Command Vault</h1>
          <p className="mt-1 text-sm text-slate-400">
            Store battle-tested commands, keep them organized, and copy them in a click.
          </p>
        </div>
        <button
          onClick={() => openDialog()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
        >
          <PlusIcon className="h-5 w-5" />
          New command
        </button>
      </div>

      <div className="mt-8 grid gap-4 rounded-xl border border-slate-800 bg-midnight-800/60 p-5 backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, commands, notes..."
              className="w-full rounded-lg border border-slate-700 bg-midnight-700/60 px-3 py-2 text-sm placeholder:text-slate-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-midnight-700/60 px-3 py-2 text-sm"
            >
              <option value="all">All categories</option>
              {derivedCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-midnight-700/60 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-slate-400" />
              Favorites only
            </div>
            <input
              type="checkbox"
              checked={filterFavorites}
              onChange={(event) => setFilterFavorites(event.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {filteredSnippets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-midnight-800/40 p-10 text-center text-slate-400">
            <p className="text-sm">No commands found. Store your go-to commands to access them instantly.</p>
            <button
              onClick={() => openDialog()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/60 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10"
            >
              <PlusIcon className="h-4 w-4" />
              Create your first command
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredSnippets.map((snippet) => (
              <li
                key={snippet.id}
                className="group rounded-xl border border-slate-800 bg-midnight-800/60 p-4 transition hover:border-emerald-500/60 hover:bg-midnight-700/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-medium">{snippet.title}</h2>
                      {snippet.favorite ? (
                        <HeartIcon className="h-5 w-5 text-emerald-400" />
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      {snippet.category} · Updated {new Date(snippet.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite(snippet.id)}
                      className={classNames(
                        "inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition",
                        snippet.favorite
                          ? "border-emerald-500/80 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-700 text-slate-300 hover:border-emerald-500/60 hover:text-emerald-300"
                      )}
                    >
                      <HeartIcon className="h-3.5 w-3.5" />
                      Favorite
                    </button>
                    <button
                      onClick={() => openDialog(snippet)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-500/60 hover:text-emerald-300"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => removeSnippet(snippet.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/10"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Delete
                    </button>
                    <button
                      onClick={() => copyToClipboard(snippet)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-medium text-black transition hover:bg-emerald-400"
                    >
                      {copyingId === snippet.id ? (
                        <CheckIcon className="h-3.5 w-3.5" />
                      ) : (
                        <ClipboardIcon className="h-3.5 w-3.5" />
                      )}
                      {copyingId === snippet.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-800 bg-black/40 p-3 text-sm text-emerald-200">
                  {snippet.command}
                </pre>
                {snippet.notes ? (
                  <p className="mt-2 text-sm text-slate-300">{snippet.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Transition show={isDialogOpen} as={Fragment}>
        <Dialog onClose={closeDialog} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center px-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-xl rounded-2xl border border-slate-700 bg-midnight-800/90 p-6 shadow-xl">
                <Dialog.Title className="text-lg font-medium text-slate-100">
                  {editingId ? "Edit command" : "Add command"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-slate-400">
                  Keep your go-to commands organized with categories, notes, and favorites.
                </Dialog.Description>

                <form
                  className="mt-6 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    upsertSnippet();
                  }}
                >
                  <label className="block text-sm">
                    <span className="text-slate-300">Title</span>
                    <input
                      value={form.title}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      required
                      placeholder="Deploy frontend to production"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-midnight-700/60 px-3 py-2 text-sm placeholder:text-slate-500"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="text-slate-300">Command</span>
                    <textarea
                      value={form.command}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, command: event.target.value }))
                      }
                      required
                      rows={4}
                      placeholder="git push origin main"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-midnight-700/60 px-3 py-2 text-sm placeholder:text-slate-500"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="text-slate-300">Category</span>
                      <input
                        list="categories"
                        value={form.category}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, category: event.target.value }))
                        }
                        placeholder="Git"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-midnight-700/60 px-3 py-2 text-sm placeholder:text-slate-500"
                      />
                      <datalist id="categories">
                        {derivedCategories.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                    </label>

                    <label className="block text-sm">
                      <span className="text-slate-300">Favorite</span>
                      <div className="mt-2 inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.favorite}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, favorite: event.target.checked }))
                          }
                          className="h-5 w-5 accent-emerald-500"
                        />
                        <span className="text-xs text-slate-400">
                          Pin this command to the top of your list.
                        </span>
                      </div>
                    </label>
                  </div>

                  <label className="block text-sm">
                    <span className="text-slate-300">Notes</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      rows={2}
                      placeholder="Requires VPN before running"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-midnight-700/60 px-3 py-2 text-sm placeholder:text-slate-500"
                    />
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-4">
                    <button
                      type="button"
                      onClick={closeDialog}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
                    >
                      {editingId ? "Save changes" : "Add command"}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
        <div className="flex w-full max-w-md flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={classNames(
                "pointer-events-auto rounded-lg border px-4 py-2 text-sm shadow",
                toast.tone === "success"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  : "border-slate-700 bg-midnight-700/80 text-slate-200"
              )}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
