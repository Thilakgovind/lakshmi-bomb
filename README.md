# lakshmi-bomb

Medusa JF-4 is an interactive Smith chart lab. The robot roams beside the chart in a shared 3D room. Play the guided example or move the probe manually to inspect a lossless transmission line and compare both single-stub matches.

Drag the load marker to change the load reflection coefficient. **Run live probe** scans half a wavelength repeatedly and animates the incident and reflected voltage sum. Use the impedance/admittance selector to switch chart grids, or play the guided example to trace the stub match.

## Run locally

Install Node.js 22 or later and [Ollama](https://ollama.com/download). For microphone input on Windows, install FFmpeg and make sure `ffmpeg -version` works from the terminal. Microphone transcription and audio replies use Windows Speech, so install an English speech recognizer and voice if your Windows installation lacks them.

```sh
npm ci
ollama pull qwen2.5:3b
npm start
```

With Ollama running, open [Medusa Lab](http://127.0.0.1:8765/) in Edge or Chrome. Use **Ask Medusa** for chat. To dictate, use **Ask by voice**, allow microphone access, speak, and select **Stop recording**. Review the transcript and send it. Use **Listen to reply** to play Medusa’s answer.

The server binds to loopback. Chat runs through your local Ollama model, and voice recordings are processed and discarded on your Windows PC. The lab uses WebGL for the room and offers a flat chart with the same live calculations when WebGL is unavailable. You can run the lesson without Ollama. Set `MEDUSA_OLLAMA_MODEL` to choose another installed model or `MEDUSA_PORT` to use a different local port.

The Gothic Noir theme pairs Sharpie headings with Array labels and controls. For local use, download [Sharpie](https://www.fontshare.com/fonts/sharpie) and [Array](https://www.fontshare.com/fonts/array) and put the official `Sharpie-Variable.woff2`, `Array-Regular.woff2`, and `Array-Semibold.woff2` files in the repository root. The font files are gitignored. The layout falls back to Georgia and the system monospace font when the files are unavailable.

## Deploy on Vercel

Import this GitHub repository into Vercel. The root `vercel.json` installs dependencies with `npm ci`, runs `npm run build`, and publishes `dist/`. The static build includes the simulator, 3D room, and lesson resources. No environment variables are required.

Ollama chat and Windows speech run on your PC with `npm start`. The hosted page links to the local tutor. The static build uses system font fallbacks on devices without Sharpie and Array installed.
