import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const source = new URL("./", import.meta.url);
const output = new URL("./dist/", source);
const pages = ["index.html", "medusa.html", "lab.js", "resources.js", "smithMatchLabData.js", "tutor.js"];
const threeAssets = [
  "LICENSE",
  "build/three.module.js",
  "examples/jsm/environments/RoomEnvironment.js",
  "examples/jsm/utils/BufferGeometryUtils.js"
];

await mkdir(output, { recursive: true });
await Promise.all([
  ...pages.map(path => copyFile(new URL(path, source), new URL(path, output))),
  ...threeAssets.map(async path => {
    const asset = new URL("three/" + path, output);
    await mkdir(new URL("./", asset), { recursive: true });
    await copyFile(new URL("node_modules/three/" + path, source), asset);
  })
]);

// Hosted builds can use locally installed fonts. The Fontshare binaries stay on the user's PC.
const style = await readFile(new URL("tutor.css", source), "utf8");
const hostedStyle = style.replace(/, url\("(?:Sharpie|Array)-[\w-]+\.woff2"\) format\("woff2"\)/g, "");
await writeFile(new URL("tutor.css", output), hostedStyle);
console.log("Built Medusa Lab into dist/");
