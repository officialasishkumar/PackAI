"use client";

import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import Link from "next/link";

import { getErrorMessage, getTrip, updateTripItems } from "@/lib/api";
import { cacheTrip, getCachedTrip } from "@/lib/offline-cache";
import {
  CATEGORIES,
  Trip,
  TripCategory,
  TripItem,
  WorkspaceMode,
  countPackedItems,
  countTotalUnits,
  deriveTripStatus,
  deriveWorkspaceMode,
} from "@/lib/types";

import styles from "./trip-workspace.module.css";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function TripWorkspace({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<TripItem[]>([]);
  const [mode, setMode] = useState<WorkspaceMode>("packing");
  const [search, setSearch] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<TripCategory>("Misc");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const currentStatus = deriveTripStatus(mode, items);
  const isDirty = Boolean(
    trip &&
      (JSON.stringify(items) !== JSON.stringify(trip.items) ||
        currentStatus !== trip.status),
  );

  useEffect(() => {
    let cancelled = false;
    const cachedTrip = getCachedTrip(tripId);

    if (cachedTrip) {
      hydrateWorkspace(cachedTrip, setTrip, setItems, setMode);
      setSyncNotice("Showing your locally cached checklist while PackSnap refreshes.");
    }

    async function load() {
      try {
        const remoteTrip = await getTrip(tripId);
        if (cancelled) {
          return;
        }

        hydrateWorkspace(remoteTrip, setTrip, setItems, setMode);
        cacheTrip(remoteTrip);
        setLoadingError(null);
        setSyncNotice(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (cachedTrip) {
          setLoadingError(null);
          setSyncNotice("Offline mode: using the last checklist stored on this device.");
        } else {
          setLoadingError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  async function handleSave(): Promise<void> {
    if (!trip) {
      return;
    }

    setIsSaving(true);
    setLoadingError(null);

    try {
      const updatedTrip = await updateTripItems(tripId, {
        items,
        status: currentStatus,
      });
      hydrateWorkspace(updatedTrip, setTrip, setItems, setMode);
      cacheTrip(updatedTrip);
      setSyncNotice(`Saved ${DATE_FORMATTER.format(new Date())}.`);
    } catch (error) {
      cacheTrip({
        ...trip,
        items,
        status: currentStatus,
        updated_at: new Date().toISOString(),
      });
      setLoadingError(getErrorMessage(error));
      setSyncNotice("Changes were kept locally on this device. Retry syncing when online.");
    } finally {
      setIsSaving(false);
    }
  }

  function addItem(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const name = newItemName.trim();
    if (!name) {
      return;
    }

    setItems((current) => [
      ...current,
      {
        item_id: crypto.randomUUID(),
        name,
        category: newItemCategory,
        quantity: Math.max(1, newItemQuantity),
        is_packed_for_return: false,
        added_by: "manual",
      },
    ]);
    setNewItemName("");
    setNewItemQuantity(1);
    setSyncNotice(null);
  }

  function removeItem(itemId: string): void {
    setItems((current) => current.filter((item) => item.item_id !== itemId));
    setSyncNotice(null);
  }

  function updateItem(
    itemId: string,
    patch: Partial<TripItem>,
  ): void {
    setItems((current) =>
      current.map((item) =>
        item.item_id === itemId ? { ...item, ...patch } : item,
      ),
    );
    setSyncNotice(null);
  }

  const query = deferredSearch.trim().toLowerCase();
  const visibleItems = items.filter((item) => {
    if (!query) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });

  const groupedItems = CATEGORIES.map((category) => ({
    category,
    items: visibleItems.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  if (isLoading && !trip) {
    return (
      <main className={styles.page}>
        <section className={styles.loading}>
          <p className={styles.kicker}>Loading trip</p>
          <h1>Hydrating your checklist…</h1>
        </section>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className={styles.page}>
        <section className={styles.errorState}>
          <p className={styles.kicker}>Trip unavailable</p>
          <h1>{loadingError ?? "This trip could not be loaded."}</h1>
          <Link href="/" className={styles.backLink}>
            Back to trip creation
          </Link>
        </section>
      </main>
    );
  }

  const packedCount = countPackedItems(items);
  const totalUnits = countTotalUnits(items);
  const completion = items.length
    ? Math.round((packedCount / items.length) * 100)
    : 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/" className={styles.backLink}>
            New trip
          </Link>
          <p className={styles.kicker}>Trip workspace</p>
          <h1>{trip.trip_name}</h1>
          <p className={styles.meta}>
            Created {DATE_FORMATTER.format(new Date(trip.created_at))} · Status{" "}
            <span className={styles.status}>{currentStatus.replace("_", " ")}</span>
          </p>
        </div>

        <button
          className={styles.saveButton}
          type="button"
          disabled={isSaving || !isDirty}
          onClick={handleSave}
        >
          {isSaving ? "Saving..." : isDirty ? "Save changes" : "Saved"}
        </button>
      </header>

      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.panel}>
            <p className={styles.panelLabel}>Modes</p>
            <div className={styles.modeSwitch}>
              <button
                className={mode === "packing" ? styles.modeActive : ""}
                type="button"
                onClick={() => setMode("packing")}
              >
                Packing
              </button>
              <button
                className={mode === "repacking" ? styles.modeActive : ""}
                type="button"
                onClick={() => setMode("repacking")}
              >
                Repacking
              </button>
            </div>
            <p className={styles.panelCopy}>
              Packing mode is for cleanup and manual corrections. Repacking mode
              turns the list into the return-trip check-off flow.
            </p>
          </div>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span>Distinct items</span>
              <strong>{items.length}</strong>
            </article>
            <article className={styles.statCard}>
              <span>Total units</span>
              <strong>{totalUnits}</strong>
            </article>
            <article className={styles.statCard}>
              <span>Checked for return</span>
              <strong>{packedCount}</strong>
            </article>
            <article className={styles.statCard}>
              <span>Completion</span>
              <strong>{completion}%</strong>
            </article>
          </div>

          <div className={styles.panel}>
            <label className={styles.searchField}>
              <span>Search items</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Passport, charger, shirt..."
              />
            </label>
            <form className={styles.addForm} onSubmit={addItem}>
              <p className={styles.panelLabel}>Manual add</p>
              <input
                value={newItemName}
                onChange={(event) => setNewItemName(event.target.value)}
                placeholder="Item name"
              />
              <div className={styles.addRow}>
                <select
                  value={newItemCategory}
                  onChange={(event) =>
                    setNewItemCategory(event.target.value as TripCategory)
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={newItemQuantity}
                  onChange={(event) =>
                    setNewItemQuantity(
                      Math.max(1, Number.parseInt(event.target.value || "1", 10)),
                    )
                  }
                />
              </div>
              <button type="submit">Add item</button>
            </form>
          </div>

          {(syncNotice || loadingError) && (
            <div className={styles.notice}>
              {syncNotice ? <p>{syncNotice}</p> : null}
              {loadingError ? <p>{loadingError}</p> : null}
            </div>
          )}
        </aside>

        <section className={styles.board}>
          {groupedItems.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No matching items</h2>
              <p>Try a broader search or add the missing item manually.</p>
            </div>
          ) : (
            groupedItems.map((group) => (
              <article className={styles.group} key={group.category}>
                <header className={styles.groupHeader}>
                  <h2>{group.category}</h2>
                  <span>{group.items.length} items</span>
                </header>

                <div className={styles.groupList}>
                  {group.items.map((item) =>
                    mode === "packing" ? (
                      <div className={styles.editRow} key={item.item_id}>
                        <div className={styles.editMain}>
                          <input
                            value={item.name}
                            onChange={(event) =>
                              updateItem(item.item_id, { name: event.target.value })
                            }
                            aria-label={`Edit ${item.name}`}
                          />
                          <div className={styles.editMeta}>
                            <select
                              value={item.category}
                              onChange={(event) =>
                                updateItem(item.item_id, {
                                  category: event.target.value as TripCategory,
                                })
                              }
                            >
                              {CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(item.item_id, {
                                  quantity: Math.max(
                                    1,
                                    Number.parseInt(event.target.value || "1", 10),
                                  ),
                                })
                              }
                            />
                            <span className={styles.originBadge}>{item.added_by}</span>
                          </div>
                        </div>
                        <button
                          className={styles.deleteButton}
                          type="button"
                          onClick={() => removeItem(item.item_id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        className={`${styles.checkRow} ${
                          item.is_packed_for_return ? styles.checkRowDone : ""
                        }`}
                        key={item.item_id}
                        type="button"
                        onClick={() =>
                          updateItem(item.item_id, {
                            is_packed_for_return: !item.is_packed_for_return,
                          })
                        }
                      >
                        <span className={styles.checkMark}>
                          {item.is_packed_for_return ? "✓" : ""}
                        </span>
                        <span className={styles.checkContent}>
                          <strong>{item.name}</strong>
                          <small>
                            Qty {item.quantity} · {item.added_by}
                          </small>
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

function hydrateWorkspace(
  trip: Trip,
  setTrip: Dispatch<SetStateAction<Trip | null>>,
  setItems: Dispatch<SetStateAction<TripItem[]>>,
  setMode: Dispatch<SetStateAction<WorkspaceMode>>,
): void {
  setTrip(trip);
  setItems(trip.items);
  setMode(deriveWorkspaceMode(trip.status));
}
