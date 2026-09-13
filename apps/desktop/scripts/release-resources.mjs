export const platformTools = {
  windows: {
    url: "https://dl.google.com/android/repository/platform-tools_r37.0.1-win.zip",
    algorithm: "sha1",
    checksum: "e03e78b1d80b396f1c3358e31251cb31740e1110",
  },
  linux: {
    url: "https://dl.google.com/android/repository/platform-tools_r37.0.1-linux.zip",
    algorithm: "sha1",
    checksum: "477254aa5f903c15cf51001717bdf347fb6b53e0",
  },
  darwin: {
    url: "https://dl.google.com/android/repository/platform-tools_r37.0.1-darwin.zip",
    algorithm: "sha1",
    checksum: "6ae73f4de6452dc57e62ec02b68eed92a4c21661",
  },
};

export const scrcpy = {
  "windows-x64": {
    url: "https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-win64-v4.1.zip",
    checksum: "5b12172b3264b2889f4583ee64752ce832e29bc8b1089dca81093459697165db",
    binary: "scrcpy.exe",
    archiveSuffix: ".zip",
  },
  "linux-x64": {
    url: "https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-linux-x86_64-v4.1.tar.gz",
    checksum: "ad56ae8bfeedf41e824945c11dbf55fcb092b3e615b9b486f48a50e30d389635",
    binary: "scrcpy",
    archiveSuffix: ".tar.gz",
  },
  "macos-x64": {
    url: "https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-macos-x86_64-v4.1.tar.gz",
    checksum: "ee2a7223bc8dbdc4f482db1134bcf441178dafb833492b71ca4c22090c58ce72",
    binary: "scrcpy",
    archiveSuffix: ".tar.gz",
  },
  "macos-arm64": {
    url: "https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-macos-aarch64-v4.1.tar.gz",
    checksum: "20fd47c9014dd5e0fa77091f3cb7adbda8445a360c4584aeaa0150b5b3988ff3",
    binary: "scrcpy",
    archiveSuffix: ".tar.gz",
  },
};
