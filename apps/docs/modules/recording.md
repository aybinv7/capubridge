# Recording & Replay

Record user sessions (DOM events, network, performance) and replay them later for debugging and sharing. Session recordings capture everything that happened — every click, every network request, every performance metric.

## Recording

### Starting a recording

1. Click **Record** in the Recording module toolbar
2. Or use the floating **Recording Button** in the module
3. A red dot appears to indicate recording is active

### Recording configuration

Click the **Config** button before starting:![Screenshot showing the recording configuration modal]
Configure what to record:

- **rrweb events** — DOM mutations, interactions, console logs
- **Network** — HTTP requests and responses
- **Performance** — frame rate, memory, CPU
- **Storage changes** — IndexedDB mutations

### During recording

The floating button shows a timer and a red dot. Click **Stop** to end the recording.

### Saving

After stopping, you can:

- **Save** — name the recording and save to disk
- **Discard** — delete without saving

## Replay

Open a saved recording and replay it in the UI. The replay shows the exact user session in a timeline view.

### Timeline

The replay timeline has 4 lanes:![Screenshot showing the replay timeline with 4 lanes — Session, Network, Performance, and Console]
| Lane | Description |
|------|-------------|
| **Session** | rrweb event markers |
| **Network** | Network request indicators |
| **Performance** | Frame rate, memory metrics |
| **Console** | Console log markers |

### Playback controls

| Control           | Action                 |
| ----------------- | ---------------------- |
| **Play/Pause**    | Toggle playback        |
| **Speed**         | 0.5x, 1x, 2x, 4x       |
| **Seek**          | Drag the playhead      |
| **Jump to event** | Click a marker to jump |

### Panels during replay

During replay, you can open:

- **Network panel** — inspect requests at any point in time
- **Elements panel** — see the DOM state at any point in time
  These panels show the state at the current replay time, not the live target state.
