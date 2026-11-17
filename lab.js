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
  {time:11.2, name:"Arm · Choose position", title:"Move until conductance equals 1", explain:"The stub can change susceptance b, the imaginary part of admittance. Find places where normalized conductance g, the real part, already equals 1.", observe:"Move the probe clockwise along the circle, or select A or B below to jump to a crossing. The coral grid circle is g = 1.", equation:m => m.solutions.length ? m.solutions.map((s,i) => `${"AB"[i]}: d = ${num(s.d)}λ, y = ${complex(s.y)}`).join("  ·  ") : "The line is already matched everywhere."},
  {time:14, name:"Stub", title:"Cancel the leftover b", explain:"At the g = 1 crossing, Medusa adds a short or open stub in parallel. The stub supplies equal and opposite susceptance, so the point moves straight to the centre.", observe:"The junction does not move when you change the stub termination; only the required stub length changes.", equation:(m,s,term) => s ? `b(stub) = −b(line) = ${num(s.b)} · ℓ = ${num(s[term])}λ` : "No stub is required."},
  {time:17.5, name:"Teardown · Compare", title:"Compare the two designs", explain:"A full rotation along half a wavelength crosses g = 1 twice. Either crossing works if you use its own stub length.", observe:"Select both options in turn to see how the junction location and required stub length change.", equation:(m,s,term) => s ? `Selected junction: ${num(s.d)}λ · selected stub: ${num(s[term])}λ (${num(s[term]*360,2)}°)` : "The reflection coefficient is zero, so there are no distinct crossings."},
  {time:21, name:"Reassembly · Verify", title:"Verify the match", explain:"Add the two admittances at the junction. When the imaginary parts cancel and the real part is 1, the source side sees Z₀ and the ideal VSWR is 1.", observe:"The center marks the matched condition on the generator side of the junction. Between the junction and the load, the original standing wave remains.", equation:(m,s,term) => s ? `y(total) = ${complex(verify(s,term).y)} · |Γ| = ${num(verify(s,term).rho)} · VSWR = ${num(verify(s,term).vswr)}` : "y(total) = 1 + j0 · |Γ| = 0 · VSWR = 1"}
];

const tour = $("tour");
const tourOrigin = location.protocol === "file:" ? "*" : location.origin;
const duration = 25;
let model, step = 0, selected = 0, playhead = 2.6, playing = false, followTour = true;
let animationFrame, lastTick;
function setPlaying(value) {
  playing = value;
  $("tourToggle").textContent = playing ? "Pause explanation" : "Play explanation";
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  lastTick = null;
  if (playing) animationFrame = requestAnimationFrame(advanceLesson);
}

function advanceLesson(now) {
  if (lastTick === null) lastTick = now;
  if (now - lastTick >= 35) {
    const next = Math.min(duration, playhead + Math.min(.1, (now - lastTick) / 1000));
    lastTick = now;
    applyTourTime(next);
    if (next === duration) {
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
  const next = time >= 19.3 ? 7 : time >= 15.8 ? 6 : time >= 12.7 ? 5 : time >= 9.9 ? 4 : time >= 7.5 ? 3 : time >= 5.7 ? 2 : time >= 3.3 ? 1 : 0;
  const changed = step !== next;
  step = next;
  updateTourProbe();
  if (changed) renderLesson();
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
  if (step === 3) distance = model.minimum;
  if (step === 4) distance = target * progress(9.9, 12.45);
  if (step >= 5) distance = target;
  $("probe").value = distance;
}

function seekStep(index) {
  setPlaying(false);
  followTour = true;
  applyTourTime(steps[index].time);
}
steps.forEach((item,index) => {
  const button = document.createElement("button");
  button.textContent = (index+1) + ". " + item.name;
  button.onclick = () => seekStep(index);
  $("steps").append(button);
});
const tourFallback = setTimeout(() => {
  $("tourState").textContent = "The 3D room could not start. Use the flat chart below.";
  $("flatChart").open = true;
},10000);
let roomReady = false;
addEventListener("message", event => {
  if (event.source !== tour.contentWindow || (tourOrigin !== "*" && event.origin !== tourOrigin)) return;
  const time = event.data?.time;
  if (event.data?.type !== "medusa-time" || !Number.isFinite(time)) return;
  clearTimeout(tourFallback);
  $("tourState").hidden = true;
  if (!roomReady) {
    roomReady = true;
    applyTourTime(playhead);
  }
});
$("tourToggle").addEventListener("click", () => {
  followTour = true;
  if (!playing && playhead === duration) applyTourTime(0);
  setPlaying(!playing);
});
$("tourTime").addEventListener("input", event => {
  setPlaying(false);
  followTour = true;
  const time = Number(event.target.value);
  applyTourTime(time);
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
}

function renderChart() {
  const svg = $("smith");
  const lineProbe = $("lineProbe");
  const junction = $("lineJunction");
  if (!model) {
    lineProbe.hidden = junction.hidden = true;
    svg.replaceChildren();
    tour.contentWindow.postMessage({type:"medusa-chart", chart:null}, tourOrigin);
    $("probeReadout").textContent = "Enter valid measurements to plot the load.";
    return;
  }
  const R = 165;
  const view = $("view").value;
  const sign = view === "z" ? 1 : -1;
  const circle = (x,y,r,stroke,width=1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
  const mark = (point,color,label,offset=11) => {
    const x = point.re * R, y = -point.im * R;
    return `<circle cx="${x}" cy="${y}" r="5" fill="${color}"><title>${label}</title></circle><text x="${x+7}" y="${y-offset}" fill="${color}">${label}</text>`;
  };
  const grid = [0,.2,.5,1,2,5].map(v => circle(sign*R*v/(1+v),0,R/(1+v),"#b9d9d6")).join("") +
    [-5,-2,-1,-.5,-.2,.2,.5,1,2,5].map(v => circle(sign*R,-sign*R/v,R/Math.abs(v),"#b9d9d6")).join("");
  const solution = model.solutions[selected];
  const matching = followTour && step >= 5 && Boolean(solution);
  const d = matching ? solution.d : Number($("probe").value);
  lineProbe.hidden = false;
  lineProbe.style.left = `${100 - d * 200}%`;
  junction.hidden = !solution;
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
      view, rho:model.rho, load:model.load.gamma,
      crossings:model.solutions.map(item => gammaAt(model,item.d)),
      trace, cancellation, effective
    }
  }, tourOrigin);
  svg.innerHTML = `<defs><clipPath id="disk"><circle r="${R}"/></clipPath></defs>
    <g transform="translate(200 200)">
      <g clip-path="url(#disk)">${grid}<line x1="-165" x2="165" y1="0" y2="0" stroke="#99bcba"/></g>
      ${circle(0,0,R,"#537f7b")}
      ${view === "y" ? circle(-R/2,0,R/2,"#dd654e",1.6) : ""}
      ${circle(0,0,model.rho*R,"#087a6d",1.6)}
      <path d="${trace}" stroke="#284f55" stroke-width="3" fill="none" opacity=".65"/>
      ${mark({re:0,im:0},"#31743d","Match",-18)}
      ${model.rho ? mark({re:-model.rho,im:0},"#556a78","Vmin",-18) + mark(model.load.gamma,"#bc3d25","Load") : ""}
      ${model.solutions.map((item,index) => mark(gammaAt(model,item.d),"#087a6d","AB"[index])).join("")}
      <path d="${cancellation}" stroke="#357837" stroke-width="3" fill="none" stroke-dasharray="5 3"/>
      <circle cx="${effective.re*R}" cy="${-effective.im*R}" r="9" fill="none" stroke="#143b44" stroke-width="2"/>
    </g>`;
  $("probeReadout").textContent = matching ? `Junction at ${num(solution.d)}λ · total y = ${complex(y)}` : `d = ${num(d)}λ · z = ${complex(probe.z)} · y = ${complex(probe.y)}`;
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
  followTour = false;
  setPlaying(false);
  renderChart();
});
$("view").addEventListener("change",renderChart);

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
  followTour = false;
  setPlaying(false);
  $("probe").value = model.solutions[selected].d;
  renderResults();
  $("options").querySelector(`[data-option="${selected}"]`).focus();
  renderLesson();
  renderChart();
});

update();
