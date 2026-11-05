export const PACKAGE = "com.sig.presalio";

export const MEMINFO_RUNNING = `Applications Memory Usage (in Kilobytes):
Uptime: 5123 Realtime: 5123

** MEMINFO in pid 4321 [com.sig.presalio] **
                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free
                ------   ------   ------   ------   ------   ------   ------   ------
  Native Heap    20480    20000        0        0    21000    30000    25000     5000
  Dalvik Heap    10240    10000        0        0    11000    16000    12000     4000
        Stack     1024     1024        0        0     1100
       .so mmap     4096      100     2000        0     9000
      .apk mmap     2048        0     1000        0     4000
      .dex mmap     1024        0      900        0     2000
    GL mtrack     3072     3072        0        0     3072
        TOTAL    51200    40000     4000        0    60000    46000    37000     9000

 Objects
               Views:      120         ViewRootImpl:        1
 Threads: 42
`;

export const MEMINFO_STOPPED = "No process found for: com.sig.presalio\n";

export const CPUINFO_LINE =
  "  12% 4321/com.sig.presalio: 8.5% user + 3.5% kernel / faults: 100 minor\n";

export const PACKAGE_DUMP = `Packages:
  Package [com.sig.presalio] (abc123):
    userId=10234
    pkg=Package{def com.sig.presalio}
    versionCode=45 minSdk=23 targetSdk=34
    requested permissions:
      android.permission.INTERNET
      android.permission.CAMERA
      android.permission.ACCESS_FINE_LOCATION
      android.permission.POST_NOTIFICATIONS
    install permissions:
      android.permission.INTERNET: granted=true
    User 0: ceDataInode=1 installed=true
      runtime permissions:
        android.permission.POST_NOTIFICATIONS: granted=true, flags=[ USER_SET|USER_SENSITIVE_WHEN_GRANTED ]
        android.permission.CAMERA: granted=false, flags=[ USER_SET ]
        android.permission.ACCESS_FINE_LOCATION: granted=true, flags=[ POLICY_FIXED ]
Activity Resolver Table:
  com.sig.presalio/com.getcapacitor.BridgeActivity filter
`;
