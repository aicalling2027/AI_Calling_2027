import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runtimeSpecifier = process.env.QODER_GLTF_RUNTIME
  ? pathToFileURL(path.resolve(process.env.QODER_GLTF_RUNTIME)).href
  : '@phodal/modeling-glb';
const { createModelBundle, modelCreate, modelParam } = await import(runtimeSpecifier);

/**
 * The AOTMS hero device: the handset the marketing hero shows on a live call.
 *
 * The photograph in `frontend/public/AI_Calling.png` can only be used at the
 * angle it was shot. This is the same object as geometry: every dimension is a
 * parameter, so a future viewer, render or PR shot can be regenerated at any
 * size or angle from `node solution.mjs` instead of tracing a new photo.
 *
 * Frame: meters, X lateral, Y up, Z forward. The screen faces +Z and the phone
 * stands upright at the origin, so a viewer can spin it around Y.
 */
const source = defineModel();

function defineModel() {
  return modelCreate('author the AOTMS hero handset as parametric geometry')
    .parameter('device.width', { dimension: 'length', default: 0.072, min: 0.06, max: 0.09 })
    .parameter('device.height', { dimension: 'length', default: 0.149, min: 0.12, max: 0.18 })
    .parameter('device.depth', { dimension: 'length', default: 0.008, min: 0.006, max: 0.012 })
    .parameter('device.bevel', { dimension: 'length', default: 0.0035, min: 0.001, max: 0.0039 })

    // Finishes. The frame is graphite with a cool cast; the glass stays dark and
    // carries the brand cobalt as emission, which is how the shot's call screen
    // reads at a glance.
    .appearance('device.frame', { baseColor: '#3A4049', metallic: 0.9, roughness: 0.32 })
    .appearance('device.glass', { baseColor: '#0A1020', emissive: '#2F9BFF', metallic: 0.1, roughness: 0.12 })
    .appearance('device.lens', { baseColor: '#0B1016', metallic: 0.6, roughness: 0.08 })
    .appearance('device.trim', { baseColor: '#20262E', metallic: 0.75, roughness: 0.4 })
    .appearance('device.mark', { baseColor: '#F5F1E8', emissive: '#FF8A3D', metallic: 0, roughness: 0.5 })

    .feature('device.body.feature', {
      type: 'primitive.beveled-box',
      size: [modelParam('device.width'), modelParam('device.height'), modelParam('device.depth')],
      bevelRadius: modelParam('device.bevel'),
      bevelSegments: 4,
    })
    // The glass is inset inside the frame's flat front face: the body's bevel
    // starts 0.0035 in from its edge, so a wider plate would hang off the
    // curve and show its own side wall down the length of the phone.
    .feature('device.screen.feature', {
      type: 'primitive.box',
      size: [0.064, 0.14, 0.0012],
    })
    .feature('device.lens.feature', {
      type: 'primitive.cylinder',
      radius: 0.0052,
      height: 0.0018,
      radialSegments: 24,
      axis: 'z',
    })
    .feature('device.lens-glass.feature', {
      type: 'primitive.cylinder',
      radius: 0.0032,
      height: 0.001,
      radialSegments: 24,
      axis: 'z',
    })
    .feature('device.button.feature', {
      type: 'primitive.box',
      size: [0.0014, 0.012, 0.0035],
    })
    .feature('device.island.feature', {
      type: 'primitive.beveled-box',
      size: [0.03, 0.03, 0.0015],
      bevelRadius: 0.0006,
      bevelSegments: 2,
    })
    .feature('device.slot.feature', {
      type: 'primitive.box',
      size: [0.014, 0.0011, 0.0004],
    })

    .component('device.body.component', { feature: 'device.body.feature', appearance: 'device.frame' })
    .component('device.screen.component', { feature: 'device.screen.feature', appearance: 'device.glass' })
    .component('device.lens.component', { feature: 'device.lens.feature', appearance: 'device.lens' })
    .component('device.lens-glass.component', { feature: 'device.lens-glass.feature', appearance: 'device.glass' })
    .component('device.button.component', { feature: 'device.button.feature', appearance: 'device.trim' })
    .component('device.island.component', { feature: 'device.island.feature', appearance: 'device.trim' })
    .component('device.slot.component', { feature: 'device.slot.feature', appearance: 'device.mark' })

    .occurrence('device.root', { name: 'AOTMSDevice' })
    .occurrence('device.body', { parent: 'device.root', component: 'device.body.component' })
    // Proud of the frame by a tenth of a millimetre, not by a millimetre: the
    // plate has to sit in front of the body to be visible at all, but any more
    // than a hair and the oblique view reads its edge as a seam.
    .occurrence('device.screen', {
      parent: 'device.root',
      component: 'device.screen.component',
      translation: [0, 0, 0.0035],
    })
    .occurrence('device.camera-island', {
      parent: 'device.root',
      component: 'device.island.component',
      translation: [-0.0155, 0.0525, -0.0046],
    })

    // The three lenses read as a triangle inside the island, so they are placed
    // rather than repeated: a linear or radial pattern would not land on it.
    .occurrence('device.lens.000', {
      parent: 'device.root',
      component: 'device.lens.component',
      translation: [-0.0215, 0.0585, -0.0056],
    })
    .occurrence('device.lens.001', {
      parent: 'device.root',
      component: 'device.lens.component',
      translation: [-0.0215, 0.0455, -0.0056],
    })
    .occurrence('device.lens.002', {
      parent: 'device.root',
      component: 'device.lens.component',
      translation: [-0.0095, 0.052, -0.0056],
    })
    .occurrence('device.lens-glass.000', {
      parent: 'device.root',
      component: 'device.lens-glass.component',
      translation: [-0.0215, 0.0585, -0.0064],
    })
    .occurrence('device.lens-glass.001', {
      parent: 'device.root',
      component: 'device.lens-glass.component',
      translation: [-0.0215, 0.0455, -0.0064],
    })
    .occurrence('device.lens-glass.002', {
      parent: 'device.root',
      component: 'device.lens-glass.component',
      translation: [-0.0095, 0.052, -0.0064],
    })

    // Power on the right rail, volume up/down on the left, each proud of the
    // frame by a fraction of a millimetre so they catch a highlight.
    .occurrence('device.button.power', {
      parent: 'device.root',
      component: 'device.button.component',
      translation: [0.0362, 0.02, 0],
    })
    .occurrence('device.button.volume-up', {
      parent: 'device.root',
      component: 'device.button.component',
      translation: [-0.0362, 0.033, 0],
    })
    .occurrence('device.button.volume-down', {
      parent: 'device.root',
      component: 'device.button.component',
      translation: [-0.0362, 0.017, 0],
    })

    // Earpiece slot above the glass and the brand bar below it. Both are the
    // tangerine mark: the only warm accent on an otherwise cool object. They sit
    // on the frame's front face rather than in front of it, so nothing floats.
    .occurrence('device.earpiece', {
      parent: 'device.root',
      component: 'device.slot.component',
      translation: [0, 0.0702, 0.0042],
    })
    .occurrence('device.brand-bar', {
      parent: 'device.root',
      component: 'device.slot.component',
      translation: [0, -0.0702, 0.0042],
    })

    .expectBounds({
      min: [-0.0368, -0.0745, -0.0065],
      max: [0.0368, 0.0745, 0.0044],
      tolerance: 0.0006,
    })
    .budget({
      maxOperations: 48,
      maxGeneratedInstances: 24,
      maxNodes: 32,
      maxVertices: 8000,
      maxTriangles: 8000,
      maxBytes: 2 * 1024 * 1024,
    });
}

const bundle = await createModelBundle(source.program());
await Promise.all([
  writeAtomic('program.gltf.json', JSON.stringify(bundle.program, null, 2) + '\n'),
  writeAtomic('artifact.glb', bundle.artifact),
  writeAtomic('artifact.gltf-project.json', bundle.projectSidecar),
  writeAtomic('capability-report.json', JSON.stringify(bundle.capabilityReport, null, 2) + '\n'),
]);

process.stdout.write(JSON.stringify({
  status: 'committed',
  revision: bundle.inspection.revision,
  bounds: bundle.inspection.bounds,
  counts: bundle.validation.counts,
}) + '\n');

async function writeAtomic(filePath, data) {
  const absolute = path.resolve(filePath);
  const temporary = path.join(path.dirname(absolute), '.' + path.basename(absolute) + '.' + process.pid + '.tmp');
  await writeFile(temporary, data);
  await rename(temporary, absolute);
}
