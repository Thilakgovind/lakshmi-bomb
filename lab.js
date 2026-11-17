const $ = id => document.getElementById(id);
const tau = 2 * Math.PI;
const mod = (value, period) => ((value % period) + period) % period;
const num = (value, digits = 4) => (Math.abs(value) < .5 * 10 ** -digits ? 0 : value).toFixed(digits);
const complex = ({re, im}, digits = 3) => num(re, digits) + (im < -0.5 * 10 ** -digits ? " − j" : " + j") + num(Math.abs(im), digits);

function gammaAt(model, distance) {
  const phase = model.phase - 2 * tau * distance;
  return {re:model.rho * Math.cos(phase), im:model.rho * Math.sin(phase)};
}

function lineAt(model, distance) {
  const gamma = gammaAt(model, distance);
  const {re, im} = gamma;
  const numerator = 1 - model.rho ** 2;
  const zDen = (1 - re) ** 2 + im ** 2;
  const yDen = (1 + re) ** 2 + im ** 2;
  return {gamma, z:{re:numerator / zDen, im:2 * im / zDen}, y:{re:numerator / yDen, im:-2 * im / yDen}};
}

function solve(z0, vswr, minimum) {
  const rho = (vswr - 1) / (vswr + 1);
  const phase = Math.PI + 2 * tau * minimum;
  const model = {z0, vswr, minimum, rho, phase};
  const load = lineAt(model, 0);
  const angle = Math.acos(-rho);
  const solutions = rho === 0 ? [] : [angle, -angle].map(crossing => {
    let d = mod((phase - crossing) / (2 * tau), .5);
    if (.5 - d < 1e-12) d = 0;
    const {y} = lineAt(model, d);
    const b = -y.im;
    const short = Math.atan2(1, -b) / tau;
    const open = mod(Math.atan(b) / tau, .5);
    return {d, y, b, short, open};
  }).sort((a, b) => a.d - b.d);
  return {...model, load, solutions};
}

function verify(solution, termination) {
  const angle = tau * solution[termination];
  const stubB = termination === "short" ? -1 / Math.tan(angle) : Math.tan(angle);
  const y = {re:solution.y.re, im:solution.y.im + stubB};
  const rho = Math.hypot(1 - y.re, y.im) / Math.hypot(1 + y.re, y.im);
  return {y, rho, vswr:(1 + rho) / (1 - rho)};
}

const steps = [
  {time:2.6, name:"Start", title:"See the wave mismatch", explain:"Medusa starts at the load, where the incoming wave meets a different impedance. Part of the wave reflects back toward the generator.", observe:"The Smith chart turns that reflection into a point. The centre means the line is perfectly matched.", equation:m => `Z₀ = ${m.z0} Ω · VSWR = ${m.vswr} · first voltage minimum = ${m.minimum}λ`},
  {time:4.6, name:"Reflection", title:"Read the circle", explain:"VSWR tells us how strong the reflection is. That strength sets the radius of the circle Medusa draws around the chart.", observe:"Moving along a lossless line rotates the point around this circle, but does not change its radius.", equation:m => `|Γ| = (VSWR − 1)/(VSWR + 1) = ${num(m.rho)}`},
  {time:6.8, name:"Bell · Locate load", title:"Use the minimum to locate the load", explain:"At a voltage minimum, the reflected wave is 180° out of phase with the incident wave. Moving toward the generator rotates Γ clockwise, so we rotate back by 720° per wavelength to find the load.", observe:"The voltage minimum sits on the negative real axis. On the default problem, the load lies below the horizontal axis, consistent with capacitive reactance.", equation:m => m.rho ? `∠Γ at load = 180° + 720° × ${m.minimum} ≡ ${num(mod(m.phase * 180 / Math.PI + 180,360)-180,2)}°` : "Γ = 0, so there is no unique minimum or reflection phase."},
  {time:8.4, name:"Admittance", title:"Choose the useful grid", explain:"Medusa flips from impedance to admittance because a parallel stub adds directly to admittance. The real part is conductance g; the imaginary part is susceptance b.", observe:"Use the admittance grid when you are adding a shunt stub.", equation:m => `z = ${complex(m.load.z)} · y = 1/z = ${complex(m.load.y)}`},
  {time:11.2, name:"Arm · Choose position", title:"Move until conductance equals 1", explain:"The stub can change susceptance b, the imaginary part of admittance. Find places where normalized conductance g, the real part, already equals 1.", observe:"Move the probe clockwise along the VSWR circle, or select A or B below. The dashed circle marks g = 1.", equation:m => m.solutions.length ? m.solutions.map((s,i) => `${"AB"[i]}: d = ${num(s.d)}λ, y = ${complex(s.y)}`).join("  ·  ") : "The line is already matched everywhere."},
  {time:14, name:"Stub", title:"Cancel the remaining susceptance", explain:"At the g = 1 crossing, add a parallel stub with equal and opposite susceptance. The marker follows the g = 1 curve toward the centre.", observe:"Changing the termination changes the stub length. The junction stays in the same place.", equation:(m,s,term) => s ? `b(stub) = −b(line) = ${num(s.b)} · ℓ = ${num(s[term])}λ` : "No stub is required."},
  {time:17.5, name:"Teardown · Compare", title:"Compare the two designs", explain:"A full rotation along half a wavelength crosses g = 1 twice. Either crossing works if you use its own stub length.", observe:"Select both options in turn to see how the junction location and required stub length change.", equation:(m,s,term) => s ? `Selected junction: ${num(s.d)}λ · selected stub: ${num(s[term])}λ (${num(s[term]*360,2)}°)` : "The reflection coefficient is zero, so there are no distinct crossings."},
  {time:21, name:"Reassembly · Verify", title:"Verify the match", explain:"Add the two admittances at the junction. When the imaginary parts cancel and the real part is 1, the source side sees Z₀ and the ideal VSWR is 1.", observe:"The center marks the matched condition on the generator side of the junction. Between the junction and the load, the original standing wave remains.", equation:(m,s,term) => s ? `y(total) = ${complex(verify(s,term).y)} · |Γ| = ${num(verify(s,term).rho)} · VSWR = ${num(verify(s,term).vswr)}` : "y(total) = 1 + j0 · |Γ| = 0 · VSWR = 1"}
];

const stepStarts = [0, 3.3, 5.7, 7.5, 9.9, 12.7, 15.8, 19.3];
const stepNames = ["Measurements", "VSWR circle", "Locate load", "Admittance", "Find junction", "Size stub", "Compare", "Verify match"];
const chartBasics = ["Smith chart basics · Alan Wolke", "https://www.youtube.com/watch?v=TsXd6GktlYQ"];
const reflectionVideo = ["VSWR and reflection · Alan Wolke", "https://www.youtube.com/watch?v=ImNRca5ecF0"];
const stubVideo = ["Worked shunt-stub example · Ansys", "https://innovationspace.ansys.com/courses/courses/impedance-matching/lessons/impedance-matching-using-stubs-part-2-lesson-2/"];
const stepVideos = [chartBasics, reflectionVideo, reflectionVideo, chartBasics, stubVideo, stubVideo, stubVideo, stubVideo];
const tour = $("tour");
const tourOrigin = location.protocol === "file:" ? "*" : location.origin;
const duration = 25;
let model, step = 0, selected = 0, playhead = 0, playing = false, followTour = false;
let animationFrame, lastTick, stopAt = duration;
let liveFrame, liveTime, wavePhase = 0;
function setLive(running) {
  if (liveFrame) cancelAnimationFrame(liveFrame);
  liveFrame = null;
  liveTime = null;
  $("runLive").setAttribute("aria-pressed", running);
  $("runLive").textContent = running ? "Pause live probe" : "Run live probe";
  if (running) {
    setPlaying(false);
    followTour = false;
    liveFrame = requestAnimationFrame(advanceProbe);
  }
}

function advanceProbe(now) {
  if (liveTime === null) liveTime = now;
  if (now - liveTime >= 36) {
    const dt = Math.min(.1, (now - liveTime) / 1000);
    liveTime = now;
    $("probe").value = mod(Number($("probe").value) + dt * .085, .5);
    wavePhase = mod(wavePhase + dt * tau, tau);
    renderChart();
  }
  liveFrame = requestAnimationFrame(advanceProbe);
}

function setPlaying(value, stop = stopAt) {
  if (value) setLive(false);
  playing = value;
  stopAt = stop;
  $("tourToggle").textContent = playing ? "Pause walkthrough" : "Play full walkthrough";
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  lastTick = null;
  if (playing) animationFrame = requestAnimationFrame(advanceLesson);
}

function advanceLesson(now) {
  if (lastTick === null) lastTick = now;
  if (now - lastTick >= 35) {
    const next = Math.min(stopAt, playhead + Math.min(.1, (now - lastTick) / 1000) * .64);
    lastTick = now;
    applyTourTime(next);
    if (next === stopAt) {
      setPlaying(false);
      return;
    }
  }
  animationFrame = requestAnimationFrame(advanceLesson);
}

function applyTourTime(time) {
  playhead = time;
  $("tourTime").value = time;
  $("tourClock").textContent = `${time.toFixed(1)} / ${duration} s`;
  const next = stepStarts.findLastIndex(start => time >= start);
  const changed = step !== next;
  step = next;
  updateTourProbe();
  if (changed) {
    $("view").value = step < 3 ? "z" : "y";
    renderLesson();
  }
  renderChart();
  tour.contentWindow.postMessage({type:"medusa-seek", time}, tourOrigin);
}

function progress(start, end) {
  return Math.min(1, Math.max(0, (playhead - start) / (end - start)));
}

function updateTourProbe() {
  if (!followTour || !model) return;
  const target = model.solutions[selected]?.d ?? 0;
  let distance = 0;
  if (step === 2) distance = model.minimum * progress(5.7, 7.2);
  if (step === 4) distance = target * progress(9.9, 12.45);
  if (step >= 5) distance = target;
  $("probe").value = distance;
}

function seekStep(index) {
  setLive(false);
  setPlaying(false);
  followTour = true;
  $("view").value = index < 3 ? "z" : "y";
  applyTourTime((stepStarts[index + 1] ?? duration) - .01);
}
stepNames.forEach((name,index) => {
  const button = document.createElement("button");
  button.textContent = (index+1) + ". " + name;
  button.onclick = () => seekStep(index);
  $("steps").append(button);
});
let roomReady = false;
setTimeout(() => {
  if (!roomReady) $("tourState").textContent = "The 3D room could not start. The live chart is available.";
}, 10000);
addEventListener("message", event => {
  if (event.source !== tour.contentWindow || (tourOrigin !== "*" && event.origin !== tourOrigin)) return;
  const time = event.data?.time;
  if (event.data?.type !== "medusa-time" || !Number.isFinite(time)) return;
  $("tourState").hidden = true;
  if (!roomReady) {
    roomReady = true;
    applyTourTime(playhead);
  }
});
$("tourToggle").addEventListener("click", () => {
  followTour = true;
  if (!playing && playhead === duration) applyTourTime(0);
  setPlaying(!playing, duration);
});
$("previousStep").addEventListener("click", () => seekStep(Math.max(0, step - 1)));
$("nextStep").addEventListener("click", () => seekStep(Math.min(steps.length - 1, step + 1)));
$("replayStep").addEventListener("click", () => {
  followTour = true;
  const start = stepStarts[step];
  const end = (stepStarts[step + 1] ?? duration) - .01;
  $("view").value = step < 3 ? "z" : "y";
  applyTourTime(start);
  setPlaying(true, end);
});
$("tourTime").addEventListener("input", event => {
  setLive(false);
  setPlaying(false);
  followTour = true;
  const time = Number(event.target.value);
  applyTourTime(time);
});
$("runLive").addEventListener("click", () => {
  if (model || liveFrame) setLive(!liveFrame);
});
$("roam").addEventListener("change", event => {
  tour.contentWindow.postMessage({type:"medusa-roam", enabled:event.target.checked}, tourOrigin);
});

function renderLesson() {
  const item = steps[step];
  [...$("steps").children].forEach((button,index) => button.setAttribute("aria-pressed", index === step));
  $("stepLabel").textContent = `Step ${step+1} of ${steps.length}`;
  $("stepTitle").textContent = item.title;
  $("explanation").textContent = item.explain;
  $("observe").textContent = item.observe;
  $("equation").textContent = model ? item.equation(model,model.solutions[selected],$("termination").value) : "Enter valid measurements to calculate this step.";
  $("previousStep").disabled = step === 0;
  $("nextStep").disabled = step === steps.length - 1;
  const [title, url] = stepVideos[step];
  $("stepVideo").textContent = "Watch video: " + title;
  $("stepVideo").href = url;
}

const chartRadius = 165;
const chartValues = [.1, .2, .3, .5, .7, 1, 1.5, 2, 3, 5, 10];
const labeledValues = [.2, .5, 1, 2, 5];
const chartScales = Array.from({length:50}, (_, index) => {
  const angle = Math.PI - tau * index / 50;
  const major = index % 5 === 0;
  const x = Math.cos(angle), y = -Math.sin(angle);
  return `<line x1="${x*173}" y1="${y*173}" x2="${x*(major ? 182 : 177)}" y2="${y*(major ? 182 : 177)}" stroke="#5C4E4E"/>` +
    (major ? `<text class="scale-label" x="${x*194}" y="${y*194}" text-anchor="middle" dominant-baseline="central" fill="#5C4E4E">${num(index/100,2)}</text>` : "");
}).join("");

function renderWave(distance) {
  const wave = $("wave");
  if (!model) {
    wave.replaceChildren();
    return;
  }
  const curves = {upper:[], lower:[], voltage:[]};
  const xAt = d => 42 + (.5 - d) * 1000;
  for (let index = 0; index <= 120; index++) {
    const d = .5 * (1 - index / 120);
    const gamma = gammaAt(model,d);
    const envelope = Math.hypot(1 + gamma.re, gamma.im);
    const voltage = Math.cos(wavePhase + tau*d) + model.rho * Math.cos(wavePhase - tau*d + model.phase);
    const point = (value) => `${index ? "L" : "M"}${num(xAt(d),2)},${num(68 - 29 * value,2)}`;
    curves.upper.push(point(envelope));
    curves.lower.push(point(-envelope));
    curves.voltage.push(point(voltage));
  }
  const minX = xAt(model.minimum);
  const probeX = xAt(distance);
  wave.innerHTML = `<path d="M42 10V126H542 M42 68H542" fill="none" stroke="#988686"/>
    <path d="${curves.upper.join("")} ${curves.lower.join("")}" fill="none" stroke="#5C4E4E" stroke-width="1.5" stroke-dasharray="5 4"/>
    <path d="${curves.voltage.join("")}" fill="none" stroke="#000000" stroke-width="2"/>
    ${model.rho ? `<line x1="${minX}" x2="${minX}" y1="14" y2="126" stroke="#988686" stroke-dasharray="2 4"/><text x="${Math.min(535, minX + 5)}" y="16" text-anchor="${minX > 510 ? "end" : "start"}">Vmin</text>` : ""}
    <line x1="${probeX}" x2="${probeX}" y1="20" y2="126" stroke="#5C4E4E" stroke-width="2"/><text x="42" y="146">0.50λ from load</text><text x="542" y="146" text-anchor="end">Load · 0λ</text>`;
}

function renderReadings(effective, impedance, admittance, distance) {
  const rho = Math.hypot(effective.re,effective.im);
  const loadOhms = {re:model.load.z.re * model.z0, im:model.load.z.im * model.z0};
  const pairs = [
    ["Line VSWR", num(model.vswr, 3)],
    ["Load impedance Zₗ", complex(loadOhms, 2) + " Ω"],
    ["Probe distance", num(distance, 4) + "λ"],
    ["Reflection at marker", num(rho, 3) + (rho > 1e-9 ? " ∠ " + num(Math.atan2(effective.im, effective.re)*180/Math.PI,1) + "°" : "")],
    ["Normalized impedance z", complex(impedance)],
    ["Normalized admittance y", complex(admittance)],
    ["VSWR at marker", num((1 + rho) / (1 - rho), 3)],
    ["Return loss at marker", rho < 1e-9 ? "∞ dB" : num(-20 * Math.log10(rho), 2) + " dB"],
    ["Reflected power at marker", num(100 * rho**2, 1) + "%"],
    ["Voltage min / max", num(1 - model.rho, 3) + " / " + num(1 + model.rho, 3)]
  ];
  $("liveReadings").innerHTML = pairs.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

function renderChart() {
  const svg = $("smith");
  const lineProbe = $("lineProbe");
  const junction = $("lineJunction");
  if (!model) {
    lineProbe.hidden = junction.hidden = true;
    svg.replaceChildren();
    $("liveReadings").replaceChildren();
    renderWave(0);
    tour.contentWindow.postMessage({type:"medusa-chart", chart:null}, tourOrigin);
    $("probeReadout").textContent = "Enter valid measurements to plot the load.";
    return;
  }
  const R = chartRadius;
  const view = $("view").value;
  const sign = view === "z" ? 1 : -1;
  const circle = (x,y,r,stroke,width=1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
  const mark = (point,color,label,offset=11) => {
    const x = point.re * R, y = -point.im * R;
    return `<circle cx="${x}" cy="${y}" r="5" fill="${color}"><title>${label}</title></circle><text x="${x+7}" y="${y-offset}" fill="${color}">${label}</text>`;
  };
  const grid = chartValues.map(v => circle(sign*R*v/(1+v),0,R/(1+v),"#D1D0D0")).join("") +
    chartValues.flatMap(v => [-v,v]).map(v => circle(sign*R,-sign*R/v,R/Math.abs(v),"#D1D0D0")).join("");
  const realLabels = labeledValues.map(v =>
    `<text class="grid-label" x="${sign*R*(v-1)/(v+1)}" y="12" text-anchor="middle" fill="#5C4E4E">${v}</text>`
  ).join("");
  const imaginaryLabels = labeledValues.flatMap(v => [-v,v]).map(v =>
    `<text class="grid-label" x="${sign*151*(v*v-1)/(v*v+1)}" y="${sign*-151*2*v/(v*v+1)}" text-anchor="middle" dominant-baseline="central" fill="#5C4E4E">${v > 0 ? "+" : "−"}${Math.abs(v)}</text>`
  ).join("");
  const solution = model.solutions[selected];
  const matching = followTour && step >= 5 && Boolean(solution);
  const d = matching ? solution.d : Number($("probe").value);
  lineProbe.hidden = false;
  lineProbe.style.left = `${100 - d * 200}%`;
  junction.hidden = !solution || (followTour && step < 4);
  if (solution) junction.style.left = `${100 - solution.d * 200}%`;
  const probe = lineAt(model,d);
  const fraction = step === 5 ? progress(12.7, 15.6) : 1;
  const stub = matching ? solution.b * fraction : 0;
  const y = matching ? {re:solution.y.re, im:solution.y.im + stub} : probe.y;
  const toGamma = ({re,im}) => {
    const den = (1 + re) ** 2 + im ** 2;
    return {re:(1 - re ** 2 - im ** 2) / den, im:-2 * im / den};
  };
  const effective = matching ? toGamma(y) : probe.gamma;
  const impedanceDenominator = (1 - effective.re)**2 + effective.im**2;
  const z = matching ? {
    re:(1 - effective.re**2 - effective.im**2) / impedanceDenominator,
    im:2 * effective.im / impedanceDenominator
  } : probe.z;
  const showCircle = !followTour || step >= 1;
  const showMinimum = !followTour || step >= 2;
  const showCrossings = !followTour || step >= 4;
  const crossings = showCrossings ? model.solutions.map(item => gammaAt(model,item.d)) : [];
  const cancellation = matching ? Array.from({length:33},(_,i) => {
    const point = toGamma({re:y.re, im:solution.y.im + stub*i/32});
    return `${i ? "L" : "M"}${point.re*R},${-point.im*R}`;
  }).join(" ") : "";
  const trace = Array.from({length:65},(_,i) => {
    const {re,im} = gammaAt(model,d*i/64);
    return `${i ? "L" : "M"}${re*R},${-im*R}`;
  }).join(" ");
  tour.contentWindow.postMessage({
    type:"medusa-chart",
    chart:{
      view, rho:model.rho, load:model.load.gamma, showCircle, showMinimum, crossings,
      trace, cancellation, effective
    }
  }, tourOrigin);
  svg.innerHTML = `<defs><clipPath id="disk"><circle r="${R}"/></clipPath></defs>
    <g transform="translate(200 200)">
      <g clip-path="url(#disk)">${grid}<line x1="-165" x2="165" y1="0" y2="0" stroke="#988686"/></g>
      ${circle(0,0,R,"#5C4E4E")} ${chartScales}
      ${view === "y" ? `<circle cx="${-R/2}" cy="0" r="${R/2}" fill="none" stroke="#5C4E4E" stroke-width="2" stroke-dasharray="7 4"/>` : ""}
      ${showCircle && model.rho ? `<circle cx="0" cy="0" r="${model.rho*R}" fill="none" stroke="#988686" stroke-width="2.5" stroke-dasharray="2 4"/>` : ""}
      ${realLabels}${imaginaryLabels}
      <path d="${trace}" stroke="#5C4E4E" stroke-width="2.5" fill="none"/>
      ${mark({re:0,im:0},"#5C4E4E","Match",-18)}
      ${model.rho && showMinimum ? mark({re:-model.rho,im:0},"#5C4E4E","Vmin",-18) : ""}
      ${model.rho ? mark(model.load.gamma,"#000000","Load") : ""}
      ${crossings.map((point,index) => mark(point,"#5C4E4E","AB"[index])).join("")}
      <path d="${cancellation}" stroke="#000000" stroke-width="4" fill="none"/>
      <circle cx="${effective.re*R}" cy="${-effective.im*R}" r="7.5" fill="#D1D0D0" stroke="#000000" stroke-width="2"/>
      <circle cx="${model.load.gamma.re*R}" cy="${-model.load.gamma.im*R}" r="15" fill="transparent" data-load-handle="true"><title>Drag to change load</title></circle>
    </g>`;
  $("probeReadout").textContent = matching ? `Junction at ${num(solution.d)}λ · total y = ${complex(y)}` : `d = ${num(d)}λ · z = ${complex(probe.z)} · y = ${complex(probe.y)}`;
  renderReadings(effective,z,y,d);
  renderWave(d);
}

function renderResults() {
  const options = $("options");
  if (!model || !model.solutions.length) {
    options.textContent = model ? "VSWR is 1. The load is already matched." : "Enter valid measurements to see the matching networks.";
    return;
  }
  const term = $("termination").value;
  options.innerHTML = model.solutions.map((item,index) => {
    const result = verify(item,term);
    return `<article class="solution ${index === selected ? "active" : ""}">
      <h3>Option ${"AB"[index]}</h3>
      <dl><dt>From load toward generator</dt><dd>${num(item.d)}λ</dd>
      <dt>Line admittance at junction</dt><dd>${complex(item.y)}</dd>
      <dt>Stub susceptance</dt><dd>${num(item.b)}</dd>
      <dt>Short-circuit length</dt><dd>${num(item.short)}λ</dd>
      <dt>Open-circuit length</dt><dd>${num(item.open)}λ</dd>
      <dt>Verified VSWR (${term})</dt><dd>${num(result.vswr)}</dd></dl>
      <button type="button" data-option="${index}" aria-pressed="${index === selected}">Inspect option ${"AB"[index]}</button>
    </article>`;
  }).join("");
}

function update() {
  const fields = ["z0","vswr","minimum"].map($);
  const [z0,vswr,minimum] = fields.map(field => field.valueAsNumber);
  const invalid = fields.some(field => !field.validity.valid || !Number.isFinite(field.valueAsNumber));
  model = invalid ? null : solve(z0,vswr,minimum);
  if (invalid) setLive(false);
  $("runLive").disabled = invalid;
  $("error").hidden = !invalid;
  $("error").textContent = invalid ? "Use Z₀ between 0.01 and 1,000,000 Ω, VSWR between 1 and 1,000, and a minimum distance from 0 to 0.499999λ." : "";
  $("minimum").disabled = !invalid && vswr === 1;
  updateTourProbe();
  renderLesson();
  renderChart();
  renderResults();
}

$("inputs").addEventListener("input", update);
$("inputs").addEventListener("reset", () => setTimeout(() => { selected = 0; seekStep(0); update(); }, 0));
$("inputs").addEventListener("submit", event => event.preventDefault());
$("probe").addEventListener("input",() => {
  setLive(false);
  followTour = false;
  setPlaying(false);
  renderChart();
});
$("view").addEventListener("change",renderChart);

const smith = $("smith");
let loadPointer = null;
smith.addEventListener("pointerdown", event => {
  if (!model || loadPointer !== null || event.button !== 0 || !event.target.closest("[data-load-handle]")) return;
  loadPointer = event.pointerId;
  smith.setPointerCapture(loadPointer);
  smith.classList.add("is-dragging");
  setPlaying(false);
  followTour = false;
  event.preventDefault();
});
smith.addEventListener("pointermove", event => {
  if (event.pointerId !== loadPointer) return;
  const matrix = smith.getScreenCTM();
  if (!matrix) return;
  const local = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  const re = (local.x - 200) / chartRadius;
  const im = (200 - local.y) / chartRadius;
  const rho = Math.min(999 / 1001, Math.hypot(re,im));
  const phase = Math.atan2(im,re);
  $("vswr").value = num((1 + rho) / (1 - rho),4);
  $("minimum").value = num(Math.min(.499999, mod((phase - Math.PI) / (2 * tau),.5)),6);
  update();
});
smith.addEventListener("lostpointercapture", () => {
  loadPointer = null;
  smith.classList.remove("is-dragging");
});

window.getSmithTutorContext = () => ({
  currentStep: steps[step].title,
  explanation: steps[step].explain,
  observation: steps[step].observe,
  equation: $("equation").textContent,
  currentChartReading: $("probeReadout").textContent,
  grid: $("view").value === "y" ? "admittance" : "impedance",
  measurements: model ? { z0Ohms: model.z0, vswr: model.vswr, minimumWavelengths: model.minimum } : null,
  matchingOptions: model?.solutions.map(({ d, short, open }, index) => ({
    option: "AB"[index], junctionWavelengths: num(d), shortStubWavelengths: num(short), openStubWavelengths: num(open)
  })) ?? [],
  selectedOption: model?.solutions.length ? "AB"[selected] : null,
  stubTermination: $("termination").value
});
$("options").addEventListener("click",event => {
  const button = event.target.closest("[data-option]");
  if (!button || !model) return;
  selected = Number(button.dataset.option);
  seekStep(4);
  renderResults();
  $("options").querySelector(`[data-option="${selected}"]`).focus();
  renderLesson();
  renderChart();
});

update();
