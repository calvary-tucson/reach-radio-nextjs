# Sleep Timer Bridge Design

**Date:** 2026-06-25
**Scope:** Bidirectional sleep timer control between native app (CarPlay, Apple Watch, Android Auto) and web UI

## Problem

Sleep timer runs entirely in the web layer. Native surfaces (CarPlay, Apple Watch, Live Activities) cannot start, pause, resume, cancel, or modify it. Web UI cannot reflect timer state driven from native.

## Goals

- Native can start, pause, resume, cancel, and set the sleep timer
- Web UI always reflects current timer state regardless of who changed it
- Native receives enough data to display Live Activities / CarPlay / Watch countdown without per-second bridge messages
- Web pushes structural state changes (not ticks) to native

## Architecture

### Source of truth

Zustand `media-store` remains the single source of truth. All changes — from web UI or native commands — flow through store actions. Web components react to store changes automatically.

### Data flow

```
Native (CarPlay / Watch) → nativeCommand CustomEvent → BridgeInit → store action → SleepTimerProvider → postMessageToNative → Native Live Activity
                                                                                  ↘ SleepTimerSheet / SleepTimerButton / SleepTimerOverlay (web UI re-renders)
```

---

## Store Changes (`media-store.ts`)

### New fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `sleepTimerPaused` | `boolean` | `false` | Countdown frozen, timer not cancelled |
| `sleepTimerEndsAt` | `number \| null` | `null` | Unix ms; set on start/resume, null when paused/inactive |

### New / modified actions

| Action | Signature | Behavior |
|---|---|---|
| `startSleepTimer` | `(seconds: number) => void` | Sets `active=true`, `paused=false`, `remainingSeconds=seconds`, `endsAt=Date.now()+seconds*1000` |
| `pauseSleepTimer` | `() => void` | Sets `paused=true`, `endsAt=null` |
| `resumeSleepTimer` | `() => void` | Sets `paused=false`, `endsAt=Date.now()+remainingSeconds*1000` |
| `cancelSleepTimer` | `() => void` | Sets `active=false`, `paused=false`, `remainingSeconds=0`, `endsAt=null` |
| `setSleepTimer` | `(seconds: number) => void` | Sets `remainingSeconds=seconds`, recalculates `endsAt` if active and not paused |

---

## SleepTimerProvider Changes

### Tick logic

Interval dep array: `[sleepTimerActive, sleepTimerPaused]`. Interval only starts when `active && !paused`. Clears on pause, cancel, or unmount.

### Native push effect

Separate `useEffect` watches `[sleepTimerActive, sleepTimerPaused, sleepTimerEndsAt]` — NOT `remainingSleepSeconds`. Fires on structural changes only (no per-second spam):

```ts
postMessageToNative({
  sleepTimer: {
    active: sleepTimerActive,
    paused: sleepTimerPaused,
    remainingSeconds: remainingSleepSeconds,
    endsAt: sleepTimerEndsAt ? new Date(sleepTimerEndsAt).toISOString() : null,
  }
})
```

`endsAt` as ISO string lets iOS ActivityKit use the native timer style without any per-second updates from the web.

---

## BridgeInit Changes

### New NativeCommand types

```ts
| { type: 'startSleepTimer'; seconds: number }
| { type: 'pauseSleepTimer' }
| { type: 'resumeSleepTimer' }
| { type: 'cancelSleepTimer' }
| { type: 'setSleepTimer'; seconds: number }
```

### Handlers

Each maps directly to the corresponding store action:

```ts
case 'startSleepTimer': useMediaStore.getState().startSleepTimer(cmd.seconds); break
case 'pauseSleepTimer': useMediaStore.getState().pauseSleepTimer(); break
case 'resumeSleepTimer': useMediaStore.getState().resumeSleepTimer(); break
case 'cancelSleepTimer': useMediaStore.getState().cancelSleepTimer(); break
case 'setSleepTimer': useMediaStore.getState().setSleepTimer(cmd.seconds); break
```

---

## Bridge Contract Updates

### Web → Native (additions)

| Field | Type | Purpose |
|---|---|---|
| `sleepTimer.active` | `boolean` | Timer running or paused |
| `sleepTimer.paused` | `boolean` | Countdown frozen |
| `sleepTimer.remainingSeconds` | `number` | Seconds left at time of push |
| `sleepTimer.endsAt` | `string \| null` | ISO timestamp; null when paused/inactive. Use for ActivityKit timer style. |

Sent on: `startSleepTimer`, `pauseSleepTimer`, `resumeSleepTimer`, `cancelSleepTimer`, `setSleepTimer`. Not sent on every tick.

### Native → Web (additions)

| `type` | Payload | Purpose |
|---|---|---|
| `startSleepTimer` | `{ seconds: number }` | Start new timer (CarPlay / Watch preset) |
| `pauseSleepTimer` | — | Freeze countdown |
| `resumeSleepTimer` | — | Resume from frozen state |
| `cancelSleepTimer` | — | Cancel and clear |
| `setSleepTimer` | `{ seconds: number }` | Override remaining time |

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/store/media-store.ts` | Add `sleepTimerPaused`, `sleepTimerEndsAt`; add `pauseSleepTimer`, `resumeSleepTimer`, `setSleepTimer`; update `startSleepTimer`, `cancelSleepTimer` |
| `src/components/SleepTimerProvider.tsx` | Pause-aware interval; native push effect |
| `src/components/bridge/BridgeInit.tsx` | 5 new command handlers in switch |

---

## Out of Scope

- Web UI pause button (native-driven pause only for now; web UI can add it later if needed)
- Per-second native push
- Timer persistence across app restart
