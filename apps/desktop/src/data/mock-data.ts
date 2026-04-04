export const devices = [
  {
    id: "R5CR30LHXXY",
    model: "Samsung Galaxy S23",
    androidVersion: "14",
    apiLevel: 34,
    battery: 87,
    status: "online" as const,
    connection: "USB" as const,
    ip: "192.168.1.42",
    resolution: "2340×1080",
    cpu: "Snapdragon 8 Gen 2",
    ram: "8 GB",
    storage: "128 GB (42 GB free)",
  },
  {
    id: "emulator-5554",
    model: "Pixel 7 API 34",
    androidVersion: "14",
    apiLevel: 34,
    battery: 100,
    status: "online" as const,
    connection: "Emulator" as const,
    ip: "10.0.2.15",
    resolution: "2400×1080",
    cpu: "x86_64",
    ram: "4 GB",
    storage: "64 GB (51 GB free)",
  },
  {
    id: "HVA0P18A15001234",
    model: "Huawei P30 Pro",
    androidVersion: "12",
    apiLevel: 31,
    battery: 34,
    status: "offline" as const,
    connection: "WiFi" as const,
    ip: "192.168.1.65",
    resolution: "2340×1080",
    cpu: "Kirin 980",
    ram: "6 GB",
    storage: "128 GB (12 GB free)",
  },
];

export const storageTree = {
  origin: "my-ionic-app.com",
  indexedDB: [
    {
      name: "appDatabase",
      version: 3,
      stores: [
        {
          name: "users",
          recordCount: 142,
          keyPath: "id",
          indexes: ["email", "createdAt"],
        },
        {
          name: "syncQueue",
          recordCount: 12,
          keyPath: "id",
          indexes: ["status", "timestamp"],
        },
        { name: "settings", recordCount: 1, keyPath: "key", indexes: [] },
        {
          name: "offlineCache",
          recordCount: 387,
          keyPath: "url",
          indexes: ["timestamp", "type"],
        },
      ],
    },
    {
      name: "jeep-sqlite",
      version: 1,
      stores: [{ name: "mydb.db", recordCount: 1, keyPath: "_id", indexes: [] }],
    },
  ],
  localStorage: { keyCount: 18 },
  sessionStorage: { keyCount: 4 },
  cacheAPI: [
    { name: "v1-static", entryCount: 34, size: "2.4 MB" },
    { name: "v1-api", entryCount: 12, size: "156 KB" },
  ],
  opfs: [
    { name: "mydb.sqlite", size: "4.2 MB" },
    { name: "temp-upload.bin", size: "890 KB" },
  ],
  quota: { used: 14.2, total: 2400, persistent: true },
};

export const idbRecords = [
  {
    id: "usr_001",
    email: "sarah@example.com",
    name: "Sarah Connor",
    role: "admin",
    createdAt: "2024-01-15T09:23:00Z",
    lastSync: "2024-03-28T14:12:00Z",
    avatar: null,
    preferences: { theme: "dark", lang: "en" },
  },
  {
    id: "usr_002",
    email: "john@example.com",
    name: "John Reese",
    role: "user",
    createdAt: "2024-02-01T11:45:00Z",
    lastSync: "2024-03-28T14:10:00Z",
    avatar: null,
    preferences: { theme: "light", lang: "en" },
  },
  {
    id: "usr_003",
    email: "root@example.com",
    name: "Root Groves",
    role: "admin",
    createdAt: "2024-02-10T08:00:00Z",
    lastSync: "2024-03-28T12:00:00Z",
    avatar: null,
    preferences: { theme: "dark", lang: "fr" },
  },
  {
    id: "usr_004",
    email: "shaw@example.com",
    name: "Sameen Shaw",
    role: "user",
    createdAt: "2024-02-14T16:30:00Z",
    lastSync: "2024-03-27T09:45:00Z",
    avatar: null,
    preferences: { theme: "dark", lang: "en" },
  },
  {
    id: "usr_005",
    email: "finch@example.com",
    name: "Harold Finch",
    role: "admin",
    createdAt: "2024-03-01T07:15:00Z",
    lastSync: "2024-03-28T14:11:00Z",
    avatar: null,
    preferences: { theme: "light", lang: "en" },
  },
  {
    id: "usr_006",
    email: "fusco@nypd.gov",
    name: "Lionel Fusco",
    role: "user",
    createdAt: "2024-03-05T10:00:00Z",
    lastSync: "2024-03-26T18:20:00Z",
    avatar: null,
    preferences: { theme: "auto", lang: "en" },
  },
  {
    id: "usr_007",
    email: "carter@nypd.gov",
    name: "Joss Carter",
    role: "moderator",
    createdAt: "2024-03-10T14:00:00Z",
    lastSync: "2024-03-28T08:00:00Z",
    avatar: null,
    preferences: { theme: "dark", lang: "en" },
  },
  {
    id: "usr_008",
    email: "elias@example.com",
    name: "Carl Elias",
    role: "user",
    createdAt: "2024-03-12T20:00:00Z",
    lastSync: "2024-03-25T22:00:00Z",
    avatar: null,
    preferences: { theme: "dark", lang: "it" },
  },
];

export const syncQueueRecords = [
  {
    id: "sq_001",
    type: "UPDATE",
    entity: "users",
    entityId: "usr_001",
    status: "pending",
    timestamp: "2024-03-28T14:12:00Z",
    payload: { name: "Sarah Connor", role: "admin" },
    retries: 0,
  },
  {
    id: "sq_002",
    type: "CREATE",
    entity: "notes",
    entityId: "note_142",
    status: "pending",
    timestamp: "2024-03-28T14:11:00Z",
    payload: { title: "Meeting notes", body: "..." },
    retries: 0,
  },
  {
    id: "sq_003",
    type: "DELETE",
    entity: "tasks",
    entityId: "task_89",
    status: "failed",
    timestamp: "2024-03-28T13:50:00Z",
    payload: null,
    retries: 3,
  },
  {
    id: "sq_004",
    type: "UPDATE",
    entity: "settings",
    entityId: "usr_003",
    status: "synced",
    timestamp: "2024-03-28T12:00:00Z",
    payload: { theme: "dark" },
    retries: 0,
  },
];

export const networkRequests = [
  {
    id: 1,
    method: "GET",
    url: "https://api.myapp.com/v2/users/me",
    status: 200,
    type: "fetch",
    size: "1.2 KB",
    time: "124ms",
    initiator: "auth.service.ts:42",
    timestamp: "14:12:01.234",
  },
  {
    id: 2,
    method: "POST",
    url: "https://api.myapp.com/v2/sync",
    status: 200,
    type: "fetch",
    size: "4.8 KB",
    time: "342ms",
    initiator: "sync.worker.ts:18",
    timestamp: "14:12:01.890",
  },
  {
    id: 3,
    method: "GET",
    url: "https://api.myapp.com/v2/config",
    status: 304,
    type: "fetch",
    size: "0 B",
    time: "45ms",
    initiator: "app.module.ts:12",
    timestamp: "14:12:02.100",
  },
  {
    id: 4,
    method: "PUT",
    url: "https://api.myapp.com/v2/users/usr_001",
    status: 200,
    type: "fetch",
    size: "856 B",
    time: "198ms",
    initiator: "profile.page.ts:67",
    timestamp: "14:12:03.456",
  },
  {
    id: 5,
    method: "GET",
    url: "https://cdn.myapp.com/assets/logo.svg",
    status: 200,
    type: "img",
    size: "3.4 KB",
    time: "67ms",
    initiator: "header.component.ts:8",
    timestamp: "14:12:03.800",
  },
  {
    id: 6,
    method: "POST",
    url: "https://api.myapp.com/v2/analytics",
    status: 204,
    type: "fetch",
    size: "0 B",
    time: "89ms",
    initiator: "analytics.ts:33",
    timestamp: "14:12:04.100",
  },
  {
    id: 7,
    method: "GET",
    url: "https://api.myapp.com/v2/notifications",
    status: 200,
    type: "fetch",
    size: "2.1 KB",
    time: "156ms",
    initiator: "notification.service.ts:21",
    timestamp: "14:12:05.200",
  },
  {
    id: 8,
    method: "DELETE",
    url: "https://api.myapp.com/v2/tasks/89",
    status: 500,
    type: "fetch",
    size: "234 B",
    time: "1.2s",
    initiator: "tasks.service.ts:54",
    timestamp: "14:12:06.700",
  },
  {
    id: 9,
    method: "WS",
    url: "wss://rt.myapp.com/socket",
    status: 101,
    type: "websocket",
    size: "—",
    time: "ongoing",
    initiator: "realtime.ts:5",
    timestamp: "14:12:00.100",
  },
  {
    id: 10,
    method: "GET",
    url: "https://api.myapp.com/v2/tasks?page=1&limit=50",
    status: 200,
    type: "fetch",
    size: "12.4 KB",
    time: "287ms",
    initiator: "tasks.page.ts:15",
    timestamp: "14:12:07.300",
  },
];

export const consoleMessages = [
  {
    level: "info",
    message: "[Capacitor] App initialized",
    timestamp: "14:12:00.001",
    source: "capacitor.js:142",
  },
  {
    level: "log",
    message: "Auth state: authenticated (usr_001)",
    timestamp: "14:12:00.234",
    source: "auth.service.ts:89",
  },
  {
    level: "warn",
    message: "Deprecation: `Preferences.get()` key 'user_token' uses legacy format",
    timestamp: "14:12:00.567",
    source: "preferences.plugin.ts:34",
  },
  {
    level: "info",
    message: "[SyncEngine] Queue: 3 pending, 1 failed, 0 in-progress",
    timestamp: "14:12:01.000",
    source: "sync.worker.ts:12",
  },
  {
    level: "error",
    message: "DELETE /v2/tasks/89 → 500 Internal Server Error",
    timestamp: "14:12:06.710",
    source: "http.interceptor.ts:45",
  },
  {
    level: "error",
    message:
      "  at TaskService.delete (tasks.service.ts:54)\n  at TasksPage.handleDelete (tasks.page.ts:89)\n  at onClick (tasks.page.ts:102)",
    timestamp: "14:12:06.711",
    source: "",
  },
  {
    level: "log",
    message: "[LiveReload] Connected to dev server ws://localhost:8100",
    timestamp: "14:12:07.000",
    source: "live-reload.ts:8",
  },
  {
    level: "info",
    message: "[Network] Online status: true",
    timestamp: "14:12:07.200",
    source: "network.plugin.ts:18",
  },
  {
    level: "warn",
    message: "Large IDB transaction: 387 records written to 'offlineCache' (took 1.2s)",
    timestamp: "14:12:08.000",
    source: "idb-utils.ts:67",
  },
  {
    level: "debug",
    message: "Router navigation: /tabs/home → /tabs/tasks",
    timestamp: "14:12:09.100",
    source: "router.ts:23",
  },
];

export const logcatMessages = [
  {
    level: "I",
    tag: "ActivityManager",
    pid: 1234,
    message: "Displayed com.myapp.ionic/.MainActivity: +892ms",
  },
  {
    level: "D",
    tag: "Capacitor",
    pid: 5678,
    message: "Loading app at http://localhost/",
  },
  {
    level: "I",
    tag: "Capacitor/Plugin",
    pid: 5678,
    message: "Loading plugin SplashScreen",
  },
  {
    level: "I",
    tag: "Capacitor/Plugin",
    pid: 5678,
    message: "Loading plugin StatusBar",
  },
  {
    level: "W",
    tag: "chromium",
    pid: 5678,
    message: "[WARNING:dns_config_service_android.cc] Failed to read DnsConfig.",
  },
  {
    level: "D",
    tag: "WebView",
    pid: 5678,
    message: "loadUrl: http://localhost/",
  },
  {
    level: "I",
    tag: "chromium",
    pid: 5678,
    message: "DevTools listening on ws://127.0.0.1:9222/devtools/browser",
  },
  {
    level: "E",
    tag: "SQLiteLog",
    pid: 5678,
    message: "(14) cannot open file at line 37721 of [2020-08-14]",
  },
  {
    level: "W",
    tag: "Capacitor",
    pid: 5678,
    message: "Unable to find a Capacitor plugin to handle permission request",
  },
  {
    level: "I",
    tag: "Capacitor/Console",
    pid: 5678,
    message: "File: http://localhost/main.js - Line 142 - Msg: App initialized",
  },
];

export const localStorageEntries = [
  {
    key: "CapacitorStorage.user_token",
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  },
  {
    key: "CapacitorStorage.refresh_token",
    value: "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  },
  {
    key: "CapacitorStorage.user_preferences",
    value: '{"theme":"dark","lang":"en","notifications":true}',
  },
  { key: "CapacitorStorage.last_sync", value: "2024-03-28T14:12:00.000Z" },
  { key: "CapacitorStorage.onboarding_complete", value: "true" },
  { key: "_cap_lastUrl", value: "http://localhost/tabs/tasks" },
  { key: "_cap_lastPath", value: "/tabs/tasks" },
  { key: "ionic:storage:darkMode", value: "true" },
];

export const packages = [
  {
    name: "com.myapp.ionic",
    version: "2.4.1",
    size: "34.2 MB",
    installDate: "2024-03-15",
  },
  {
    name: "com.google.android.gms",
    version: "24.08.12",
    size: "56.8 MB",
    installDate: "2024-01-01",
  },
  {
    name: "com.android.chrome",
    version: "123.0.6312.40",
    size: "178 MB",
    installDate: "2024-03-20",
  },
  {
    name: "io.ionic.starter",
    version: "1.0.0",
    size: "12.1 MB",
    installDate: "2024-02-28",
  },
];

export const installedApps = [
  {
    id: 1,
    packageName: "com.myapp.ionic",
    label: "My App",
    version: "2.4.1",
    versionCode: 24,
    size: "34.2 MB",
    color: "#2dd4bf",
    installDate: "2024-03-15",
    category: "Business",
    targetSdk: 34,
    minSdk: 24,
    activities: 8,
    services: 3,
    permissions: 12,
    system: false,
  },
  {
    id: 2,
    packageName: "com.android.chrome",
    label: "Chrome",
    version: "123.0.6312",
    versionCode: 631200000,
    size: "178 MB",
    color: "#fbbc05",
    installDate: "2024-03-20",
    category: "Browser",
    targetSdk: 34,
    minSdk: 21,
    activities: 12,
    services: 4,
    permissions: 28,
    system: false,
  },
  {
    id: 3,
    packageName: "com.spotify.music",
    label: "Spotify",
    version: "8.8.72",
    versionCode: 88720,
    size: "72.1 MB",
    color: "#1db954",
    installDate: "2024-02-10",
    category: "Music",
    targetSdk: 34,
    minSdk: 21,
    activities: 15,
    services: 5,
    permissions: 18,
    system: false,
  },
  {
    id: 4,
    packageName: "com.google.android.apps.maps",
    label: "Maps",
    version: "11.120.0",
    versionCode: 1112000,
    size: "95.4 MB",
    color: "#34a853",
    installDate: "2024-01-15",
    category: "Navigation",
    targetSdk: 34,
    minSdk: 21,
    activities: 18,
    services: 6,
    permissions: 22,
    system: false,
  },
  {
    id: 5,
    packageName: "io.ionic.starter",
    label: "Ionic Starter",
    version: "1.0.0",
    versionCode: 1,
    size: "12.1 MB",
    color: "#3880ff",
    installDate: "2024-02-28",
    category: "Development",
    targetSdk: 33,
    minSdk: 22,
    activities: 3,
    services: 1,
    permissions: 6,
    system: false,
  },
  {
    id: 6,
    packageName: "com.whatsapp",
    label: "WhatsApp",
    version: "2.24.7.9",
    versionCode: 242307,
    size: "83.4 MB",
    color: "#25d366",
    installDate: "2024-01-20",
    category: "Social",
    targetSdk: 34,
    minSdk: 21,
    activities: 22,
    services: 8,
    permissions: 30,
    system: false,
  },
  {
    id: 7,
    packageName: "com.google.android.gms",
    label: "Play Services",
    version: "24.08.12",
    versionCode: 240812000,
    size: "56.8 MB",
    color: "#4285f4",
    installDate: "2024-01-01",
    category: "System",
    targetSdk: 34,
    minSdk: 19,
    activities: 42,
    services: 15,
    permissions: 45,
    system: true,
  },
  {
    id: 8,
    packageName: "com.netflix.mediaclient",
    label: "Netflix",
    version: "8.108.0",
    versionCode: 81080,
    size: "64.2 MB",
    color: "#e50914",
    installDate: "2024-03-01",
    category: "Video",
    targetSdk: 34,
    minSdk: 23,
    activities: 10,
    services: 4,
    permissions: 14,
    system: false,
  },
];

export const webviewTargets = [
  {
    pid: 5678,
    packageName: "com.myapp.ionic",
    appLabel: "My App",
    targets: [
      {
        id: "t1",
        type: "page" as const,
        url: "http://localhost/tabs/home",
        title: "My Ionic App · Home",
      },
      {
        id: "t2",
        type: "page" as const,
        url: "http://localhost/tabs/tasks",
        title: "My Ionic App · Tasks",
      },
      {
        id: "sw1",
        type: "service_worker" as const,
        url: "http://localhost/sw.js",
        title: "Service Worker",
      },
    ],
  },
  {
    pid: 9101,
    packageName: "com.android.chrome",
    appLabel: "Chrome",
    targets: [
      {
        id: "ct1",
        type: "page" as const,
        url: "https://google.com/",
        title: "Google",
      },
    ],
  },
];

export type FileNode =
  | { type: "file"; name: string; size: string; modified: string; ext: string }
  | { type: "dir"; name: string; children: FileNode[] };

export const fileTree: FileNode[] = [
  {
    type: "dir",
    name: "DCIM",
    children: [
      {
        type: "dir",
        name: "Camera",
        children: [
          {
            type: "file",
            name: "IMG_20240328_142301.jpg",
            size: "4.2 MB",
            modified: "2024-03-28 14:23",
            ext: "jpg",
          },
          {
            type: "file",
            name: "IMG_20240328_110543.jpg",
            size: "3.8 MB",
            modified: "2024-03-28 11:05",
            ext: "jpg",
          },
          {
            type: "file",
            name: "VID_20240327_194512.mp4",
            size: "67.3 MB",
            modified: "2024-03-27 19:45",
            ext: "mp4",
          },
          {
            type: "file",
            name: "IMG_20240326_092011.jpg",
            size: "5.1 MB",
            modified: "2024-03-26 09:20",
            ext: "jpg",
          },
        ],
      },
    ],
  },
  {
    type: "dir",
    name: "Download",
    children: [
      {
        type: "file",
        name: "app-release-2.4.1.apk",
        size: "34.2 MB",
        modified: "2024-03-15 10:00",
        ext: "apk",
      },
      {
        type: "file",
        name: "invoice_2024_03.pdf",
        size: "142 KB",
        modified: "2024-03-20 09:12",
        ext: "pdf",
      },
      {
        type: "file",
        name: "design-mockup.fig",
        size: "8.7 MB",
        modified: "2024-03-22 16:30",
        ext: "fig",
      },
    ],
  },
  {
    type: "dir",
    name: "Android",
    children: [
      {
        type: "dir",
        name: "data",
        children: [
          {
            type: "dir",
            name: "com.myapp.ionic",
            children: [
              {
                type: "dir",
                name: "files",
                children: [
                  {
                    type: "file",
                    name: "mydb.sqlite",
                    size: "4.2 MB",
                    modified: "2024-03-28 14:12",
                    ext: "sqlite",
                  },
                  {
                    type: "file",
                    name: "temp-upload.bin",
                    size: "890 KB",
                    modified: "2024-03-28 13:50",
                    ext: "bin",
                  },
                ],
              },
              {
                type: "dir",
                name: "cache",
                children: [
                  {
                    type: "file",
                    name: "http-cache.db",
                    size: "2.1 MB",
                    modified: "2024-03-28 12:00",
                    ext: "db",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "dir",
    name: "Pictures",
    children: [
      {
        type: "dir",
        name: "Screenshots",
        children: [
          {
            type: "file",
            name: "Screenshot_20240328-141200.png",
            size: "1.2 MB",
            modified: "2024-03-28 14:12",
            ext: "png",
          },
        ],
      },
    ],
  },
  {
    type: "dir",
    name: "Music",
    children: [
      {
        type: "file",
        name: "track_01.mp3",
        size: "8.4 MB",
        modified: "2024-02-14 20:00",
        ext: "mp3",
      },
    ],
  },
];

export const portForwards = [
  { id: 1, local: 9222, remote: 9222, description: "Chrome DevTools" },
  { id: 2, local: 8080, remote: 8080, description: "Dev server" },
  { id: 3, local: 3000, remote: 3000, description: "Vite HMR" },
];

// ── Storage mock data ───────────────────────────────────────────────────────

export interface MockIDBDatabase {
  name: string;
  version: number;
  stores: {
    name: string;
    recordCount: number;
    keyPath: string;
    indexes: string[];
  }[];
}

export const mockDatabases: MockIDBDatabase[] = [
  {
    name: "appDatabase",
    version: 3,
    stores: [
      {
        name: "users",
        recordCount: 142,
        keyPath: "id",
        indexes: ["email", "createdAt"],
      },
      {
        name: "syncQueue",
        recordCount: 12,
        keyPath: "id",
        indexes: ["status", "timestamp"],
      },
      { name: "settings", recordCount: 1, keyPath: "key", indexes: [] },
      {
        name: "offlineCache",
        recordCount: 387,
        keyPath: "url",
        indexes: ["timestamp", "type"],
      },
    ],
  },
  {
    name: "jeep-sqlite",
    version: 1,
    stores: [{ name: "mydb.db", recordCount: 1, keyPath: "_id", indexes: [] }],
  },
];

export interface MockIDBRecord {
  key: IDBValidKey;
  value: Record<string, unknown>;
}

const mockUsersStore: MockIDBRecord[] = [
  {
    key: "usr_001",
    value: {
      id: "usr_001",
      email: "sarah@example.com",
      name: "Sarah Connor",
      role: "admin",
      createdAt: "2024-01-15T09:23:00Z",
      lastSync: "2024-03-28T14:12:00Z",
      avatar: null,
      preferences: { theme: "dark", lang: "en" },
    },
  },
  {
    key: "usr_002",
    value: {
      id: "usr_002",
      email: "john@example.com",
      name: "John Reese",
      role: "user",
      createdAt: "2024-02-01T11:45:00Z",
      lastSync: "2024-03-28T14:10:00Z",
      avatar: null,
      preferences: { theme: "light", lang: "en" },
    },
  },
  {
    key: "usr_003",
    value: {
      id: "usr_003",
      email: "root@example.com",
      name: "Root Groves",
      role: "admin",
      createdAt: "2024-02-10T08:00:00Z",
      lastSync: "2024-03-28T12:00:00Z",
      avatar: null,
      preferences: { theme: "dark", lang: "fr" },
    },
  },
  {
    key: "usr_004",
    value: {
      id: "usr_004",
      email: "shaw@example.com",
      name: "Sameen Shaw",
      role: "user",
      createdAt: "2024-02-14T16:30:00Z",
      lastSync: "2024-03-27T09:45:00Z",
      avatar: null,
      preferences: { theme: "dark", lang: "en" },
    },
  },
  {
    key: "usr_005",
    value: {
      id: "usr_005",
      email: "finch@example.com",
      name: "Harold Finch",
      role: "admin",
      createdAt: "2024-03-01T07:15:00Z",
      lastSync: "2024-03-28T14:11:00Z",
      avatar: null,
      preferences: { theme: "light", lang: "en" },
    },
  },
  {
    key: "usr_006",
    value: {
      id: "usr_006",
      email: "fusco@nypd.gov",
      name: "Lionel Fusco",
      role: "user",
      createdAt: "2024-03-05T10:00:00Z",
      lastSync: "2024-03-26T18:20:00Z",
      avatar: null,
      preferences: { theme: "auto", lang: "en" },
    },
  },
  {
    key: "usr_007",
    value: {
      id: "usr_007",
      email: "carter@nypd.gov",
      name: "Joss Carter",
      role: "moderator",
      createdAt: "2024-03-10T14:00:00Z",
      lastSync: "2024-03-28T08:00:00Z",
      avatar: null,
      preferences: { theme: "dark", lang: "en" },
    },
  },
  {
    key: "usr_008",
    value: {
      id: "usr_008",
      email: "elias@example.com",
      name: "Carl Elias",
      role: "user",
      createdAt: "2024-03-12T20:00:00Z",
      lastSync: "2024-03-25T22:00:00Z",
      avatar: null,
      preferences: { theme: "dark", lang: "it" },
    },
  },
];

const mockSyncQueueStore: MockIDBRecord[] = [
  {
    key: "sq_001",
    value: {
      id: "sq_001",
      type: "UPDATE",
      entity: "users",
      entityId: "usr_001",
      status: "pending",
      timestamp: "2024-03-28T14:12:00Z",
      payload: { name: "Sarah Connor", role: "admin" },
      retries: 0,
    },
  },
  {
    key: "sq_002",
    value: {
      id: "sq_002",
      type: "CREATE",
      entity: "notes",
      entityId: "note_142",
      status: "pending",
      timestamp: "2024-03-28T14:11:00Z",
      payload: { title: "Meeting notes", body: "..." },
      retries: 0,
    },
  },
  {
    key: "sq_003",
    value: {
      id: "sq_003",
      type: "DELETE",
      entity: "tasks",
      entityId: "task_89",
      status: "failed",
      timestamp: "2024-03-28T13:50:00Z",
      payload: null,
      retries: 3,
    },
  },
  {
    key: "sq_004",
    value: {
      id: "sq_004",
      type: "UPDATE",
      entity: "settings",
      entityId: "usr_003",
      status: "synced",
      timestamp: "2024-03-28T12:00:00Z",
      payload: { theme: "dark" },
      retries: 0,
    },
  },
];

const mockSettingsStore: MockIDBRecord[] = [
  {
    key: "appConfig",
    value: {
      theme: "dark",
      lang: "en",
      notifications: true,
      analytics: false,
      version: "2.4.1",
    },
  },
];

const mockOfflineCacheStore: MockIDBRecord[] = [
  {
    key: "/api/v2/users/me",
    value: {
      url: "/api/v2/users/me",
      method: "GET",
      status: 200,
      timestamp: "2024-03-28T14:12:00Z",
      type: "json",
      size: "1.2 KB",
    },
  },
  {
    key: "/api/v2/config",
    value: {
      url: "/api/v2/config",
      method: "GET",
      status: 200,
      timestamp: "2024-03-28T14:10:00Z",
      type: "json",
      size: "456 B",
    },
  },
  {
    key: "/api/v2/tasks",
    value: {
      url: "/api/v2/tasks",
      method: "GET",
      status: 200,
      timestamp: "2024-03-28T14:08:00Z",
      type: "json",
      size: "12.4 KB",
    },
  },
  {
    key: "/assets/logo.svg",
    value: {
      url: "/assets/logo.svg",
      method: "GET",
      status: 200,
      timestamp: "2024-03-28T14:00:00Z",
      type: "blob",
      size: "3.4 KB",
    },
  },
  {
    key: "/api/v2/notifications",
    value: {
      url: "/api/v2/notifications",
      method: "GET",
      status: 200,
      timestamp: "2024-03-28T13:55:00Z",
      type: "json",
      size: "2.1 KB",
    },
  },
];

const mockSqliteStore: MockIDBRecord[] = [
  {
    key: "_metadata",
    value: {
      _id: "_metadata",
      db: "mydb.db",
      version: 1,
      tables: ["users", "notes", "tasks"],
      created: "2024-01-15T09:00:00Z",
    },
  },
];

export function getMockIDBRecords(dbName: string, storeName: string): MockIDBRecord[] {
  const map: Record<string, Record<string, MockIDBRecord[]>> = {
    appDatabase: {
      users: mockUsersStore,
      syncQueue: mockSyncQueueStore,
      settings: mockSettingsStore,
      offlineCache: mockOfflineCacheStore,
    },
    "jeep-sqlite": {
      "mydb.db": mockSqliteStore,
    },
  };
  return map[dbName]?.[storeName] ?? [];
}

export interface MockLSOrigin {
  origin: string;
  entries: { key: string; value: string }[];
}

export const mockLocalStorageOrigins: MockLSOrigin[] = [
  {
    origin: "https://my-ionic-app.com",
    entries: [
      {
        key: "CapacitorStorage.user_token",
        value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      },
      {
        key: "CapacitorStorage.refresh_token",
        value: "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
      },
      {
        key: "CapacitorStorage.user_preferences",
        value: '{"theme":"dark","lang":"en","notifications":true}',
      },
      { key: "CapacitorStorage.last_sync", value: "2024-03-28T14:12:00.000Z" },
      { key: "CapacitorStorage.onboarding_complete", value: "true" },
      { key: "_cap_lastUrl", value: "http://localhost/tabs/tasks" },
      { key: "_cap_lastPath", value: "/tabs/tasks" },
      { key: "ionic:storage:darkMode", value: "true" },
    ],
  },
  {
    origin: "http://localhost:8100",
    entries: [
      { key: "vite:hot", value: "ws://localhost:5173" },
      { key: "debug", value: "true" },
      { key: "ionic:storage:theme", value: "light" },
    ],
  },
  {
    origin: "https://admin.myapp.com",
    entries: [
      { key: "auth_token", value: "Bearer eyJhbGciOiJSUzI1NiIs..." },
      { key: "sidebar_collapsed", value: "false" },
      { key: "last_visited", value: "/dashboard/analytics" },
      { key: "table_page_size", value: "50" },
      { key: "dark_mode", value: "true" },
    ],
  },
  {
    origin: "https://cdn.myapp.com",
    entries: [
      { key: "asset_version", value: "v2.4.1" },
      { key: "last_cache_check", value: "2024-03-28T10:00:00Z" },
    ],
  },
];

export const mockLocalStorageEntries = mockLocalStorageOrigins[0].entries;

export interface MockCacheOrigin {
  origin: string;
  caches: {
    cacheName: string;
    entries: { url: string; size: string; type: string }[];
  }[];
}

export const mockCacheAPIOrigins: MockCacheOrigin[] = [
  {
    origin: "https://my-ionic-app.com",
    caches: [
      {
        cacheName: "v1-static",
        entries: [
          { url: "/index.html", size: "4.2 KB", type: "text/html" },
          { url: "/main.js", size: "245 KB", type: "application/javascript" },
          { url: "/vendor.js", size: "1.2 MB", type: "application/javascript" },
          { url: "/styles.css", size: "34 KB", type: "text/css" },
        ],
      },
      {
        cacheName: "v1-api",
        entries: [
          { url: "/api/v2/config", size: "456 B", type: "application/json" },
          { url: "/api/v2/users/me", size: "1.2 KB", type: "application/json" },
        ],
      },
    ],
  },
  {
    origin: "http://localhost:8100",
    caches: [
      {
        cacheName: "dev-assets",
        entries: [
          { url: "/src/main.ts", size: "1.2 KB", type: "text/javascript" },
          { url: "/src/App.vue", size: "3.4 KB", type: "text/html" },
        ],
      },
    ],
  },
  {
    origin: "https://cdn.myapp.com",
    caches: [
      {
        cacheName: "static-assets-v3",
        entries: [
          { url: "/fonts/inter-var.woff2", size: "98 KB", type: "font/woff2" },
          { url: "/images/hero.webp", size: "124 KB", type: "image/webp" },
          { url: "/icons/sprite.svg", size: "12 KB", type: "image/svg+xml" },
        ],
      },
    ],
  },
];

export const mockCacheAPIEntries = mockCacheAPIOrigins[0].caches;

// export const mockCacheAPIEntries = [
//   {
//     cacheName: "v1-static",
//     entries: [
//       { url: "/index.html", size: "4.2 KB", type: "text/html" },
//       { url: "/main.js", size: "245 KB", type: "application/javascript" },
//       { url: "/vendor.js", size: "1.2 MB", type: "application/javascript" },
//       { url: "/styles.css", size: "34 KB", type: "text/css" },
//     ],
//   },
//   {
//     cacheName: "v1-api",
//     entries: [
//       { url: "/api/v2/config", size: "456 B", type: "application/json" },
//       { url: "/api/v2/users/me", size: "1.2 KB", type: "application/json" },
//     ],
//   },
// ];

export const mockOPFSEntries = [
  {
    name: "mydb.sqlite",
    size: "4.2 MB",
    type: "database",
    modified: "2024-03-28 14:12",
  },
  {
    name: "temp-upload.bin",
    size: "890 KB",
    type: "binary",
    modified: "2024-03-28 13:50",
  },
  {
    name: "export-2024-03.json",
    size: "124 KB",
    type: "json",
    modified: "2024-03-27 09:30",
  },
  {
    name: "image-cache/",
    size: "2.1 MB",
    type: "directory",
    modified: "2024-03-26 18:00",
  },
];

// ── Capacitor mock data ─────────────────────────────────────────────────────

export interface BridgeCall {
  id: number;
  plugin: string;
  method: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  status: "pending" | "resolved" | "rejected";
  timestamp: string;
  duration: number;
}

export const mockBridgeCalls: BridgeCall[] = [
  {
    id: 1,
    plugin: "Camera",
    method: "getPhoto",
    args: { quality: 90, allowEditing: false, resultType: "base64" },
    result: { base64String: "data:image/jpeg;base64,/9j/4AAQ...", format: "jpeg" },
    error: null,
    status: "resolved",
    timestamp: "2024-03-28T14:12:03.421Z",
    duration: 1847,
  },
  {
    id: 2,
    plugin: "Geolocation",
    method: "getCurrentPosition",
    args: { enableHighAccuracy: true, timeout: 10000 },
    result: {
      coords: { latitude: 37.7749, longitude: -122.4194, accuracy: 12.5 },
      timestamp: "2024-03-28T14:12:01.000Z",
    },
    error: null,
    status: "resolved",
    timestamp: "2024-03-28T14:12:01.203Z",
    duration: 203,
  },
  {
    id: 3,
    plugin: "Storage",
    method: "get",
    args: { key: "user_preferences" },
    result: { value: '{"theme":"dark","lang":"en"}' },
    error: null,
    status: "resolved",
    timestamp: "2024-03-28T14:11:58.102Z",
    duration: 12,
  },
  {
    id: 4,
    plugin: "PushNotifications",
    method: "requestPermissions",
    args: {},
    result: { receive: "granted" },
    error: null,
    status: "resolved",
    timestamp: "2024-03-28T14:11:55.890Z",
    duration: 445,
  },
  {
    id: 5,
    plugin: "Filesystem",
    method: "readFile",
    args: { path: "data.json", directory: "DATA" },
    result: null,
    error: "File does not exist",
    status: "rejected",
    timestamp: "2024-03-28T14:11:52.334Z",
    duration: 8,
  },
  {
    id: 6,
    plugin: "Network",
    method: "getStatus",
    args: {},
    result: { connected: true, connectionType: "wifi" },
    error: null,
    status: "resolved",
    timestamp: "2024-03-28T14:11:50.100Z",
    duration: 3,
  },
  {
    id: 7,
    plugin: "Device",
    method: "getInfo",
    args: {},
    result: { model: "Pixel 7", platform: "android", osVersion: "14", appVersion: "2.4.1" },
    error: null,
    status: "resolved",
    timestamp: "2024-03-28T14:11:48.050Z",
    duration: 15,
  },
  {
    id: 8,
    plugin: "Haptics",
    method: "vibrate",
    args: { duration: 200 },
    result: null,
    error: null,
    status: "resolved",
    timestamp: "2024-03-28T14:11:45.900Z",
    duration: 2,
  },
  {
    id: 9,
    plugin: "Browser",
    method: "open",
    args: { url: "https://example.com" },
    result: null,
    error: null,
    status: "resolved",
    timestamp: "2024-03-28T14:11:42.500Z",
    duration: 312,
  },
  {
    id: 10,
    plugin: "Geolocation",
    method: "watchPosition",
    args: { enableHighAccuracy: true },
    result: null,
    error: "Location permission denied",
    status: "rejected",
    timestamp: "2024-03-28T14:11:38.200Z",
    duration: 15,
  },
];

export interface CapacitorPlugin {
  name: string;
  package: string;
  version: string;
  status: "ok" | "warn" | "outdated" | "error";
  native: boolean;
  docsUrl: string;
  calls: number;
}

export const mockCapacitorPlugins: CapacitorPlugin[] = [
  {
    name: "Camera",
    package: "@capacitor/camera",
    version: "5.0.9",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/camera",
    calls: 142,
  },
  {
    name: "Geolocation",
    package: "@capacitor/geolocation",
    version: "5.0.7",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/geolocation",
    calls: 89,
  },
  {
    name: "Storage",
    package: "@capacitor/storage",
    version: "1.2.5",
    status: "outdated",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/storage",
    calls: 1204,
  },
  {
    name: "Push Notifications",
    package: "@capacitor/push-notifications",
    version: "5.1.2",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/push-notifications",
    calls: 3,
  },
  {
    name: "Filesystem",
    package: "@capacitor/filesystem",
    version: "5.2.1",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/filesystem",
    calls: 67,
  },
  {
    name: "Network",
    package: "@capacitor/network",
    version: "5.0.5",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/network",
    calls: 234,
  },
  {
    name: "Device",
    package: "@capacitor/device",
    version: "5.0.6",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/device",
    calls: 12,
  },
  {
    name: "Haptics",
    package: "@capacitor/haptics",
    version: "5.0.6",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/haptics",
    calls: 56,
  },
  {
    name: "Browser",
    package: "@capacitor/browser",
    version: "5.1.1",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/browser",
    calls: 8,
  },
  {
    name: "Preferences",
    package: "@capacitor/preferences",
    version: "5.0.7",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/preferences",
    calls: 445,
  },
  {
    name: "Keyboard",
    package: "@capacitor/keyboard",
    version: "5.0.8",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/keyboard",
    calls: 23,
  },
  {
    name: "Status Bar",
    package: "@capacitor/status-bar",
    version: "5.0.7",
    status: "ok",
    native: true,
    docsUrl: "https://capacitorjs.com/docs/apis/status-bar",
    calls: 5,
  },
];

export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: { url: string; cleartext: boolean };
  plugins: Record<string, Record<string, unknown>>;
  android: { allowMixedContent: boolean; backgroundColor: string };
}

export const mockCapacitorConfig: CapacitorConfig = {
  appId: "com.example.myapp",
  appName: "MyApp",
  webDir: "dist",
  server: { url: "http://10.0.2.2:8100", cleartext: true },
  plugins: {
    SplashScreen: { launchShowDuration: 2000, backgroundColor: "#ffffff" },
    StatusBar: { style: "DARK", backgroundColor: "#ffffff" },
  },
  android: { allowMixedContent: true, backgroundColor: "#ffffff" },
};

export interface AppInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
  buildType: "debug" | "release";
  minSdkVersion: number;
  targetSdkVersion: number;
  capacitorVersion: string;
  capacitorCoreVersion: string;
  cliVersion: string;
  platform: "android" | "ios";
  osVersion: string;
  deviceModel: string;
  webViewVersion: string;
  installSource: string;
  firstInstall: string;
  lastUpdate: string;
}

export const mockAppInfo: AppInfo = {
  packageName: "com.example.myapp",
  versionName: "2.4.1",
  versionCode: 42,
  buildType: "debug",
  minSdkVersion: 22,
  targetSdkVersion: 34,
  capacitorVersion: "5.7.0",
  capacitorCoreVersion: "5.7.0",
  cliVersion: "5.7.4",
  platform: "android",
  osVersion: "14",
  deviceModel: "Pixel 7",
  webViewVersion: "122.0.6261.105",
  installSource: "local",
  firstInstall: "2024-01-15T09:00:00Z",
  lastUpdate: "2024-03-28T14:00:00Z",
};

export interface PermissionEntry {
  name: string;
  androidPermission: string;
  status: "granted" | "denied" | "not_requested";
  lastRequested: string | null;
}

export const mockPermissions: PermissionEntry[] = [
  {
    name: "Camera",
    androidPermission: "android.permission.CAMERA",
    status: "granted",
    lastRequested: "2024-03-28T14:12:03Z",
  },
  {
    name: "Location (Fine)",
    androidPermission: "android.permission.ACCESS_FINE_LOCATION",
    status: "granted",
    lastRequested: "2024-03-28T14:12:01Z",
  },
  {
    name: "Location (Coarse)",
    androidPermission: "android.permission.ACCESS_COARSE_LOCATION",
    status: "granted",
    lastRequested: "2024-03-28T14:12:01Z",
  },
  {
    name: "Notifications",
    androidPermission: "android.permission.POST_NOTIFICATIONS",
    status: "granted",
    lastRequested: "2024-03-28T14:11:55Z",
  },
  {
    name: "Read External Storage",
    androidPermission: "android.permission.READ_EXTERNAL_STORAGE",
    status: "not_requested",
    lastRequested: null,
  },
  {
    name: "Write External Storage",
    androidPermission: "android.permission.WRITE_EXTERNAL_STORAGE",
    status: "not_requested",
    lastRequested: null,
  },
  {
    name: "Record Audio",
    androidPermission: "android.permission.RECORD_AUDIO",
    status: "denied",
    lastRequested: "2024-03-25T10:00:00Z",
  },
  {
    name: "Bluetooth Connect",
    androidPermission: "android.permission.BLUETOOTH_CONNECT",
    status: "not_requested",
    lastRequested: null,
  },
  {
    name: "Vibrate",
    androidPermission: "android.permission.VIBRATE",
    status: "granted",
    lastRequested: "2024-03-28T14:11:45Z",
  },
];

export interface DeepLinkTest {
  url: string;
  description: string;
  status: "pending" | "success" | "failed";
  timestamp: string | null;
}

export const mockDeepLinkTests: DeepLinkTest[] = [
  {
    url: "myapp://home",
    description: "Home screen",
    status: "success",
    timestamp: "2024-03-28T14:10:00Z",
  },
  {
    url: "myapp://product/123",
    description: "Product detail",
    status: "success",
    timestamp: "2024-03-28T14:08:00Z",
  },
  {
    url: "myapp://settings/profile",
    description: "Settings > Profile",
    status: "failed",
    timestamp: "2024-03-28T14:05:00Z",
  },
  {
    url: "https://myapp.com/reset-password?token=abc123",
    description: "Password reset",
    status: "pending",
    timestamp: null,
  },
];
