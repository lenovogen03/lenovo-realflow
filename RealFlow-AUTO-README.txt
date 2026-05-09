================================================================
   REALFLOW AUTO - SIRF EK FILE, BAS
   + GitHub Auto-Update (no more manual download/extract)
================================================================

YEHI EK FILE:  RealFlow-AUTO.bat

Pehli baar setup karein, phir kabhi kuch karne ki zaroorat NAHI.
Aap GitHub mein code save karein, 5 mint ke andar khud-ba-khud
aap ke local Docker mein deploy ho jayega.

================================================================
   PEHLI BAAR USAGE — 30 SECONDS
================================================================

1. Right-click on RealFlow-AUTO.bat
2. "Run as administrator" select karein
3. Pehli baar GitHub repo URL paste karein:
      Example: https://github.com/yourname/realflow.git
4. Yeh khud sab kuch handle karega:

   [0/9] GitHub repo configure (sirf 1 dafa)
   [1/8] Backup .env + DB + uploaded files (auto safety)
   [2/8] Old containers stop + clean
         (uploaded files PRESERVED across runs)
   [3/8] Fresh .env file (admin creds preserved)
   [4/8] Containers build (3-5 mint)
   [5/8] Services start
         + Auto-migration: uploaded files restored
   [6/8] Backend ready check (auto retry)
   [7/8] Admin user FORCE re-seed
   [8/8] Login verify (red/green output)
   [9/9] Task Scheduler register: HAR 5 MIN auto-pull

   Done. Ab future me bas:

   * GitHub me code save karein (Emergent ya kahin se)
   * 5 mint ke andar khud rebuild + redeploy ho jayega
   * Aap ko kuch nahi karna

================================================================
   AUTO-WATCHER KAISE KAAM KARTA HAI
================================================================

* Windows Task Scheduler "RealFlowAutoUpdate" task banta hai
* Har 5 minute pe silently chalta hai
* git fetch karta hai
* Naye commits hon to:
    - git reset --hard origin/main
    - docker compose build
    - docker compose up -d
    - Backend ready check
* Naye commits na hon to: 1 second mein khatam, kuch nahi karta
* Logs file:  watcher.log
* Pura system khud chalta hai background mein

================================================================
   AUTO-WATCHER BAND KARNA HO TO
================================================================

CMD/PowerShell mein:
    "F:\online\real flow\realflow\RealFlow-AUTO.bat" _UNINSTALL_

Yeh sirf scheduled task hatayega. Containers chalte rahenge.

Dobara enable karna ho:
    RealFlow-AUTO.bat ko dobara double-click

================================================================
   AUTO FILE PRESERVATION — uploaded XLSX/proxies/UAs
================================================================

Aap ne XLSX data, proxies, user-agents, automation JSONs upload
kiye hue hain — YEH AB AUTO PRESERVE HOTI HAI:

  * uploaded-data volume     -> har run mein survive
  * rut-results volume       -> screenshots + leftover XLSX safe
  * mongo-data backup        -> DB ki snapshot tar.gz mein

Pehli baar AUTO.bat chalayein to:
  - Old container ka uploaded_resources backup banta hai
  - Naye volume mein migrate ho jata hai
  - Future runs mein woh volume preserved rehti hai

Aap ko DOBARA upload karne ki zaroorat NAHI.

================================================================
   IF SOMETHING FAILS
================================================================

Logs file dekhe:
   F:\online\real flow\realflow\deploy.log
   F:\online\real flow\realflow\watcher.log

Backup folder mein purani DB safe hai:
   F:\online\real flow\realflow-backups\auto-YYYYMMDD-HHMMSS\

Manual force-rebuild karna ho:
   RealFlow-AUTO.bat ko dobara double-click

================================================================
