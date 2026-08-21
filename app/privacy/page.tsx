"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { deleteAllData, deleteScan, listScans } from "@/lib/store/auraStore";
import { track } from "@/lib/analytics/events";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useRefresh } from "@/lib/hooks/useRefresh";

export default function PrivacyPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [, refresh] = useRefresh();
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);

  const scans = hydrated ? listScans() : [];

  function handleDeleteScan(id: string) {
    deleteScan(id);
    track("scan_deleted", { scanId: id });
    refresh();
  }

  function handleDeleteAll() {
    track("account_deleted");
    deleteAllData();
    router.push("/");
  }

  if (!hydrated) return null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-5 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Privacy &amp; Data Controls</h1>
        <p className="mt-2 text-sm text-muted">
          In this prototype, your photos and scan data are stored only on this device (browser local storage) —
          nothing is uploaded to a server yet. You can delete any individual scan or everything at once.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">Your scans</h2>
        {scans.length === 0 ? (
          <Card className="text-sm text-muted">No scans stored.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {[...scans].reverse().map((s) => (
              <Card key={s.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {s.scanType === "baseline" ? "Baseline scan" : "Rescan"} · {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                  <Badge>{s.status}</Badge>
                </div>
                <button onClick={() => handleDeleteScan(s.id)} className="text-xs text-danger hover:underline">
                  Delete
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="flex flex-col gap-3 border-danger/30">
        <h2 className="font-medium text-danger">Delete everything</h2>
        <p className="text-sm text-muted">
          Permanently deletes all your scans, photos, missions, and account data from this device. This cannot be
          undone.
        </p>
        {!confirmingDeleteAll ? (
          <Button variant="danger" onClick={() => setConfirmingDeleteAll(true)}>
            Delete all my data
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="danger" onClick={handleDeleteAll}>
              Yes, delete everything
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDeleteAll(false)}>
              Cancel
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
