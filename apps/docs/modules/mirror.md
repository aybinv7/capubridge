# Screen Mirror

Stream the device screen directly to the Capubridge window. High FPS, low latency, with pause and quality controls. The mirror can also open in a **detached window**.

## Opening mirror

Click **Mirror** in the sidebar to open the mirror panel. The stream starts automatically.![Screenshot showing the mirror panel with live device screen and controls]

## Stream controls

| Control       | Description              |
| ------------- | ------------------------ |
| **Pause**     | Pause the stream         |
| **Quality**   | Adjust quality (bitrate) |
| **FPS**       | Target FPS (5–60)        |
| **Rotate**    | Rotate 90°               |
| **Screencap** | Take a screenshot        |

## Quality settings

| Preset            | Resolution | Bitrate | FPS |
| ----------------- | ---------- | ------- | --- |
| **High**          | Native     | 8 Mbps  | 30  |
| **Medium**        | 720p       | 4 Mbps  | 20  |
| **Low**           | 480p       | 2 Mbps  | 15  |
| **Battery saver** | 480p       | 1 Mbps  | 10  |

## Detached window

Click **Pop out** to open the mirror in a separate Tauri window:![Screenshot showing the detached mirror window]
The detached window has its own title bar and compact rail. It can be resized independently of the main window.

## Mirror in the dock

When the **bottom dock** is open and Mirror is requested, the mirror opens **above the dock** as a right-side overlay. If the window is narrow (<1200px), it opens as a detached window instead.

## How it works

Mirror uses **scrcpy** (screen copy) under the hood — a native screen streaming protocol that mirrors the device at high FPS with low overhead. The session runtime manages the mirror lease: when you close the mirror or navigate away, the lease is stopped and the scrcpy process is terminated.
