# TGM downloads

Download TGM for Android and Windows from the [latest release](https://github.com/AlwinsonTGM/TGM/releases/latest). This public repository hosts app downloads and optional model and theme files; the application source repositories are private.

## Android

Download the APK from the latest release and open it on your Android device. You may need to allow your browser or file manager to install apps. The APK is debug-signed; an existing installation can be updated in place only if it uses the same signing key.

## Windows

Download the Windows `.exe` installer from the same release and run it. Windows updates currently require downloading and running a newer installer.

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
