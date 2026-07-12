import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

class FileReaderPolyfill {
  constructor() {
    this.result = null;
    this.onerror = null;
    this.onload = null;
  }

  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer()).then((buffer) => {
      this.result = buffer;
      if (typeof this.onload === 'function') {
        this.onload({ target: this });
      }
    }).catch((error) => {
      if (typeof this.onerror === 'function') {
        this.onerror(error);
      }
    });
  }

  readAsDataURL(blob) {
    Promise.resolve(blob.arrayBuffer()).then((buffer) => {
      const bytes = Buffer.from(buffer);
      const base64 = bytes.toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
      if (typeof this.onload === 'function') {
        this.onload({ target: this });
      }
    }).catch((error) => {
      if (typeof this.onerror === 'function') {
        this.onerror(error);
      }
    });
  }
}

globalThis.FileReader = FileReaderPolyfill;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, '../src/models');
const outputPath = path.join(outputDir, 'robot.glb');
mkdirSync(outputDir, { recursive: true });

const scene = new THREE.Scene();
scene.name = 'RobotScene';

const shellMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xf8fbff,
  roughness: 0.11,
  metalness: 0.05,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  sheen: 0.35,
  sheenColor: new THREE.Color(0x9ed1ff),
});

const chromeMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xb9c5d0,
  roughness: 0.18,
  metalness: 1,
  clearcoat: 0.9,
  clearcoatRoughness: 0.08,
});

const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x04070b,
  transparent: true,
  opacity: 0.95,
  roughness: 0.04,
  metalness: 0.22,
  transmission: 0.24,
  thickness: 0.4,
  envMapIntensity: 1.35,
});

const eyeMaterial = new THREE.MeshStandardMaterial({
  color: 0x5fdcff,
  emissive: 0x49c5ff,
  emissiveIntensity: 1.35,
  roughness: 0.16,
  metalness: 0.12,
});

const mouthMaterial = new THREE.MeshStandardMaterial({
  color: 0x111827,
  emissive: 0x0b1220,
  emissiveIntensity: 0.2,
});

const robot = new THREE.Group();
robot.name = 'RobotRoot';
scene.add(robot);

const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.95), shellMaterial);
body.name = 'bodyShell';
body.position.y = 0.8;
body.castShadow = true;
body.receiveShadow = true;
robot.add(body);

const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.95, 0.88), shellMaterial);
torso.name = 'torsoShell';
torso.position.y = 1.24;
torso.castShadow = true;
torso.receiveShadow = true;
robot.add(torso);

const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.9), shellMaterial);
head.name = 'headShell';
head.position.y = 2.15;
head.castShadow = true;
head.receiveShadow = true;
robot.add(head);

const facePlate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.45, 0.08), glassMaterial);
facePlate.name = 'facePlate';
facePlate.position.set(0, 2.15, 0.46);
facePlate.castShadow = true;
facePlate.receiveShadow = true;
robot.add(facePlate);

const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), eyeMaterial);
leftEye.name = 'leftEye';
leftEye.position.set(-0.2, 2.15, 0.54);
leftEye.castShadow = true;
robot.add(leftEye);

const rightEye = leftEye.clone();
rightEye.name = 'rightEye';
rightEye.position.set(0.2, 2.15, 0.54);
robot.add(rightEye);

const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), mouthMaterial);
mouth.name = 'mouth';
mouth.position.set(0, 2.03, 0.54);
mouth.castShadow = true;
robot.add(mouth);

const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.7, 0.18), chromeMaterial);
leftArm.name = 'leftArm';
leftArm.position.set(-0.72, 1.35, 0);
leftArm.castShadow = true;
robot.add(leftArm);

const rightArm = leftArm.clone();
rightArm.name = 'rightArm';
rightArm.position.set(0.72, 1.35, 0);
robot.add(rightArm);

const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), chromeMaterial);
leftLeg.name = 'leftLeg';
leftLeg.position.set(-0.25, 0.35, 0);
leftLeg.castShadow = true;
robot.add(leftLeg);

const rightLeg = leftLeg.clone();
rightLeg.name = 'rightLeg';
rightLeg.position.set(0.25, 0.35, 0);
robot.add(rightLeg);

const leftAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 8), chromeMaterial);
leftAntenna.name = 'leftAntenna';
leftAntenna.position.set(-0.22, 2.72, 0.08);
leftAntenna.rotation.z = -0.4;
robot.add(leftAntenna);

const rightAntenna = leftAntenna.clone();
rightAntenna.name = 'rightAntenna';
rightAntenna.position.set(0.22, 2.72, 0.08);
rightAntenna.rotation.z = 0.4;
robot.add(rightAntenna);

const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), chromeMaterial);
antennaBall.name = 'antennaBall';
antennaBall.position.set(0, 2.82, 0.06);
robot.add(antennaBall);

const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.03, 16, 80), new THREE.MeshBasicMaterial({
  color: 0x6fe7ff,
  transparent: true,
  opacity: 0.12,
  blending: THREE.AdditiveBlending,
}));
halo.name = 'halo';
halo.rotation.x = Math.PI / 2;
halo.position.y = 1.3;
robot.add(halo);

robot.position.y = -0.05;

const exporter = new GLTFExporter();

await new Promise((resolve, reject) => {
  exporter.parse(
    scene,
    (result) => {
      try {
        if (result instanceof ArrayBuffer) {
          writeFileSync(outputPath, Buffer.from(result));
        } else {
          const output = JSON.stringify(result, null, 2);
          writeFileSync(outputPath.replace(/\.glb$/, '.json'), output);
        }
        console.log(`Created ${outputPath}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    },
    (error) => {
      reject(error);
    },
    {
      binary: true,
      trs: false,
      onlyVisible: true,
      truncateDrawRange: true,
    },
  );
});
