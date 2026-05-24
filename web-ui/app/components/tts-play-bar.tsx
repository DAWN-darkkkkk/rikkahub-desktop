/**
 * Floating play-bar for the chunked TtsController. Mirrors the Android compact player:
 * a fixed-position pill at the bottom of the chat view with:
 *   - chunk progress (M / N)
 *   - position / duration of the CURRENT chunk
 *   - pause / resume / stop / -5s / +5s / speed cycle
 *
 * Shown only when ttsController is mid-session (status != Idle/Ended). Subscribes via
 * useTtsPlaybackState so the bar tracks chunk advances and speed/seek updates live.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight, Gauge, Pause, Play, Square } from "lucide-react";

import { ttsController, useTtsPlaybackState } from "~/lib/tts/tts-controller";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const SPEED_CYCLE = [0.75, 1.0, 1.25, 1.5, 2.0] as const;

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TtsPlayBar() {
  const state = useTtsPlaybackState();
  const visible = state.status !== "Idle" && state.status !== "Ended";

  if (!visible) return null;

  const totalChunks = Math.max(1, state.totalChunks);
  const currentChunk = Math.max(1, Math.min(state.currentChunkIndex, totalChunks));
  // Overall progress = (chunks already played + fraction of current chunk played).
  const chunkFraction = state.durationMs > 0 ? Math.min(1, state.positionMs / state.durationMs) : 0;
  const overallProgress = ((currentChunk - 1) + chunkFraction) / totalChunks;
  const overallPercent = Math.round(overallProgress * 100);
  const innerPercent = Math.round(chunkFraction * 100);

  const isPlaying = state.status === "Playing";
  const isPaused = state.status === "Paused";
  const isBuffering = state.status === "Buffering";

  const togglePlayPause = () => {
    if (isPlaying || isBuffering) ttsController.pause();
    else if (isPaused) ttsController.resume();
  };

  const cycleSpeed = () => {
    const currentIdx = SPEED_CYCLE.findIndex((s) => Math.abs(s - state.speed) < 0.01);
    const next = SPEED_CYCLE[(currentIdx + 1) % SPEED_CYCLE.length];
    ttsController.setSpeed(next);
  };

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur">
        {/* Concentric progress rings: outer = overall progress across all chunks,
            inner = position within the current chunk. SVG so we can stack two arcs cheaply. */}
        <div className="relative flex size-9 shrink-0 items-center justify-center" title={`整体 ${overallPercent}% · 本段 ${innerPercent}%`}>
          <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
            {/* Outer ring track */}
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40" />
            {/* Outer ring progress — overall */}
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 15}`}
              strokeDashoffset={`${2 * Math.PI * 15 * (1 - overallProgress)}`}
              strokeLinecap="round"
              className="text-primary transition-[stroke-dashoffset] duration-200"
            />
            {/* Inner ring track */}
            <circle cx="18" cy="18" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/30" />
            {/* Inner ring progress — current chunk */}
            <circle
              cx="18" cy="18" r="10" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 10}`}
              strokeDashoffset={`${2 * Math.PI * 10 * (1 - chunkFraction)}`}
              strokeLinecap="round"
              className="text-foreground/70 transition-[stroke-dashoffset] duration-150"
            />
          </svg>
          <span className="absolute text-[10px] font-medium tabular-nums leading-none">
            {currentChunk}/{totalChunks}
          </span>
        </div>

        <div className="flex flex-col leading-tight">
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {formatMs(state.positionMs)} / {formatMs(state.durationMs)}
          </div>
          <div className={cn("text-[10px]", state.errorMessage ? "text-red-500" : "text-muted-foreground/80")}>
            {state.errorMessage ?? (isBuffering ? "合成中…" : isPaused ? "已暂停" : "朗读中")}
          </div>
        </div>

        <div className="ml-1 flex items-center gap-0.5">
          <Button size="icon-xs" variant="ghost" onClick={() => ttsController.seekBy(-5_000)} title="后退 5 秒">
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={togglePlayPause} title={isPlaying || isBuffering ? "暂停" : "继续"}>
            {isPlaying || isBuffering ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={() => ttsController.seekBy(5_000)} title="前进 5 秒">
            <ChevronRight className="size-3.5" />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={cycleSpeed} title={`当前 ${state.speed}× · 点击切换`}>
            <Gauge className="size-3.5" />
            <span className="ml-0.5 text-[9px] tabular-nums">{state.speed}x</span>
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={() => ttsController.stop()} title="停止">
            <Square className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
