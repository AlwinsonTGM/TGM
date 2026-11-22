# TGM Android — public artifacts

This repository contains **only** downloadable artifacts for the private
[`tgm-android`](https://github.com/AlwinsonTGM/tgm-android) project. It is public so the app can
fetch model weights and updates without a GitHub token.

## Install the app

Download the APK from the latest release and install it over an existing `com.tgm.task`:

```bash
adb install -r tgm-android-1.1.0-arm64-debug.apk
```

The APK is a debug-signed `arm64-v8a` build (Android 8.0+). Updating never clears tasks, habits,
notes, focus history or budget data.

## System One models

| File | Bytes | Purpose |
| --- | ---: | --- |
| `laya-model.onnx` | 3,128,708 | Laya graph (System One Text) |
| `laya-model.onnx.data` | 606,338,048 | Laya external initializer |
| `d1-omni-600M-Q8_0.gguf` | 407,207,584 | d1-omni vision weights (runtime pending) |
| `mmproj-d1-omni-600M-Q8_0.gguf` | 262,791,232 | d1-omni vision projector (runtime pending) |

Open **Settings → AI & Connections → On-device model library** and tap **Download**. Laya verifies
both SHA-256 hashes, activates itself and binds to routing. d1-omni is stored and verified but
remains **Downloaded** because this build has no GGUF vision runtime.

Licenses: Laya is Apache-2.0; d1-omni uses the LFM Open License. Model cards:
`inferenceprince/laya-onnx-int8` and `LiquidAI/d1-omni-600M-GGUF` on Hugging Face.
