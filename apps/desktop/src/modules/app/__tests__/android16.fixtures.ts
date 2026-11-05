/**
 * Trimmed output captured on a Redmi Note 14 running Android 16 (API 36) with a second user, the
 * app renamed. Numbers are as the phone printed them.
 */
export const APP = "com.example.retail";

export const MEMINFO_LOCAL = `Applications Memory Usage (in Kilobytes):
Uptime: 594454364 Realtime: 624744670

** MEMINFO in pid 23882 [com.example.retail] **
                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free
                ------   ------   ------   ------   ------   ------   ------   ------
  Native Heap     7307     7280        0    24158    10448        0        0        0
  Dalvik Heap     3511     3368       16       80    10300        0        0        0
 Dalvik Other     7983     2444        0      680    14008
        Stack      532      532        0     2000      544
       Ashmem      446       28        0        0     3016
     .so mmap     4193       68       68      418    61868
    .apk mmap     6176       40      152      428    41176
    GL mtrack    16588    16588        0        0    16588
      Unknown     4860     4792       60    14298     5960
        TOTAL   109599    37304     2352    48288   241820        0        0        0

 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:     5528                          27796
         Native Heap:     7280                          10448
                Code:     1244                         163832
               Stack:      532                            544
            Graphics:    16588                          16588
       Private Other:     8484
              System:    69943
             Unknown:                                   22612

           TOTAL PSS:   109599            TOTAL RSS:   241820       TOTAL SWAP PSS:    48288
`;

/** The same app running for user 0 (PID 23882) and user 10 (PID 31000). */
export const MEMINFO_TWO_USERS = `${MEMINFO_LOCAL}
** MEMINFO in pid 31000 [com.example.retail] **
                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free
        TOTAL    40000    20000     1000        0    90000        0        0        0

 App Summary
           Java Heap:     4000                          20000
         Native Heap:     6000                           9000
                Code:     1000                          60000
               Stack:      400                            400
            Graphics:     8000                           8000
       Private Other:     1600
              System:    19000

           TOTAL PSS:    40000            TOTAL RSS:    90000       TOTAL SWAP PSS:        0
`;

export const PROC_23882 = `23882 (presalio.retail) S 1136 1136 0 0 -1 4194624 165981 0 61835 0 55230 30975 0 0 20 0 106 0 61229489 45044690944 60922 18446744073709551615 1 1 0 0 0 0 4612 1 1073775864 0 0 0 17 3 0 0 0 0 0 0 0 0 0 0 0 0 0
Name:	presalio.retail
State:	S (sleeping)
Tgid:	23882
Pid:	23882
Uid:	10406	10406	10406	10406
VmRSS:	  243688 kB
Threads:	106
`;

export const PROC_31000 = `31000 (presalio.retail) S 1136 1136 0 0 -1 4194624 1000 0 100 0 900 400 0 0 20 0 41 0 70000000 30000000000 20000 18446744073709551615 1 1 0 0 0 0 4612 1 1073775864 0 0 0 17 3 0 0 0 0 0 0 0 0 0 0 0 0 0
Name:	presalio.retail
Uid:	1010406	1010406	1010406	1010406
Threads:	41
`;

/** What the reading command prints for the user-0 process, without and with memory. */
export function processReadOutput(
  options: { uptime?: number; userTicks?: number; memory?: boolean; cores?: boolean } = {},
): string {
  const stat = PROC_23882.replace(" 55230 30975 ", ` ${options.userTicks ?? 55230} 30975 `);
  const lines = [`${options.uptime ?? 594454.36} 4512345.67`, "@@capubridge-pid 23882", stat];
  if (options.cores) lines.push("@@capubridge-cores 8");
  if (options.memory) lines.push("@@capubridge-mem", MEMINFO_LOCAL);
  return lines.join("\n");
}

export const NOT_RUNNING_OUTPUT = "594454.36 4512345.67\n";

/** `dumpsys batterystats --charged` cut to the app's block by the on-phone filter. */
export const BATTERY_BLOCK = `  u0a406:
    Wake lock *launch* realtime
    Wake lock WindowManager/displayId:0: 3m 31s 826ms full (3 times) realtime
    TOTAL wake: 3m 31s 826ms full realtime
    Foreground activities: 10h 58m 24s 102ms realtime (0 times) (running)
    Top for: 31m 13s 552ms
    Cached for: 2h 14m 39s 270ms
    Total running: 2h 45m 56s 775ms
    Total cpu time: u=21m 3s 834ms s=10m 10s 711ms
    Total cpu time per freq: 54357 0 19472 32215 27860
    Proc com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0:
      CPU: 3m 0s 200ms usr + 1m 6s 140ms krn ; 0ms fg
      1 starts
    Proc com.example.retail:
      CPU: 17m 47s 470ms usr + 9m 12s 760ms krn ; 27m 4s 50ms fg
      1 starts

Per process state tracking available: true
`;

/** The unfiltered report: a system uid's block comes first and must not be read as the app's. */
export const BATTERY_FULL = `Discharge step durations:
  #0: +6m2s504ms to 51 (screen-on, power-save-off, device-idle-off)
Statistics since last charge:
  1000:
    Wake lock *alarm* realtime
    TOTAL wake: 1h 2m 3s partial realtime
    Total cpu time: u=2h 1m 0s 0ms s=1h 0m 0s 0ms
${BATTERY_BLOCK}`;

/** Permission sections of `dumpsys package` with the app installed for user 0 and user 10. */
export const PACKAGE_DUMP_TWO_USERS = `Packages:
  Package [com.example.retail] (315461a):
    appId=10406
    versionCode=1 minSdk=24 targetSdk=36
    pkgFlags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
    declared permissions:
      com.example.retail.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION: prot=signature
    requested permissions:
      android.permission.POST_NOTIFICATIONS
      android.permission.INTERNET
      com.example.retail.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
      android.permission.CAMERA
      android.permission.RECORD_AUDIO
      android.permission.ACCESS_FINE_LOCATION: restricted=true
    install permissions:
      android.permission.INTERNET: granted=true
      com.example.retail.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION: granted=true
    User 0: ceDataInode=445187 installed=true hidden=false stopped=false enabled=0
      dataDir=/data/user/0/com.example.retail
      runtime permissions:
        android.permission.POST_NOTIFICATIONS: granted=false, flags=[ USER_SENSITIVE_WHEN_GRANTED|USER_SENSITIVE_WHEN_DENIED]
        android.permission.CAMERA: granted=true, flags=[ USER_SET|USER_SENSITIVE_WHEN_GRANTED|USER_SENSITIVE_WHEN_DENIED]
        android.permission.RECORD_AUDIO: granted=true, flags=[ USER_SET|USER_SENSITIVE_WHEN_GRANTED|USER_SENSITIVE_WHEN_DENIED]
    User 10: ceDataInode=0 installed=true hidden=false stopped=true enabled=3
      dataDir=/data/user/10/com.example.retail
      runtime permissions:
        android.permission.CAMERA: granted=false, flags=[ USER_SENSITIVE_WHEN_GRANTED]
        android.permission.ACCESS_FINE_LOCATION: granted=false, flags=[ APPLY_RESTRICTION]

Queries:
  queryable via interaction:
    User 0:
      com.example.retail
`;
