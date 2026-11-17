(() => {
  const get = id => document.getElementById(id);
  const input = get("tutorInput");
  const send = get("tutorSend");
  const log = get("tutorLog");
  const status = get("tutorStatus");
  const modelBadge = get("tutorModel");
  const form = get("tutorForm");
  const voiceNote = get("voiceNote");
  const readAloud = get("tutorSpeak");
  const mic = get("tutorMic");
  const messages = [];
  let busy = false;
  let player;
  let audioUrl;

  async function speak(content) {
    const audio = get("replyAudio");
    audio.pause();
    voiceNote.textContent = "Preparing Medusa’s voice…";
    try {
      const response = await fetch("/api/speak", {
        method: "POST", headers: {"Content-Type":"text/plain"}, body: content,
        signal: AbortSignal.timeout(45000)
      });
      if (!response.ok) throw new Error((await response.json()).error);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(await response.blob());
      audio.src = audioUrl;
      audio.hidden = false;
      player = audio;
      await audio.play();
      voiceNote.textContent = "Playing Medusa’s reply.";
    } catch (error) {
      voiceNote.textContent = error.name === "NotAllowedError"
        ? "Press Play on the audio controls to hear Medusa."
        : error.message || "Voice playback failed.";
    }
  }

  function addMessage(role, content) {
    const article = document.createElement("article");
    const name = document.createElement("strong");
    name.textContent = role === "user" ? "You" : "Medusa";
    const text = document.createElement("p");
    text.textContent = content;
    article.append(name, text);
    if (role === "assistant" && connectedPage) {
      const listen = document.createElement("button");
      listen.type = "button";
      listen.textContent = "Listen to reply";
      listen.addEventListener("click", () => speak(content));
      article.append(listen);
    }
    log.append(article);
    log.scrollTop = log.scrollHeight;
  }

  const connectedPage = location.protocol === "http:" && location.hostname === "127.0.0.1";
  if (connectedPage) {
    fetch("/api/status", { signal: AbortSignal.timeout(6500) })
      .then(response => response.json())
      .then(data => {
        if (!data.ready) throw new Error(data.error);
        modelBadge.textContent = "Local Ollama · " + data.model;
      })
      .catch(error => {
        modelBadge.textContent = "Ollama · unavailable";
        status.textContent = error.message || "Could not reach Ollama.";
      });
  } else {
    modelBadge.textContent = "Ollama · disconnected";
    status.textContent = "Open the local Medusa Lab server to connect Ollama.";
    send.disabled = true;
    const link = document.createElement("a");
    link.href = "http://127.0.0.1:8765/#tutor";
    link.textContent = "Open local tutor";
    status.after(link);
  }

  readAloud.disabled = !connectedPage;
  readAloud.addEventListener("change", () => {
    if (!readAloud.checked) player?.pause();
  });

  let recorder, stream, stopTimer;
  mic.disabled = !connectedPage || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder;
  voiceNote.textContent = mic.disabled
    ? "Microphone capture requires a supported browser on the local lab address."
    : "Select Ask by voice, speak, then select Stop recording. Review the transcript before sending.";
  mic.addEventListener("click", async () => {
    if (recorder?.state === "recording") {
      recorder.stop();
      return;
    }
    mic.disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        clearTimeout(stopTimer);
        stream.getTracks().forEach(track => track.stop());
        mic.disabled = true;
        mic.textContent = "Ask by voice";
        mic.setAttribute("aria-pressed", "false");
        voiceNote.textContent = "Transcribing on this PC…";
        try {
          const audio = new Blob(chunks, { type: recorder.mimeType });
          const response = await fetch("/api/transcribe", { method: "POST", body: audio, signal: AbortSignal.timeout(60000) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          input.value = [input.value.trim(), data.text].filter(Boolean).join(" ").slice(0, input.maxLength);
          input.focus();
          voiceNote.textContent = "Review your question, then press Send.";
        } catch (error) {
          voiceNote.textContent = error.message || "The recording could not be transcribed.";
        } finally {
          mic.disabled = false;
        }
      };
      recorder.start();
      stopTimer = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 25000);
      mic.textContent = "Stop recording";
      mic.setAttribute("aria-pressed", "true");
      voiceNote.textContent = "Listening…";
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      voiceNote.textContent = error.name === "NotAllowedError"
        ? "Allow microphone access in your browser and Windows settings, then try again."
        : "No microphone could be opened. Check your input device.";
    } finally {
      mic.disabled = false;
    }
  });

  for (const suggestion of document.querySelectorAll("[data-question]")) {
    suggestion.disabled = !connectedPage;
    suggestion.addEventListener("click", () => {
      if (busy) return;
      input.value = suggestion.dataset.question;
      form.requestSubmit();
    });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || busy || !connectedPage) return;
    busy = true;
    send.disabled = true;
    input.value = "";
    addMessage("user", content);
    status.textContent = "Medusa is thinking…";
    const question = { role: "user", content };
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages.slice(-8), question], context: window.getSmithTutorContext() }),
        signal: AbortSignal.timeout(125000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      messages.push(question, { role: "assistant", content: data.reply });
      if (messages.length > 8) messages.splice(0, messages.length - 8);
      addMessage("assistant", data.reply);
      modelBadge.textContent = "Local Ollama · " + data.model;
      status.textContent = "";
      if (readAloud.checked && !readAloud.disabled) speak(data.reply);
    } catch (error) {
      status.textContent = error.message || "Medusa could not reply.";
      if (!input.value.trim()) input.value = content;
    } finally {
      busy = false;
      send.disabled = false;
    }
  });
})();
