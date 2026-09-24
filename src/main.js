/**
 * Enchanted Swamp — foundation scene.
 *
 * A minimal first-person world: a flat ground, four boundary walls, a twilight
 * gradient sky, simple lighting, and keyboard-only "tank" controls.
 *
 * THE CAMERA IS THE PLAYER. The camera's position is the player's position and
 * its Y rotation is the player's facing direction. There is no separate player
 * object, so nothing ever needs to be kept in sync.
 *
 * Controls (keyboard only — the mouse does nothing):
 *   W  move forward, in the exact direction the camera faces
 *   S  move backward, directly away from where the camera faces
 *   A  turn left   (rotation only — never moves sideways)
 *   D  turn right  (rotation only — never moves sideways)
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Configuration — every tweakable value lives here.
// Units: 1 Three.js unit ≈ 1 meter.
// ---------------------------------------------------------------------------
const CONFIG = {
  worldSize: 120, // ground is worldSize × worldSize
  wallHeight: 5,
  wallThickness: 1,
  wallMargin: 0.5, // closest the camera may get to a wall's inner face

  playerHeight: 1.65, // camera eye height; never changes
  moveSpeed: 4, // units per second (W / S)
  turnSpeedDeg: 90, // degrees per second (A / D)

  fov: 70,

  colors: {
    skyTop: '#0B1026', // deep navy / indigo
    skyMiddle: '#302755', // muted violet / blue-purple
    skyLower: '#5A5272', // smoky lavender
    skyHorizon: '#343A4D', // blue-gray
    ground: '#44533D', // dark murky moss
    wall: '#58546C', // muted slate
  },
};

// ---------------------------------------------------------------------------
// 1. Renderer
// ---------------------------------------------------------------------------
function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

// ---------------------------------------------------------------------------
// 3. Camera (the player)
// ---------------------------------------------------------------------------
function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    CONFIG.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  // Start in the middle of the world at eye height, facing "north" (−Z).
  // X and Z rotation stay 0 forever so the view is always level.
  camera.position.set(0, CONFIG.playerHeight, 0);
  camera.rotation.set(0, 0, 0);
  return camera;
}

// ---------------------------------------------------------------------------
// 4. Gradient sky
// A large sphere seen from the inside (BackSide), colored by a tiny shader
// based on how far above the horizon each pixel is.
// ---------------------------------------------------------------------------
function createSky() {
  const { skyTop, skyMiddle, skyLower, skyHorizon } = CONFIG.colors;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(skyTop) },
      middleColor: { value: new THREE.Color(skyMiddle) },
      lowerColor: { value: new THREE.Color(skyLower) },
      horizonColor: { value: new THREE.Color(skyHorizon) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vViewDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        // Measure from the viewer, so the horizon stays level wherever they walk.
        vViewDirection = worldPosition.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 middleColor;
      uniform vec3 lowerColor;
      uniform vec3 horizonColor;
      varying vec3 vViewDirection;

      void main() {
        // 0 at the horizon, 1 straight up (negative below the horizon).
        // The view never tilts up, so the top of the screen is only ~0.57;
        // the stops are packed low enough that the navy is still visible.
        float h = normalize(vViewDirection).y;

        vec3 color = horizonColor;
        color = mix(color, lowerColor, smoothstep(0.0, 0.08, h));
        color = mix(color, middleColor, smoothstep(0.08, 0.3, h));
        color = mix(color, topColor, smoothstep(0.3, 0.65, h));

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>

        // Tiny dither so the dark gradient doesn't show 8-bit banding.
        float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor.rgb += (noise - 0.5) / 255.0;
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });

  // Radius must stay inside the camera's far plane (1000).
  return new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), material);
}

// ---------------------------------------------------------------------------
// 5. Lighting
// Dim and cool: enough to read the ground and walls, still clearly twilight.
// ---------------------------------------------------------------------------
function createLights() {
  // Violet light from the sky above, dark murky bounce from the ground below.
  const hemisphere = new THREE.HemisphereLight('#8C84BE', '#1A1D22', 1.6);

  // A soft "moonlight" key light so the walls get some shape.
  const moon = new THREE.DirectionalLight('#C4C0F0', 1.0);
  moon.position.set(-40, 60, 25);

  return [hemisphere, moon];
}

// ---------------------------------------------------------------------------
// 6. Ground
// ---------------------------------------------------------------------------
function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.worldSize, CONFIG.worldSize),
    new THREE.MeshStandardMaterial({ color: CONFIG.colors.ground, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2; // lay the plane flat on the X/Z plane
  return ground;
}

// ---------------------------------------------------------------------------
// 7. Boundary walls
// Each wall's inner face sits exactly on the ground's edge.
// ---------------------------------------------------------------------------
function createWalls() {
  const { worldSize, wallHeight, wallThickness } = CONFIG;
  const offset = worldSize / 2 + wallThickness / 2;
  const longSide = worldSize + wallThickness * 2; // north/south walls cover the corners

  const material = new THREE.MeshStandardMaterial({ color: CONFIG.colors.wall, roughness: 0.9 });

  const walls = new THREE.Group();
  const layout = [
    { x: 0, z: -offset, width: longSide, depth: wallThickness }, // north
    { x: 0, z: offset, width: longSide, depth: wallThickness }, // south
    { x: -offset, z: 0, width: wallThickness, depth: worldSize }, // west
    { x: offset, z: 0, width: wallThickness, depth: worldSize }, // east
  ];

  for (const { x, z, width, depth } of layout) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), material);
    wall.position.set(x, wallHeight / 2, z);
    walls.add(wall);
  }
  return walls;
}

// ---------------------------------------------------------------------------
// 1–7. Build the world
// ---------------------------------------------------------------------------
const renderer = createRenderer();
const scene = new THREE.Scene(); // 2. Scene
const camera = createCamera();

scene.add(createSky());
scene.add(...createLights());
scene.add(createGround());
scene.add(createWalls());

// ---------------------------------------------------------------------------
// 8. Keyboard state
// Keys are tracked while held, so movement is continuous rather than one step
// per keydown. Physical key codes are used, so the layout doesn't matter.
// ---------------------------------------------------------------------------
const KEY_BINDINGS = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'turnLeft', // A turns — it does NOT move left
  KeyD: 'turnRight', // D turns — it does NOT move right
};

const input = { forward: false, backward: false, turnLeft: false, turnRight: false };

function setKey(code, pressed) {
  const action = KEY_BINDINGS[code];
  if (action) input[action] = pressed;
}

window.addEventListener('keydown', (event) => setKey(event.code, true));
window.addEventListener('keyup', (event) => setKey(event.code, false));

// If the window loses focus mid-press, the keyup never arrives; release all.
window.addEventListener('blur', () => {
  for (const action in input) input[action] = false;
});

// ---------------------------------------------------------------------------
// 9. Movement and rotation
// ---------------------------------------------------------------------------
const TURN_SPEED = THREE.MathUtils.degToRad(CONFIG.turnSpeedDeg); // radians per second

function updatePlayer(dt) {
  // Turning: A/D change ONLY the camera's rotation around the vertical Y axis.
  const turn = (input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0);
  camera.rotation.y += turn * TURN_SPEED * dt;

  // Moving: W/S walk along the camera's current facing, on the X/Z plane only.
  const move = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  if (move !== 0) {
    // A camera looks down its local −Z axis. Rotating (0, 0, −1) by the
    // camera's Y angle gives its horizontal facing direction:
    const yaw = camera.rotation.y;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);

    const distance = move * CONFIG.moveSpeed * dt;
    camera.position.x += forwardX * distance;
    camera.position.z += forwardZ * distance;
    // camera.position.y is never touched, so eye height stays constant.
  }
}

// ---------------------------------------------------------------------------
// 10. Boundary clamping
// Keep the camera a small margin inside the walls so it never clips into them.
// Each axis is clamped separately, so the player slides along a wall.
// ---------------------------------------------------------------------------
const BOUNDARY = CONFIG.worldSize / 2 - CONFIG.wallMargin;

function clampToWorld() {
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -BOUNDARY, BOUNDARY);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -BOUNDARY, BOUNDARY);
}

// ---------------------------------------------------------------------------
// 11. Animation loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document); // avoids a huge time step after the tab was hidden

function animate() {
  timer.update();
  // Cap the step so a stalled frame can't teleport the player.
  const dt = Math.min(timer.getDelta(), 0.1);

  updatePlayer(dt);
  clampToWorld();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// ---------------------------------------------------------------------------
// 12. Window resize
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
