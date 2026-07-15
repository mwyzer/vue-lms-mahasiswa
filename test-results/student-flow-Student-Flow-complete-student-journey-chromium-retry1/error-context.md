# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-flow.spec.ts >> Student Flow >> complete student journey
- Location: app\test\e2e\student-flow.spec.ts:30:3

# Error details

```
Error: browser.newContext: Target page, context or browser has been closed
Browser logs:

<launching> C:\Users\unser\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --no-sandbox --app=data:text/html, --window-size=600,600 --window-position=1020,10 --test-type= --user-data-dir=C:\Users\unser\AppData\Local\Temp\playwright_chromiumdev_profile-cur59O --remote-debugging-pipe about:blank
<launched> pid=8120
[pid=8120][err] [0714/223004.565:ERROR:chrome\app\main_dll_loader_win.cc:141] Failed to load Chrome DLL from C:\Users\unser\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.dll: The paging file is too small for this operation to complete. (0x5AF)
```