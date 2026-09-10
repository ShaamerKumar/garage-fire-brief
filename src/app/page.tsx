'use client';

import { useState } from 'react';
import BriefView from '@/components/Brief';
import type { Brief, BriefResponse } from '@/lib/schema';

const SAMPLES = [
  { id: 'ChIJpcN7ecgAyIkRrOcWzZx3Yyc', label: 'Wise Avenue VFC, MD' },
  { id: 'ChIJr-yREGP9tEwRr7M-F00PpM8', label: 'Washington FD' },
];

/** Shown in sequence while one request is in flight, so the wait reads as work. */
const STAGES = [
  'Looking up the department…',
  'Searching leadership and fleet…',
  'Checking grants and budget activity…',
  'Verifying every quote against its source…',
];

function advanceStage(stage: number | null): number | null {
  if (stage === null) return stage; // the request already finished
  return Math.min(stage + 1, STAGES.length - 1);
}

export default function Home() {
  const [placeId, setPlaceId] = useState('');
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<number | null>(null);

  const loading = stage !== null;

  async function generate(id: string) {
    if (!id.trim() || loading) return;
    setError(null);
    setBrief(null);
    setStage(0);

    const ticker = setInterval(() => setStage(advanceStage), 4000);

    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: id.trim() }),
      });
      const data: BriefResponse = await res.json();
      if (!res.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : 'Something went wrong.');
      }
      setBrief(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      clearInterval(ticker);
      setStage(null);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-sm font-semibold uppercase tracking-widest text-orange-700">
            Pre-call brief
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Paste a Google Place ID for a fire department. Everything is researched live, and
            every fact links back to where it came from.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate(placeId);
          }}
          className="flex gap-2"
        >
          <input
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="ChIJpcN7ecgAyIkRrOcWzZx3Yyc"
            spellCheck={false}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={loading || !placeId.trim()}
            className="rounded-md bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {loading ? 'Researching…' : 'Generate'}
          </button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span>Try:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setPlaceId(s.id);
                generate(s.id);
              }}
              disabled={loading}
              className="rounded border border-neutral-200 bg-white px-2 py-0.5 hover:border-orange-400 hover:text-orange-700 disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-10">
          {loading && (
            <p className="animate-pulse text-sm text-neutral-500">{STAGES[stage]}</p>
          )}
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {brief && !loading && <BriefView brief={brief} />}
        </div>
      </div>
    </main>
  );
}
