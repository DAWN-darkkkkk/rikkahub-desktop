/**
 * PC port of speech/src/main/java/me/rerere/tts/controller/TtsController.kt.
 *
 * Same product behavior as Android:
 *   - text is sliced via TextChunker (≤160 chars per chunk)
 *   - chunks are enqueued; a worker pulls one at a time, synthesizes via /api/tts/speech,
 *     plays the returned audio blob, then advances to the next
 *   - pause/resume/stop/skipNext/seekBy/setSpeed all controllable from UI
 *   - the next `prefetchCount` chunks are synthesized in parallel ahead of the playhead
 *     so the play queue stays primed (no audible gap between chunks)
 *   - a stable per-chunk cache (id → Promise<Blob>) lets us reuse already-synthesized audio
 *     if the user pauses and resumes mid-session, AND avoids re-billing the API for the
 *     same text. The big difference vs the old PC impl: if the user only listens to 1/10
 *     chunks then stops, the API was only billed for 1/10 of the text (plus prefetched
 *     ones already in-flight). The old "send the whole message in one shot" path billed
 *     for the whole thing regardless.
 *
 * Translation notes (Kotlin → TypeScript):
 *   - StateFlow → tiny pub/sub subscribe()
 *   - Job (Kotlin coroutine) → an async loop guarded by `cancelRequested` + currentSessionId
 *     equality check; AbortController would also work but the polling-style cancel here
 *     keeps the code closer to the Kotlin shape (collectLatest + isActive)
 *   - kotlinx.coroutines.delay → setTimeout/Promise
 *   - Dispatchers.IO → just an async function (the synthesis fetch is naturally async)
 *   - audio playback uses HTMLAudioElement; speed/seek hooks straight into it
 *
 * One singleton per page — that's the same "app-scope TtsController" Android keeps in
 * LocalTTSState.
 */

import type { PlaybackState, PlaybackStatus } from "./playback-state";
import { initialPlaybackState } from "./playback-state";
import { TextChunker, type TtsChunk } from "./text-chunker";
import { appendWebAuthQuery } from "~/services/api";

const PREFETCH_COUNT = 4;
const CHUNK_DELAY_MS = 120; // tiny breather between chunks, matches Android's chunkDelayMs

type Subscriber = (state: PlaybackState) => void;

interface PendingSynthesis {
  promise: Promise<Blob>;
  abort: AbortController;
}

class TtsControllerImpl {
  private readonly chunker = new TextChunker(160);

  /** Audio element used to actually emit sound. Recreated per chunk to avoid stale events. */
  private audio: HTMLAudioElement | null = null;

  /** Current paused state — controls the worker loop. */
  private isPaused = false;

  /** Pending queue (chunks not yet pulled by the worker). FIFO. */
  private queue: TtsChunk[] = [];

  /** All chunks in this session — used by prefetch to know what's coming. */
  private allChunks: TtsChunk[] = [];

  /** Cache: chunk.id → in-flight or settled synthesis. Survives pause/resume. */
  private cache = new Map<string, PendingSynthesis>();

  /** Last index we've already prefetched up through. */
  private lastPrefetchedIndex = -1;

  /** Bumps every speak(flush=true). Stale workers from a previous session detect this and exit. */
  private currentSessionId: string | null = null;

  /** True while a worker loop is running. */
  private workerRunning = false;

  /** Subscribers for state updates. */
  private subscribers = new Set<Subscriber>();

  /** Latest published state. Read synchronously by getState(); pushed via notify(). */
  private state: PlaybackState = { ...initialPlaybackState };

  // ── public API ───────────────────────────────────────────────────────────

  getState(): PlaybackState {
    return this.state;
  }

  subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);
    listener(this.state);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Speak `text`. With flush=true (the default) wipes any in-progress session and starts
   * a fresh one; with flush=false appends to the current queue (Android calls this from
   * the "继续朗读下一条" flow but PC doesn't expose that yet).
   *
   * `ownerKey` is opaque; the UI uses it to figure out "is THIS message the one currently
   * being played" (compared against state.ownerKey).
   */
  speak(text: string, ownerKey: string | null = null, flush = true) {
    if (!text.trim()) return;

    const newChunks = this.chunker.split(text);
    if (newChunks.length === 0) return;

    if (flush) {
      this.internalReset();
      const sessionId = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.currentSessionId = sessionId;
      this.allChunks = [...newChunks];
      this.queue = [...newChunks];
      this.updateState({
        status: "Buffering",
        currentChunkIndex: 0,
        totalChunks: newChunks.length,
        positionMs: 0,
        durationMs: 0,
        errorMessage: null,
        sessionId,
        ownerKey,
      });
    } else {
      const startIndex = (this.allChunks[this.allChunks.length - 1]?.index ?? -1) + 1;
      const remapped = newChunks.map((c, i) => ({ ...c, index: startIndex + i }));
      this.allChunks.push(...remapped);
      this.queue.push(...remapped);
      this.updateState({ totalChunks: this.state.totalChunks + remapped.length });
    }

    // Kick off prefetch immediately and start the worker if it isn't already running.
    this.prefetchFrom(this.state.currentChunkIndex);
    if (!this.workerRunning) {
      void this.runWorker();
    }
  }

  pause() {
    if (this.state.status !== "Playing" && this.state.status !== "Buffering") return;
    this.isPaused = true;
    this.audio?.pause();
    this.updateState({ status: "Paused" });
  }

  resume() {
    if (this.state.status !== "Paused") return;
    this.isPaused = false;
    this.audio?.play().catch(() => { /* ignore — onerror handler will surface it */ });
    this.updateState({ status: "Playing" });
  }

  /** Stops + clears all session state. The play-bar disappears. */
  stop() {
    this.internalReset();
  }

  /** Skip to next chunk. Doesn't interrupt the currently-playing one. */
  skipNext() {
    if (this.queue.length === 0) return;
    this.queue.shift();
    // totalChunks DOES include "just played", so we don't decrement it here — Android keeps
    // the same semantics (totalChunks reflects the originally-loaded count).
  }

  /** Seek by ms within the current chunk. Negative goes back. */
  seekBy(ms: number) {
    if (!this.audio) return;
    const next = Math.max(0, this.audio.currentTime + ms / 1000);
    this.audio.currentTime = next;
  }

  /** Playback speed multiplier (0.5..3.0). */
  setSpeed(speed: number) {
    const clamped = Math.max(0.25, Math.min(4.0, speed));
    if (this.audio) this.audio.playbackRate = clamped;
    this.updateState({ speed: clamped });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private internalReset() {
    // Stop audio first so the onended/onerror handlers don't push stale state.
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.ontimeupdate = null;
      this.audio.onloadedmetadata = null;
      try { this.audio.pause(); } catch { /* ignore */ }
      this.audio.src = "";
      this.audio = null;
    }
    this.isPaused = false;
    this.queue = [];
    this.allChunks = [];
    for (const pending of this.cache.values()) {
      try { pending.abort.abort(); } catch { /* ignore */ }
    }
    this.cache.clear();
    this.lastPrefetchedIndex = -1;
    this.currentSessionId = null;
    this.workerRunning = false;
    this.state = { ...initialPlaybackState };
    this.notify();
  }

  private updateState(patch: Partial<PlaybackState>) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify() {
    for (const subscriber of Array.from(this.subscribers)) {
      try { subscriber(this.state); } catch { /* ignore subscriber errors */ }
    }
  }

  /** Synthesize chunks [start, start+PREFETCH_COUNT) in parallel. Caches by chunk.id. */
  private prefetchFrom(startIndex: number) {
    const begin = Math.max(startIndex, this.lastPrefetchedIndex + 1);
    const endExclusive = Math.min(begin + PREFETCH_COUNT, this.allChunks.length);
    if (begin >= endExclusive) return;

    for (let i = begin; i < endExclusive; i += 1) {
      const chunk = this.allChunks[i];
      if (!chunk) continue;
      if (this.cache.has(chunk.id)) continue;
      this.cache.set(chunk.id, this.synthesizeChunk(chunk));
    }
    this.lastPrefetchedIndex = endExclusive - 1;
  }

  /**
   * Fire the /api/tts/speech call for a single chunk. Returns the audio Blob. The
   * AbortController is used by internalReset() to cancel in-flight requests when the user
   * presses stop, so the API isn't billed for chunks we no longer need.
   */
  private synthesizeChunk(chunk: TtsChunk): PendingSynthesis {
    const abort = new AbortController();
    const promise = (async () => {
      const response = await fetch(appendWebAuthQuery("/api/tts/speech"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk.text }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`TTS synthesis failed: ${response.status} ${text.slice(0, 200)}`);
      }
      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        // System TTS path — the server already played the audio on-device; no blob to play.
        // We treat this as an "empty" chunk and skip playback.
        return new Blob([], { type: "audio/silence-marker" });
      }
      return await response.blob();
    })();
    return { promise, abort };
  }

  /** The main loop: dequeue → await synthesis → play → wait for end → repeat. */
  private async runWorker() {
    if (this.workerRunning) return;
    this.workerRunning = true;
    const sessionId = this.currentSessionId;
    let processedCount = this.state.currentChunkIndex;
    try {
      while (true) {
        // Session-id check — if reset() was called we abandon the loop.
        if (sessionId !== this.currentSessionId) break;
        if (this.isPaused) {
          await delay(80);
          continue;
        }
        const chunk = this.queue.shift();
        if (!chunk) break;

        processedCount += 1;
        this.updateState({
          currentChunkIndex: processedCount,
          // totalChunks stays at the initial total (Android matches: totalChunks doesn't
          // shrink as chunks are consumed; the play-bar shows "5 / 12" meaning chunk 5 of 12).
          status: this.state.status === "Paused" ? "Paused" : "Buffering",
        });

        // Trigger prefetch for the next window.
        this.prefetchFrom(chunk.index + 1);

        let blob: Blob;
        try {
          blob = await this.awaitOrCreate(chunk);
        } catch (err) {
          if (sessionId !== this.currentSessionId) break;
          const msg = err instanceof Error ? err.message : String(err);
          this.updateState({ status: "Error", errorMessage: msg });
          continue;
        }

        if (sessionId !== this.currentSessionId) break;

        // System-TTS empty-marker blob: server already spoke on-device, skip playback.
        if (blob.type === "audio/silence-marker") {
          if (this.queue.length > 0) await delay(CHUNK_DELAY_MS);
          continue;
        }

        try {
          await this.playBlob(blob);
        } catch (err) {
          if (sessionId !== this.currentSessionId) break;
          const msg = err instanceof Error ? err.message : String(err);
          this.updateState({ status: "Error", errorMessage: msg });
        }

        if (this.queue.length > 0) await delay(CHUNK_DELAY_MS);
      }
    } finally {
      this.workerRunning = false;
      if (sessionId === this.currentSessionId && this.queue.length === 0) {
        // Natural end-of-queue.
        this.updateState({ status: "Ended" });
        // Auto-clear after a short delay so the play-bar fades out.
        setTimeout(() => {
          if (this.state.status === "Ended" && sessionId === this.currentSessionId) {
            this.internalReset();
          }
        }, 800);
      }
    }
  }

  private async awaitOrCreate(chunk: TtsChunk): Promise<Blob> {
    let pending = this.cache.get(chunk.id);
    if (!pending) {
      pending = this.synthesizeChunk(chunk);
      this.cache.set(chunk.id, pending);
    }
    return await pending.promise;
  }

  /** Play a single chunk's audio blob; resolves when it finishes (or rejects on error). */
  private playBlob(blob: Blob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = this.state.speed;
      this.audio = audio;

      audio.onloadedmetadata = () => {
        if (this.audio === audio) {
          this.updateState({ durationMs: Number.isFinite(audio.duration) ? audio.duration * 1000 : 0, positionMs: 0 });
        }
      };
      audio.ontimeupdate = () => {
        if (this.audio === audio) {
          this.updateState({ positionMs: audio.currentTime * 1000 });
        }
      };
      audio.onended = () => {
        if (this.audio === audio) {
          URL.revokeObjectURL(url);
          this.audio = null;
          resolve();
        }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (this.audio === audio) this.audio = null;
        reject(new Error("Audio playback error"));
      };

      // Push the Playing state right before calling play() so the UI is in sync.
      this.updateState({ status: "Playing" });
      audio.play().catch((err) => {
        URL.revokeObjectURL(url);
        if (this.audio === audio) this.audio = null;
        reject(err);
      });
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One singleton per page. Mirrors Android's app-scope `LocalTTSState` / single
// `TtsController` injected by Koin.
export const ttsController = new TtsControllerImpl();

// React subscription hook — usable from any component that wants to render the play bar
// or react to the "is THIS message the one playing" check.
import * as React from "react";

export function useTtsPlaybackState(): PlaybackState {
  const [state, setState] = React.useState<PlaybackState>(() => ttsController.getState());
  React.useEffect(() => {
    return ttsController.subscribe(setState);
  }, []);
  return state;
}

export function useIsTtsActiveForKey(key: string | null): boolean {
  const state = useTtsPlaybackState();
  if (!key) return false;
  return state.ownerKey === key && state.status !== "Idle" && state.status !== "Ended";
}
