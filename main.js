// ============================================
// TYCOON MAKER - MAIN.JS
// DEEL 1: INITIALISATIE + EDITORCAMERA
// ============================================

const canvas = document.getElementById("renderCanvas");

const engine = new BABYLON.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
});

// ============================================
// GLOBALE VARIABELEN
// ============================================

let scene = null;
let camera = null;
let player = null;
let jumpVelocity = 0;
let jumpBaseY = 0;
let isGrounded = true;

const jumpPower = 7.5;
const gravity = 18;
let playerSpawnY = 0;
let gizmoManager = null;

let selectedButton = null;
let selectedPlaceableButton = null;

const placeableButtons = [];

const tycoonButtons = [];
const objectLibrary = {};
const keys = {};
const freeObjects = [];

let isPlayMode = false;
let previewMode = false;
let previewMeshes = [];

let currentPriority = 0;
let money = 100;
let moneyDisplay = null;

let currentAnim = null;
let lastBuyPressed = false;

let projectId =
  new URLSearchParams(location.search).get("id") || "local-" + Date.now();

// Undo / Redo
let undoHistory = [];
let redoHistory = [];

// ============================================
// KEYBOARD INPUT
// ============================================

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ============================================
// EDITOR CAMERA INSTELLINGEN
// ============================================

let editorYaw = 0;
let editorPitch = 0.45;

let editorMoveSpeed = 0.25;
let editorZoomSpeed = 1;

let isRightMouseDown = false;

const editorKeys = {
  w: 87,
  a: 65,
  s: 83,
  d: 68,
};

// ============================================
// SCENE AANMAKEN
// ============================================

async function createScene() {
  scene = new BABYLON.Scene(engine);
  scene.collisionsEnabled = false;

  scene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.12, 1);

  // ========================================
  // EDITOR CAMERA
  // ========================================

  camera = new BABYLON.ArcRotateCamera(
    "editorCamera",
    -Math.PI / 2,
    1.1,
    18,
    BABYLON.Vector3.Zero(),
    scene,
  );

  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 80;

  camera.lowerBetaLimit = 0.1;
  camera.upperBetaLimit = Math.PI - 0.1;

  camera.wheelPrecision = 40;

  camera.panningSensibility = 100;

  camera.attachControl(canvas, true);

  // We gebruiken zelf rechtermuisknop voor draaien.
  camera.inputs.attached.pointers.buttons = [0];

  // ========================================
  // LICHT
  // ========================================

  const hemi = new BABYLON.HemisphericLight(
    "hemi",
    new BABYLON.Vector3(0, 1, 0),
    scene,
  );

  hemi.intensity = 0.85;

  // ========================================
  // VLOER
  // ========================================

  const floor = BABYLON.MeshBuilder.CreateGround(
    "floor",
    {
      width: 100,
      height: 100,
    },
    scene,
  );

  const floorMaterial = new BABYLON.StandardMaterial("floorMaterial", scene);

  floorMaterial.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.28);

  floor.material = floorMaterial;
  floor.checkCollisions = true;

  // ========================================
  // RASTER 100 x 100
  // ========================================

  for (let i = -50; i <= 50; i++) {
    const vertical = BABYLON.MeshBuilder.CreateLines(
      "vertical_" + i,
      {
        points: [
          new BABYLON.Vector3(i, 0.01, -50),
          new BABYLON.Vector3(i, 0.01, 50),
        ],
      },
      scene,
    );

    vertical.color = new BABYLON.Color3(0.4, 0.4, 0.45);

    const horizontal = BABYLON.MeshBuilder.CreateLines(
      "horizontal_" + i,
      {
        points: [
          new BABYLON.Vector3(-50, 0.01, i),
          new BABYLON.Vector3(50, 0.01, i),
        ],
      },
      scene,
    );

    horizontal.color = new BABYLON.Color3(0.4, 0.4, 0.45);
  }
  // ========================================
  // GIZMO MANAGER
  // ========================================

  gizmoManager = new BABYLON.GizmoManager(scene);

  gizmoManager.usePointerToAttachGizmos = false;

  setGizmoMode("position");

  // ========================================
  // SPELER IMPORTEREN
  // ========================================

  try {
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      "",
      "models/",
      "character.glb",
      scene,
    );

    player = result.meshes[0];

    player.name = "playerRoot";

    player.scaling.setAll(1);

    player.position.set(0, 0, -6);

    // Zet de onderkant van het model precies op de grond
    player.computeWorldMatrix(true);

    const playerBounds = player.getHierarchyBoundingVectors(true);

    player.position.y -= playerBounds.min.y;

    player.rotationQuaternion = null;

    player.setEnabled(false);

    player.animationGroups = result.animationGroups || [];

    player.animationGroups.forEach((animation) => {
      animation.stop();
    });

    console.log("Speler succesvol geladen.");
  } catch (error) {
    console.warn(
      "character.glb niet gevonden. Fallback capsule wordt gebruikt.",
    );

    player = BABYLON.MeshBuilder.CreateCapsule(
      "player",
      {
        height: 1.8,
        radius: 0.35,
      },
      scene,
    );
    playerSpawnY = 0.9;

    player.material = new BABYLON.StandardMaterial("playerMaterial", scene);

    player.material.diffuseColor = new BABYLON.Color3(0.2, 0.6, 1);

    player.setEnabled(false);

    player.animationGroups = [];
  }

  // ========================================
  // EDITOR CAMERA BEDIENING
  // ========================================

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  canvas.addEventListener("mousedown", (e) => {
    if (isPlayMode) return;

    if (e.button === 2) {
      isRightMouseDown = true;
      canvas.style.cursor = "grabbing";
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) {
      isRightMouseDown = false;
      canvas.style.cursor = "default";
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (isPlayMode || !isRightMouseDown) return;

    editorYaw -= e.movementX * 0.005;

    editorPitch += e.movementY * 0.005;

    editorPitch = Math.max(0.1, Math.min(Math.PI - 0.1, editorPitch));
  });

  // ========================================
  // EDITOR CAMERA BEWEGING
  // ========================================

  scene.onBeforeRenderObservable.add(() => {
    if (isPlayMode || isRightMouseDown) return;

    const forward = camera.getDirection(BABYLON.Axis.Z);

    const right = camera.getDirection(BABYLON.Axis.X);

    forward.y = 0;
    right.y = 0;

    forward.normalize();
    right.normalize();

    const movement = BABYLON.Vector3.Zero();

    if (keys.w) movement.addInPlace(forward);
    if (keys.s) movement.subtractInPlace(forward);

    if (keys.d) movement.addInPlace(right);
    if (keys.a) movement.subtractInPlace(right);

    if (movement.lengthSquared() > 0) {
      movement.normalize();

      camera.target.addInPlace(movement.scale(editorMoveSpeed));
    }
  });

  // ========================================
  // SCENE TERUGGEVEN
  // ========================================

  return scene;
}

// ============================================
// GIZMO MODUS
// ============================================

function setGizmoMode(mode) {
  if (!gizmoManager) return;

  gizmoManager.positionGizmoEnabled = mode === "position";

  gizmoManager.rotationGizmoEnabled = mode === "rotation";

  gizmoManager.scaleGizmoEnabled = mode === "scale";
}
// ============================================
// SCENE STARTEN
// ============================================

createScene().then(async () => {
  console.log("Tycoon Maker scene gestart.");

  // Project laden nadat de scene klaar is
  try {
    await loadProject();
  } catch (error) {
    console.error("Project laden mislukt bij start:", error);
  }

  engine.runRenderLoop(() => {
    if (scene) {
      scene.render();
    }
  });
});

window.addEventListener("resize", () => {
  engine.resize();
});

canvas.tabIndex = 1;

// ============================================
// EINDE DEEL 1
// ============================================

// ============================================
// TYCOON BUTTON AANMAKEN
// ============================================
function createTycoonButton(pos) {
  const btn = BABYLON.MeshBuilder.CreateCylinder(
    "tycoonButton",
    {
      diameter: 1.2,
      height: 0.12,
      tessellation: 64,
    },
    scene,
  );

  btn.position = pos.clone();
  btn.position.y = 0.06;

  btn.material = new BABYLON.StandardMaterial(
    "buttonMaterial_" + Math.random(),
    scene,
  );

  btn.material.diffuseColor = new BABYLON.Color3(0.15, 0.75, 0.25);

  btn.material.emissiveColor = new BABYLON.Color3(0.05, 0.15, 0.05);

  const ring = BABYLON.MeshBuilder.CreateTorus(
    "buttonRing",
    {
      diameter: 1.05,
      thickness: 0.035,
      tessellation: 64,
    },
    scene,
  );

  ring.parent = btn;
  ring.position.y = 0.07;

  const ringMaterial = new BABYLON.StandardMaterial(
    "buttonRingMaterial",
    scene,
  );

  ringMaterial.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);

  ring.material = ringMaterial;

  btn.metadata = {
    isTycoonButton: true,
    price: 50,
    incomePerSecond: 0,
    priority: 0,

    buttonID: "btn_" + Math.random().toString(36).slice(2, 8),

    objects: [],

    bought: false,
    isPriorityActivator: false,
    isIDActivator: false,
    activatorTarget: "",
  };

  tycoonButtons.push(btn);

  return btn;
}

// ============================================
// PLAATSBARE UI BUTTONS
// ============================================

function createPlaceableButton(pos, data = {}) {

    const btn = BABYLON.MeshBuilder.CreateCylinder(
        "placeableButton",
        {
            diameter: 1.2,
            height: 0.16,
            tessellation: 64
        },
        scene
    );

    btn.position = pos.clone();
    btn.position.y = pos.y || 0.08;

    btn.rotation = BABYLON.Vector3.FromArray(
        data.rotation || [0, 0, 0]
    );

    btn.scaling = BABYLON.Vector3.FromArray(
        data.scaling || [1, 1, 1]
    );

    btn.isPickable = true;

    btn.metadata = {
        isPlaceableButton: true,

        buttonID: data.buttonID ||
            "ui_btn_" + Math.random().toString(36).slice(2, 8),

        spawnMode: data.spawnMode || "free",

        linkedButtonID: data.linkedButtonID || "",

        uiMenuId: data.uiMenuId || ""
    };

    const material = new BABYLON.StandardMaterial(
        "placeableButtonMaterial_" + Math.random(),
        scene
    );

    material.diffuseColor = new BABYLON.Color3(
        0.35, 0.25, 0.85
    );

    material.emissiveColor = new BABYLON.Color3(
        0.12, 0.06, 0.3
    );

    btn.material = material;

    const ring = BABYLON.MeshBuilder.CreateTorus(
        "placeableButtonRing",
        {
            diameter: 1.05,
            thickness: 0.04,
            tessellation: 64
        },
        scene
    );

    ring.parent = btn;
    ring.position.y = 0.09;
    ring.isPickable = true;

    ring.metadata = {
        isPlaceableButtonPart: true
    };

    ring.material = new BABYLON.StandardMaterial(
        "placeableRingMaterial",
        scene
    );

    ring.material.diffuseColor =
        new BABYLON.Color3(1, 1, 1);

    placeableButtons.push(btn);

    return btn;
}

// ============================================
// PLAATSBARE BUTTON SELECTEREN
// ============================================

function selectPlaceableButton(btn) {

    if (isPlayMode || !btn) return;

    selectedPlaceableButton = btn;
    selectedButton = null;
    selectedFreeObject = null;

    if (gizmoManager) {
        gizmoManager.attachToMesh(null);
        gizmoManager.attachToNode(btn);
    }

    refreshInspector();
}


function selectButton(btn) {
  if (isPlayMode || !btn) return;

  selectedButton = btn;

  if (!previewMode) {
    gizmoManager.attachToMesh(btn);
  }

  tycoonButtons.forEach((b) => {
    if (!b.material) return;

    b.material.emissiveColor =
      b === btn
        ? new BABYLON.Color3(0.4, 0.4, 0.1)
        : new BABYLON.Color3(0.2, 0.05, 0.05);
  });

  refreshInspector();
}

function clearPreview() {
  previewMeshes.forEach((mesh) => {
    if (mesh && !mesh.isDisposed()) {
      mesh.dispose();
    }
  });

  previewMeshes = [];

  previewMode = false;

  if (selectedButton && !isPlayMode) {
    gizmoManager.attachToMesh(selectedButton);
  }
}

function togglePreview() {
  if (!selectedButton || isPlayMode) return;

  // Preview afsluiten
  if (previewMode) {
    savePreviewTransforms();

    clearPreview();

    saveProject();
    commitHistory();

    return;
  }

  previewMode = true;
  previewMeshes = [];

  gizmoManager.attachToMesh(null);

  selectedButton.computeWorldMatrix(true);

  const buttonWorld = selectedButton.getWorldMatrix().clone();
  const buttonPosition = selectedButton.getAbsolutePosition();

  selectedButton.metadata.objects.forEach((obj, i) => {
    const asset = objectLibrary[obj.id];

    if (!asset || !asset.mesh) {
      console.warn("Model niet gevonden:", obj.id);
      return;
    }

    const clone = asset.mesh.clone("preview_" + i);

    if (!clone) return;

    const p = obj.pos || { x: 0, y: 0, z: 0 };
    const r = obj.rot || { x: 0, y: 0, z: 0 };
    const s = obj.scale || { x: 1, y: 1, z: 1 };

    if (obj.positionSpace === "button-local") {
      clone.position = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(p.x, p.y, p.z),
        buttonWorld,
      );
    } else {
      // Oude opgeslagen posities behouden
      clone.position = buttonPosition.add(new BABYLON.Vector3(p.x, p.y, p.z));
    }

    clone.rotation.set(r.x, r.y, r.z);
    clone.scaling.set(s.x, s.y, s.z);

    clone.setEnabled(true);

    clone.getChildMeshes().forEach((child) => {
      child.setEnabled(true);
      child.isVisible = true;
      child.visibility = 1;
    });

    clone.metadata = {
      isPreview: true,
      objIndex: i,
    };

    previewMeshes.push(clone);
  });

  if (previewMeshes.length > 0) {
    gizmoManager.attachToNode(previewMeshes[0]);
  }
}

// ============================================
// PREVIEW TRANSFORMATIES OPSLAAN
// ============================================

function savePreviewTransforms() {
  if (!previewMode || !selectedButton) return;

  selectedButton.computeWorldMatrix(true);

  const buttonWorld = selectedButton.getWorldMatrix().clone();
  const inverseButtonWorld = buttonWorld.clone();

  inverseButtonWorld.invert();

  previewMeshes.forEach((mesh) => {
    if (!mesh || mesh.isDisposed()) return;

    const index = mesh.metadata.objIndex;
    const obj = selectedButton.metadata.objects[index];

    if (!obj) return;

    mesh.computeWorldMatrix(true);

    // Wereldpositie omzetten naar positie ten opzichte
    // van de tycoon-knop
    const localPosition = BABYLON.Vector3.TransformCoordinates(
      mesh.getAbsolutePosition(),
      inverseButtonWorld,
    );

    obj.pos = {
      x: localPosition.x,
      y: localPosition.y,
      z: localPosition.z,
    };

    obj.positionSpace = "button-local";

    obj.rot = {
      x: mesh.rotation.x,
      y: mesh.rotation.y,
      z: mesh.rotation.z,
    };

    obj.scale = {
      x: mesh.scaling.x,
      y: mesh.scaling.y,
      z: mesh.scaling.z,
    };
  });
}

scene.onBeforeRenderObservable.add(() => {
  if (previewMode && selectedButton) {
    savePreviewTransforms();
  }
});

// ============================================
// INSPECTOR
// ============================================


function renderPlaceableButtonInspector(list) {

    const d = selectedPlaceableButton.metadata;

    list.innerHTML = `
        <h3>Placeable Button</h3>

        <label>Button ID</label>
        <input
            class="placeable-id"
            value="${d.buttonID}"
            style="width:100%;margin-bottom:10px;"
        >

        <hr>

        <label>Spawn Mode</label>

        <select
            class="placeable-spawn-mode"
            style="width:100%;margin-bottom:10px;"
        >
            <option value="free">Free Object</option>
            <option value="linked">Linked to Tycoon Button</option>
        </select>

        <div class="placeable-link-container">
            <label>Linked Tycoon Button</label>

            <select
                class="placeable-link"
                style="width:100%;margin-bottom:10px;"
            >
                <option value="">Selecteer knop</option>
            </select>
        </div>

        <hr>

        <label>UI to show</label>

        <select
            class="placeable-ui"
            style="width:100%;margin-bottom:10px;"
        >
            <option value="">Geen UI toegewezen</option>
        </select>
    `;

    const spawnSelect = list.querySelector(
        ".placeable-spawn-mode"
    );

    const linkContainer = list.querySelector(
        ".placeable-link-container"
    );

    const linkSelect = list.querySelector(
        ".placeable-link"
    );

    const uiSelect = list.querySelector(
        ".placeable-ui"
    );

    const idInput = list.querySelector(
        ".placeable-id"
    );

    spawnSelect.value = d.spawnMode;

    linkContainer.style.display =
        d.spawnMode === "linked" ? "block" : "none";

    // Alle Tycoon Buttons
    tycoonButtons.forEach(tycoonButton => {

        const option = document.createElement("option");

        option.value = tycoonButton.metadata.buttonID;
        option.textContent = tycoonButton.metadata.buttonID;

        linkSelect.appendChild(option);

    });

    linkSelect.value = d.linkedButtonID;

    // Alle bestaande UI-menu's
    let menus = [];

    try {
        menus = JSON.parse(
            localStorage.getItem(
                "tycoon_ui_menus_" + projectId
            ) || "[]"
        );
    } catch (error) {
        console.error("UI-menu's laden mislukt:", error);
    }

    menus.forEach(menu => {

        const option = document.createElement("option");

        option.value = menu.id;
        option.textContent = menu.name || menu.id;

        uiSelect.appendChild(option);

    });

    uiSelect.value = d.uiMenuId;

    function savePlaceableSettings() {
        saveProject();
        commitHistory();
    }

    idInput.addEventListener("change", () => {
        d.buttonID = idInput.value;
        savePlaceableSettings();
    });

    spawnSelect.addEventListener("change", () => {

        d.spawnMode = spawnSelect.value;

        linkContainer.style.display =
            d.spawnMode === "linked" ? "block" : "none";

        savePlaceableSettings();

    });

    linkSelect.addEventListener("change", () => {
        d.linkedButtonID = linkSelect.value;
        savePlaceableSettings();
    });

    uiSelect.addEventListener("change", () => {
        d.uiMenuId = uiSelect.value;
        savePlaceableSettings();
    });

}


function refreshInspector() {
  const list = document.getElementById("object-list");

  list.innerHTML = "";

  if (selectedPlaceableButton && !isPlayMode) {
        renderPlaceableButtonInspector(list);
        return;
  }

  if (!selectedButton || isPlayMode) {
    list.innerHTML = `
            <p style="
                opacity:.6;
                text-align:center;
                padding:12px;
            ">
                ${isPlayMode ? "Play mode" : "Selecteer een knop"}
            </p>
        `;

    return;
  }

  const d = selectedButton.metadata;

  list.innerHTML = `

        <div style="display:flex;gap:8px;margin-bottom:6px;">
            <span style="width:80px">Price</span>

            <input
                class="price-input"
                type="number"
                value="${d.price}"
                style="
                    flex:1;
                    background:#3a3a3a;
                    border:none;
                    color:#eee;
                    padding:8px;
                    border-radius:8px;
                "
            >
        </div>

        <div style="display:flex;gap:8px;margin-bottom:6px;">
            <span style="width:80px">Geld/sec</span>

            <input
                class="income-input"
                type="number"
                min="0"
                step="0.1"
                value="${d.incomePerSecond ?? 0}"
                style="
                    flex:1;
                    background:#3a3a3a;
                    border:none;
                    color:#eee;
                    padding:8px;
                    border-radius:8px;
                "
            >
        </div>

        <div style="display:flex;gap:8px;margin-bottom:6px;">
            <span style="width:80px">Priority</span>

            <input
                class="prio-input"
                type="number"
                value="${d.priority}"
                style="
                    flex:1;
                    background:#3a3a3a;
                    border:none;
                    color:#eee;
                    padding:8px;
                    border-radius:8px;
                "
            >
        </div>

        <div style="display:flex;gap:8px;margin-bottom:10px;">
            <span style="width:80px">ButtonID</span>

            <input
                class="bid-input"
                value="${d.buttonID}"
                style="
                    flex:1;
                    background:#3a3a3a;
                    border:none;
                    color:#eee;
                    padding:8px;
                    border-radius:8px;
                "
            >
        </div>

        <label style="font-size:13px;">
            <input
                type="checkbox"
                class="is-prio-act"
                ${d.isPriorityActivator ? "checked" : ""}
            >
            Priority Activator
        </label>

        <br>

        <label style="font-size:13px;">
            <input
                type="checkbox"
                class="is-id-act"
                ${d.isIDActivator ? "checked" : ""}
            >
            ID Activator
        </label>

        <input
            class="act-target"
            placeholder="Target priority or ButtonID"
            value="${d.activatorTarget || ""}"
            style="
                width:100%;
                margin:6px 0;
                background:#3a3a3a;
                border:none;
                color:#eee;
                padding:8px;
                border-radius:8px;
            "
        >

    `;

  d.objects.forEach((obj, i) => {
    const row = document.createElement("div");

    row.className = "object-row";

    const idInput = document.createElement("input");
    idInput.className = "obj-id";
    idInput.dataset.index = i;
    idInput.value = obj.id || "";
    idInput.placeholder = "ObjectID";

    const chooseButton = document.createElement("button");
    chooseButton.className = "choose-obj";
    chooseButton.dataset.index = i;
    chooseButton.textContent = "Choose object";

    const transition = document.createElement("select");
    transition.className = "transition";
    transition.dataset.index = i;

    ["None", "from cave", "from heaven", "grow"].forEach((t) => {
      const option = document.createElement("option");

      option.value = t;
      option.textContent = t;
      option.selected = t === obj.transition;

      transition.appendChild(option);
    });

    row.appendChild(idInput);
    row.appendChild(chooseButton);
    row.appendChild(transition);

    list.appendChild(row);
  });
}

// ============================================
// OBJECTRIJ TOEVOEGEN
// ============================================

document.getElementById("add-row").onclick = () => {
  if (!selectedButton || isPlayMode) return;

  selectedButton.metadata.objects.push({
    id: "",
    transition: "None",
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  });

  refreshInspector();

  saveProject();
  commitHistory();
};

// ============================================
// OBJECTRIJ VERWIJDEREN
// ============================================

document.getElementById("remove-row").onclick = () => {
  if (!selectedButton || isPlayMode) return;

  if (!selectedButton.metadata.objects.length) return;

  selectedButton.metadata.objects.pop();

  refreshInspector();

  saveProject();
  commitHistory();
};

// ============================================
// INSPECTOR INPUTS
// ============================================

document.addEventListener("input", (e) => {
  if (!selectedButton || isPlayMode) return;

  const d = selectedButton.metadata;

  if (e.target.classList.contains("price-input")) {
    d.price = Number(e.target.value) || 0;
  }

  if (e.target.classList.contains("income-input")) {
    d.incomePerSecond = Math.max(0, Number(e.target.value) || 0);
  }

  if (e.target.classList.contains("prio-input")) {
    d.priority = Number(e.target.value) || 0;
  }

  if (e.target.classList.contains("bid-input")) {
    d.buttonID = e.target.value;
  }

  if (e.target.classList.contains("act-target")) {
    d.activatorTarget = e.target.value;
  }

  if (e.target.classList.contains("obj-id")) {
    const index = Number(e.target.dataset.index);

    if (d.objects[index]) {
      d.objects[index].id = e.target.value;
    }
  }
});

document.addEventListener("change", (e) => {
  if (!selectedButton || isPlayMode) return;

  const d = selectedButton.metadata;

  if (e.target.classList.contains("is-prio-act")) {
    d.isPriorityActivator = e.target.checked;
  }

  if (e.target.classList.contains("is-id-act")) {
    d.isIDActivator = e.target.checked;
  }

  if (e.target.classList.contains("transition")) {
    const index = Number(e.target.dataset.index);

    if (d.objects[index]) {
      d.objects[index].transition = e.target.value;
    }
  }

  if (
    e.target.classList.contains("price-input") ||
    e.target.classList.contains("income-input") ||
    e.target.classList.contains("prio-input") ||
    e.target.classList.contains("bid-input") ||
    e.target.classList.contains("act-target") ||
    e.target.classList.contains("obj-id") ||
    e.target.classList.contains("transition") ||
    e.target.classList.contains("is-prio-act") ||
    e.target.classList.contains("is-id-act")
  ) {
    saveProject();
    commitHistory();
  }
});

document.addEventListener("change", (e) => {
  if (!selectedButton || isPlayMode) return;

  const d = selectedButton.metadata;

  if (e.target.classList.contains("is-prio-act")) {
    d.isPriorityActivator = e.target.checked;
  }

  if (e.target.classList.contains("is-id-act")) {
    d.isIDActivator = e.target.checked;
  }

  if (e.target.classList.contains("transition")) {
    const index = Number(e.target.dataset.index);

    if (d.objects[index]) {
      d.objects[index].transition = e.target.value;
    }
  }

  if (
    e.target.classList.contains("price-input") ||
    e.target.classList.contains("prio-input") ||
    e.target.classList.contains("bid-input") ||
    e.target.classList.contains("act-target") ||
    e.target.classList.contains("obj-id") ||
    e.target.classList.contains("transition") ||
    e.target.classList.contains("is-prio-act") ||
    e.target.classList.contains("is-id-act")
  ) {
    saveProject();
    commitHistory();
  }
});

// ============================================
// EINDE DEEL 2
// ============================================

// ============================================
// TYCOON MAKER - DEEL 3
// PLAY MODE + PLAYER + TYCOON SYSTEM
// ============================================

// ============================================
// PLAY CAMERA INSTELLINGEN
// ============================================

let yaw = 0;
let pitch = 0.18;

const cameraDistance = 6;
const cameraHeight = 1.8;
const mouseSensitivity = 0.00025;

// ============================================
// UI editor
// ============================================

function openUIEditor(menuId = null) {
  saveProject();

  const url = new URL("ui-editor/ui.html", window.location.href);

  url.searchParams.set("id", projectId);

  if (menuId) {
    url.searchParams.set("menuId", menuId);
  }

  window.location.href = url.href;
}

// ============================================
// UI MANAGER
// ============================================

const uiManagerStorageKey = "tycoon_ui_menus_" + projectId;

// Knop in de main builder
const uiManagerButton = document.createElement("button");

uiManagerButton.textContent = "🎨 UI's beheren";

uiManagerButton.style.position = "fixed";
uiManagerButton.style.left = "20px";
uiManagerButton.style.bottom = "80px";
uiManagerButton.style.zIndex = "1000";
uiManagerButton.style.padding = "12px 18px";
uiManagerButton.style.background = "#6554c0";
uiManagerButton.style.color = "white";
uiManagerButton.style.border = "none";
uiManagerButton.style.borderRadius = "8px";
uiManagerButton.style.cursor = "pointer";
uiManagerButton.style.fontSize = "14px";

document.body.appendChild(uiManagerButton);

// Achtergrond van het venster
const uiManagerOverlay = document.createElement("div");

uiManagerOverlay.style.position = "fixed";
uiManagerOverlay.style.inset = "0";
uiManagerOverlay.style.background = "rgba(0,0,0,0.75)";
uiManagerOverlay.style.zIndex = "2000";
uiManagerOverlay.style.display = "none";
uiManagerOverlay.style.justifyContent = "center";
uiManagerOverlay.style.alignItems = "center";

document.body.appendChild(uiManagerOverlay);

// Het venster zelf
const uiManagerWindow = document.createElement("div");

uiManagerWindow.style.width = "500px";
uiManagerWindow.style.maxWidth = "90%";
uiManagerWindow.style.maxHeight = "80vh";
uiManagerWindow.style.overflowY = "auto";
uiManagerWindow.style.background = "#252525";
uiManagerWindow.style.color = "white";
uiManagerWindow.style.padding = "24px";
uiManagerWindow.style.borderRadius = "12px";
uiManagerWindow.style.boxShadow = "0 10px 40px rgba(0,0,0,0.5)";

uiManagerOverlay.appendChild(uiManagerWindow);

// UI Manager openen
uiManagerButton.addEventListener("click", () => {
  renderUIManager();
  uiManagerOverlay.style.display = "flex";
});

// UI Manager sluiten
function closeUIManager() {
  uiManagerOverlay.style.display = "none";
}

// UI's ophalen
function getSavedUIMenus() {
  try {
    return JSON.parse(localStorage.getItem(uiManagerStorageKey)) || [];
  } catch (error) {
    console.error("UI-menu's konden niet worden geladen:", error);
    return [];
  }
}

// UI Manager tekenen
function renderUIManager() {
  const menus = getSavedUIMenus();

  uiManagerWindow.innerHTML = "";

  const header = document.createElement("div");

  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "20px";

  const title = document.createElement("h2");
  title.textContent = "Mijn UI-menu's";
  title.style.margin = "0";

  const closeButton = document.createElement("button");
  closeButton.textContent = "✕";
  closeButton.style.padding = "8px 12px";
  closeButton.style.cursor = "pointer";

  closeButton.addEventListener("click", closeUIManager);

  header.appendChild(title);
  header.appendChild(closeButton);

  uiManagerWindow.appendChild(header);

  // Nieuwe UI
  const newButton = document.createElement("button");

  newButton.textContent = "+ Nieuwe UI";
  newButton.style.width = "100%";
  newButton.style.padding = "13px";
  newButton.style.marginBottom = "20px";
  newButton.style.background = "#267a45";
  newButton.style.color = "white";
  newButton.style.border = "none";
  newButton.style.borderRadius = "7px";
  newButton.style.cursor = "pointer";
  newButton.style.fontSize = "15px";

  newButton.addEventListener("click", () => {
    openUIEditor();
  });

  uiManagerWindow.appendChild(newButton);

  if (menus.length === 0) {
    const empty = document.createElement("p");

    empty.textContent = "Je hebt nog geen UI-menu's gemaakt.";
    empty.style.color = "#aaa";
    empty.style.textAlign = "center";
    empty.style.padding = "20px";

    uiManagerWindow.appendChild(empty);
    return;
  }

  // Alle opgeslagen menu's
  menus.forEach((menu) => {
    const item = document.createElement("div");

    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.gap = "10px";
    item.style.padding = "12px";
    item.style.marginBottom = "10px";
    item.style.background = "#353535";
    item.style.borderRadius = "8px";

    const info = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = menu.name || "Naamloze UI";

    const id = document.createElement("small");
    id.textContent = "ID: " + menu.id;
    id.style.display = "block";
    id.style.color = "#aaa";
    id.style.marginTop = "5px";

    info.appendChild(name);
    info.appendChild(id);

    const actions = document.createElement("div");

    actions.style.display = "flex";
    actions.style.gap = "6px";

    // Bewerken
    const editButton = document.createElement("button");

    editButton.textContent = "Bewerken";
    editButton.style.padding = "8px 10px";
    editButton.style.background = "#6554c0";
    editButton.style.color = "white";
    editButton.style.border = "none";
    editButton.style.borderRadius = "5px";
    editButton.style.cursor = "pointer";

    editButton.addEventListener("click", () => {
      openUIEditor(menu.id);
    });

    // Verwijderen
    const deleteButton = document.createElement("button");

    deleteButton.textContent = "🗑";
    deleteButton.title = "UI verwijderen";
    deleteButton.style.padding = "8px 10px";
    deleteButton.style.background = "#a83232";
    deleteButton.style.color = "white";
    deleteButton.style.border = "none";
    deleteButton.style.borderRadius = "5px";
    deleteButton.style.cursor = "pointer";

    deleteButton.addEventListener("click", () => {
      if (
        !confirm(
          `Weet je zeker dat je "${menu.name || "Naamloze UI"}" wilt verwijderen?`,
        )
      ) {
        return;
      }

      const updatedMenus = getSavedUIMenus().filter(
        (savedMenu) => savedMenu.id !== menu.id,
      );

      localStorage.setItem(uiManagerStorageKey, JSON.stringify(updatedMenus));

      renderUIManager();
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    item.appendChild(info);
    item.appendChild(actions);

    uiManagerWindow.appendChild(item);
  });
}

// ============================================
// GELD PER SECONDE
// ============================================

let incomeDisplayTimer = 0;

scene.onBeforeRenderObservable.add(() => {
  if (!isPlayMode) {
    incomeDisplayTimer = 0;
    return;
  }

  const delta = engine.getDeltaTime() / 1000;

  const totalIncome = tycoonButtons.reduce((total, btn) => {
    if (!btn.metadata.bought) return total;

    return total + Math.max(0, Number(btn.metadata.incomePerSecond) || 0);
  }, 0);

  if (totalIncome <= 0) return;

  money += totalIncome * delta;

  incomeDisplayTimer += delta;

  if (incomeDisplayTimer >= 1) {
    incomeDisplayTimer = 0;

    updateMoneyDisplay();
    updateButtonColors();
  }
});

// ============================================
// BUTTON KLEUREN
// ============================================

function updateButtonColors() {
  tycoonButtons.forEach((btn) => {
    if (btn.metadata.bought) {
      btn.setEnabled(false);
      return;
    }

    const canAfford = money >= btn.metadata.price;

    btn.material.diffuseColor = canAfford
      ? new BABYLON.Color3(0.15, 0.75, 0.2)
      : new BABYLON.Color3(0.85, 0.15, 0.15);
  });
}

// ============================================
// PRIORITY SYSTEEM
// ============================================

function showCurrentPriority() {
  tycoonButtons.forEach((btn) => {
    const show =
      !btn.metadata.bought &&
      (btn.metadata.priority === currentPriority || btn.metadata.forceShow);

    btn.setEnabled(show);

    btn.metadata.forceShow = false;
  });

  updateButtonColors();
}

// ============================================
// OBJECT TRANSITIES
// ============================================

function spawnWithTransition(mesh, transition) {
  mesh.setEnabled(true);

  if (transition === "from cave") {
    const targetY = mesh.position.y;

    mesh.position.y -= 3;

    BABYLON.Animation.CreateAndStartAnimation(
      "cave",
      mesh,
      "position.y",
      30,
      40,
      mesh.position.y,
      targetY,
      0,
    );
  } else if (transition === "from heaven") {
    const targetY = mesh.position.y;

    mesh.position.y += 4;

    BABYLON.Animation.CreateAndStartAnimation(
      "heaven",
      mesh,
      "position.y",
      30,
      40,
      mesh.position.y,
      targetY,
      0,
    );
  } else if (transition === "grow") {
    const targetScale = mesh.scaling.clone();

    mesh.scaling.setAll(0.01);

    BABYLON.Animation.CreateAndStartAnimation(
      "grow",
      mesh,
      "scaling",
      30,
      30,
      mesh.scaling.clone(),
      targetScale,
      0,
    );
  }
}

// ============================================
// TYCOON BUTTON KOPEN
// ============================================

function tryBuy(button) {
  if (!isPlayMode) return;
  if (button.metadata.bought) return;

  if (money < button.metadata.price) return;

  money -= button.metadata.price;
  button.metadata.bought = true;
  button.setEnabled(false);

  // Priority activator
  if (button.metadata.isPriorityActivator) {
    const target = parseInt(button.metadata.activatorTarget);

    if (!isNaN(target)) {
      const oldPriority = currentPriority;

      currentPriority = target;
      showCurrentPriority();
      currentPriority = oldPriority;
    }
  }

  // ID activator
  if (button.metadata.isIDActivator && button.metadata.activatorTarget) {
    const targetButton = tycoonButtons.find(
      (btn) => btn.metadata.buttonID === button.metadata.activatorTarget,
    );

    if (targetButton) {
      targetButton.metadata.forceShow = true;
      targetButton.setEnabled(true);

      updateButtonColors();
    }
  }

  // Objecten spawnen
  (button.metadata.objects || []).forEach((obj, index) => {
    const asset = objectLibrary[obj.id];

    if (!asset?.mesh) return;

    const clone = asset.mesh.clone("spawn_" + Date.now() + "_" + index);

    if (!clone) return;

    button.computeWorldMatrix(true);

    const p = obj.pos || { x: 0, y: 0, z: 0 };

    if (obj.positionSpace === "button-local") {
      clone.position = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(p.x, p.y, p.z),
        button.getWorldMatrix(),
      );
    } else {
      clone.position = button
        .getAbsolutePosition()
        .add(new BABYLON.Vector3(p.x, p.y, p.z));
    }

    clone.rotation = new BABYLON.Vector3(
      obj.rot?.x || 0,
      obj.rot?.y || 0,
      obj.rot?.z || 0,
    );

    clone.scaling = new BABYLON.Vector3(
      obj.scale?.x || 1,
      obj.scale?.y || 1,
      obj.scale?.z || 1,
    );

    clone.setEnabled(true);

    spawnWithTransition(clone, obj.transition || "None");
  });

  // Volgende priority
  if (
    !tycoonButtons.some(
      (btn) =>
        !btn.metadata.bought &&
        (btn.metadata.priority === currentPriority || btn.metadata.forceShow),
    )
  ) {
    currentPriority++;

    showCurrentPriority();
  }

  updateMoneyDisplay();
  saveProject();
}

// ============================================
// MUIS RONDKIJKEN
// ============================================

canvas.addEventListener("mousemove", (e) => {
  if (!isPlayMode) return;

  if (document.pointerLockElement !== canvas) return;

  yaw += e.movementX * mouseSensitivity;

  pitch -= e.movementY * mouseSensitivity;

  pitch = Math.max(-0.45, Math.min(0.85, pitch));
});

// Muis opnieuw vastzetten
canvas.addEventListener("click", () => {
  if (isPlayMode && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

// ============================================
// PLAYER MOVEMENT + CAMERA
// ============================================

scene.onBeforeRenderObservable.add(() => {
  if (!isPlayMode || !player) return;

  // Springen met spatie
  const delta = engine.getDeltaTime() / 1000;

  if (keys[" "] && isGrounded) {
    jumpVelocity = jumpPower;
    isGrounded = false;
  }

  // Zwaartekracht toepassen
  if (!isGrounded) {
    player.position.y += jumpVelocity * delta;
    jumpVelocity -= gravity * delta;

    // Terug op de grond
    if (player.position.y <= jumpBaseY) {
      player.position.y = jumpBaseY;
      jumpVelocity = 0;
      isGrounded = true;
    }
  }

  const speed = keys.shift ? 0.15 : 0.075;

  const forward = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

  const right = new BABYLON.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  const movement = BABYLON.Vector3.Zero();

  if (keys.w) movement.addInPlace(forward);

  if (keys.s) movement.subtractInPlace(forward);

  if (keys.d) movement.addInPlace(right);

  if (keys.a) movement.subtractInPlace(right);

  const moving = movement.lengthSquared() > 0.0001;

  // Speler bewegen
  if (moving) {
    movement.normalize();

    player.position.addInPlace(movement.scale(speed));

    player.rotation.y = Math.atan2(movement.x, movement.z);
  }

  // Animaties
  if (player.animationGroups?.length) {
    const idle =
      player.animationGroups.find((a) =>
        a.name.toLowerCase().includes("idle"),
      ) || player.animationGroups[0];

    const walk =
      player.animationGroups.find((a) =>
        a.name.toLowerCase().includes("walk"),
      ) || idle;

    const target = moving ? walk : idle;

    if (currentAnim !== target) {
      player.animationGroups.forEach((a) => a.stop());

      target.start(true);

      currentAnim = target;
    }
  }

  // Camera achter speler
  const horizontalDistance = cameraDistance * Math.cos(pitch);

  const verticalDistance = cameraHeight + cameraDistance * Math.sin(pitch);

  const target = new BABYLON.Vector3(
    player.position.x,
    player.position.y,
    player.position.z,
  );

  const desiredPosition = new BABYLON.Vector3(
    player.position.x - Math.sin(yaw) * horizontalDistance,

    player.position.y + verticalDistance,

    player.position.z - Math.cos(yaw) * horizontalDistance,
  );

  // Vloeiende camera
  const smoothness = 1 - Math.pow(0.001, engine.getDeltaTime() / 1000);

  camera.position = BABYLON.Vector3.Lerp(
    camera.position,
    desiredPosition,
    smoothness,
  );

  camera.setTarget(target);

  // E om te kopen
  if (keys.e && !lastBuyPressed) {
    tycoonButtons.forEach((btn) => {
      if (
        btn.isEnabled() &&
        BABYLON.Vector3.Distance(player.position, btn.position) < 1.8
      ) {
        tryBuy(btn);
      }
    });
  }

  lastBuyPressed = keys.e;
});
// ===========================================
// money display
// ===========================================

// ============================================
// PLAY MODE AAN / UIT
// ============================================

function togglePlayMode() {
  isPlayMode = !isPlayMode;

  clearPreview();

  document.getElementById("place-button").style.display = isPlayMode
    ? "none"
    : "block";

  document.querySelector(".row-buttons").style.display = isPlayMode
    ? "none"
    : "flex";

  gizmoManager.attachToMesh(null);

  if (isPlayMode) {
    money = Number(document.getElementById("starting-budget").value) || 0;

    currentPriority = 0;

    currentAnim = null;

    lastBuyPressed = false;

    tycoonButtons.forEach((btn) => {
      btn.metadata.bought = false;

      btn.metadata.forceShow = false;
    });

    player.setEnabled(true);

    player.position.set(0, playerSpawnY, -6);
    jumpBaseY = player.position.y;
    jumpVelocity = 0;
    isGrounded = true;

    yaw = 0;

    pitch = 0.18;

    camera.detachControl(canvas);

    if (player.checkCollisions !== undefined) {
      player.checkCollisions = true;
    }

    showCurrentPriority();

    updateMoneyDisplay();

    canvas.requestPointerLock();
  } else {
    player.animationGroups?.forEach((a) => a.stop());

    player.setEnabled(false);

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    keys.w = false;
    keys.a = false;
    keys.s = false;
    keys.d = false;
    keys.shift = false;
    keys.e = false;

    tycoonButtons.forEach((btn) => {
      btn.setEnabled(true);
    });

    camera.attachControl(canvas, true);

    updateMoneyDisplay();

    refreshInspector();
  }
}

// ============================================
// PLAY BUTTON
// ============================================

const playBtn = document.createElement("button");

playBtn.textContent = "▶ Play";

playBtn.style.cssText = `
    position:absolute;
    bottom:20px;
    left:20px;
    padding:12px 24px;
    background:#2a7;
    border:none;
    color:#fff;
    border-radius:8px;
    cursor:pointer;
    z-index:20;
`;

playBtn.onclick = togglePlayMode;

document.body.appendChild(playBtn);

// ============================================
// TOOLBAR
// ============================================

const toolBar = document.createElement("div");

toolBar.style.cssText = `
    position:absolute;
    top:20px;
    left:50%;
    transform:translateX(-50%);
    display:flex;
    gap:8px;
    z-index:20;
`;

["position", "rotation", "scale"].forEach((mode) => {
  const button = document.createElement("button");

  button.textContent =
    mode === "position" ? "Move" : mode === "rotation" ? "Rotate" : "Scale";

  button.style.cssText = `
        padding:8px 14px;
        background:#3a3a3a;
        border:none;
        color:#eee;
        border-radius:6px;
        cursor:pointer;
    `;

  button.onclick = () => setGizmoMode(mode);

  toolBar.appendChild(button);
});

document.body.appendChild(toolBar);

// ============================================
// PLAY MODE KEYBOARD
// ============================================

window.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.repeat &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
  ) {
    togglePlayMode();
  }
});

// ============================================
// EINDE DEEL 3
// ============================================

// ============================================
// DEEL 4 - SAVE / LOAD / UNDO / REDO
// ============================================

const undoStack = [];
const redoStack = [];

const MAX_HISTORY = 50;

let isRestoringHistory = false;

// ============================================
// PROJECT DATA
// ============================================

function getStartingBudget() {
  const input = document.getElementById("starting-budget");

  if (!input || input.value.trim() === "") {
    return 100;
  }

  const value = Number(input.value);

  return Number.isFinite(value) ? Math.max(0, value) : 100;
}

function getSavedButtonData(btn) {
  return {
    ...JSON.parse(JSON.stringify(btn.metadata)),
    pos: btn.position.asArray(),
    rotation: btn.rotation.asArray(),
    scaling: btn.scaling.asArray(),
  };
}

function applySavedButtonData(btn, data) {
  const metadata = { ...data };

  delete metadata.pos;
  delete metadata.rotation;
  delete metadata.scaling;

  Object.assign(btn.metadata, metadata);

  btn.position = BABYLON.Vector3.FromArray(data.pos || [0, 0, 0]);

  btn.rotation = BABYLON.Vector3.FromArray(data.rotation || [0, 0, 0]);

  btn.scaling = BABYLON.Vector3.FromArray(data.scaling || [1, 1, 1]);
}

function getProjectData() {

    return {
        moneyStart: getStartingBudget(),

        buttons: tycoonButtons.map(getSavedButtonData),

        placeableButtons: placeableButtons.map(btn => ({
            ...JSON.parse(JSON.stringify(btn.metadata)),
            pos: btn.position.asArray(),
            rotation: btn.rotation.asArray(),
            scaling: btn.scaling.asArray()
        }))
    };

}

// ============================================
// HISTORY OPSLAAN
// ============================================

function commitHistory() {
  if (isRestoringHistory || isPlayMode) return;

  const snapshot = JSON.stringify(getProjectData());

  if (undoStack[undoStack.length - 1] === snapshot) return;

  undoStack.push(snapshot);

  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }

  redoStack.length = 0;

  saveProject();
}

// ============================================
// PROJECT HERSTELLEN
// ============================================

function restoreProjectData(data) {
  isRestoringHistory = true;

  try {
    // Oude knoppen verwijderen
    tycoonButtons.forEach((btn) => btn.dispose());

    tycoonButtons.length = 0;

    selectedButton = null;

    if (gizmoManager) {
      gizmoManager.attachToMesh(null);
    }

    placeableButtons.forEach(btn => btn.dispose());
    placeableButtons.length = 0;

    selectedPlaceableButton = null;

    (data.placeableButtons || []).forEach(saved => {

    const btn = createPlaceableButton(
        BABYLON.Vector3.FromArray(
            saved.pos || [0, 0.08, 0]
        ),
        saved
    );

});

    // Budget herstellen
    document.getElementById("starting-budget").value = data.moneyStart ?? 100;

    // Knoppen opnieuw maken
    (data.buttons || []).forEach((bd) => {
      const btn = createTycoonButton(
        BABYLON.Vector3.FromArray(bd.pos || [0, 0, 0]),
      );

      const metadata = { ...bd };
      delete metadata.pos;

      Object.assign(btn.metadata, metadata);

      btn.position = BABYLON.Vector3.FromArray(bd.pos || [0, 0, 0]);
    });

    refreshInspector();

    updateButtonColors();
  } finally {
    isRestoringHistory = false;
  }
}

// ============================================
// UNDO
// ============================================

function undo() {
  if (isPlayMode || undoStack.length <= 1) return;

  const current = undoStack.pop();

  redoStack.push(current);

  const previous = JSON.parse(undoStack[undoStack.length - 1]);

  restoreProjectData(previous);

  saveProject();
}

// ============================================
// REDO
// ============================================

function redo() {
  if (isPlayMode || redoStack.length === 0) return;

  const next = redoStack.pop();

  undoStack.push(next);

  restoreProjectData(JSON.parse(next));

  saveProject();
}

// ============================================
// CTRL + Z / CTRL + SHIFT + Z
// ============================================

window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;

  if (e.key.toLowerCase() !== "z") return;

  if (e.target.matches("input, textarea, select")) return;

  e.preventDefault();

  if (e.shiftKey) {
    redo();
  } else {
    undo();
  }
});

// ============================================
// SAVE PROJECT
// ============================================

// ============================================
// NIEUWE SAVE PROJECT
// ============================================

function saveProject() {
  try {

    const data = {
      moneyStart: getStartingBudget(),

      buttons: tycoonButtons.map(getSavedButtonData),
      freeObjects: freeObjects.map((obj) => ({
        fileKey: obj.metadata.fileKey,
        fileName: obj.metadata.fileName,

        position: obj.position.asArray(),
        rotation: obj.rotation.asArray(),
        scaling: obj.scaling.asArray(),
      })),
      placeableButtons: placeableButtons.map(btn => ({
        ...JSON.parse(JSON.stringify(btn.metadata)),
        pos: btn.position.asArray(),
        rotation: btn.rotation.asArray(),
        scaling: btn.scaling.asArray()
    })),
    };

    localStorage.setItem("tycoon_" + projectId, JSON.stringify(data));

    history.replaceState(null, "", "?id=" + encodeURIComponent(projectId));

    console.log("Project opgeslagen:", data.buttons);
  } catch (error) {
    console.error("Project opslaan mislukt:", error);
  }
}

// ============================================
// STARTBUDGET DIRECT OPSLAAN
// ============================================

const startingBudgetInput = document.getElementById("starting-budget");

if (startingBudgetInput) {
  startingBudgetInput.addEventListener("input", () => {
    if (!isRestoringHistory) {
      saveProject();
    }
  });

  startingBudgetInput.addEventListener("change", () => {
    if (!isRestoringHistory) {
      commitHistory();
    }
  });
}

// ============================================
// LOAD PROJECT
// ============================================

// ============================================
// NIEUWE LOAD PROJECT
// ============================================

async function loadProject() {
  const raw = localStorage.getItem("tycoon_" + projectId);

  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    document.getElementById("starting-budget").value = data.moneyStart ?? 100;

    // Oude knoppen herstellen
    data.buttons?.forEach((bd) => {
      const btn = createTycoonButton(
        BABYLON.Vector3.FromArray(bd.pos || [0, 0, 0]),
      );

      // Metadata kopiëren zonder de positie
      const metadata = { ...bd };

      delete metadata.pos;

      Object.assign(btn.metadata, metadata);

      // De opgeslagen positie afzonderlijk herstellen
      btn.position = BABYLON.Vector3.FromArray(bd.pos || [0, 0, 0]);

      btn.rotation = BABYLON.Vector3.FromArray(bd.rotation || [0, 0, 0]);

      btn.scaling = BABYLON.Vector3.FromArray(bd.scaling || [1, 1, 1]);
    });

    // Plaatsbare UI Buttons herstellen
    (data.placeableButtons || []).forEach(saved => {

        createPlaceableButton(
            BABYLON.Vector3.FromArray(
                saved.pos || [0, 0.08, 0]
            ),
            saved
        );

    });

    // Vrije objecten herstellen
    for (const saved of data.freeObjects || []) {
      try {
        if (!saved.fileKey) continue;

        const file = await getFreeObject(saved.fileKey);

        if (!file) {
          console.warn("Bestand niet gevonden:", saved.fileName);
          continue;
        }

        const url = URL.createObjectURL(file);

        try {
          const extension = saved.fileName.split(".").pop().toLowerCase();

          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            url,
            "",
            scene,
            undefined,
            "." + extension,
          );

          const root = new BABYLON.TransformNode(
            "freeObject_" + Date.now(),
            scene,
          );

          result.meshes.forEach((mesh) => {
            if (!mesh.parent) {
              mesh.parent = root;
            }

            mesh.isPickable = true;
          });

          root.position = BABYLON.Vector3.FromArray(
            saved.position || [0, 0, 0],
          );

          root.rotation = BABYLON.Vector3.FromArray(
            saved.rotation || [0, 0, 0],
          );

          root.scaling = BABYLON.Vector3.FromArray(saved.scaling || [1, 1, 1]);

          root.metadata = {
            isFreeObject: true,
            fileName: saved.fileName,
            fileKey: saved.fileKey,
          };

          freeObjects.push(root);
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error(
          "Vrij object kon niet worden geladen:",
          saved.fileName,
          error,
        );
      }
    }

    // Modellen van tycoon-knoppen laden in objectLibrary
    for (const button of tycoonButtons) {
      const objects = button.metadata.objects || [];

      for (const obj of objects) {
        if (!obj.fileKey || objectLibrary[obj.id]) continue;

        try {
          const file = await getFreeObject(obj.fileKey);

          if (!file) {
            console.warn("Modelbestand niet gevonden voor:", obj.id);
            continue;
          }

          const url = URL.createObjectURL(file);

          try {
            const extension =
              "." +
              (obj.fileName || "model.glb").split(".").pop().toLowerCase();

            const result = await BABYLON.SceneLoader.ImportMeshAsync(
              "",
              url,
              "",
              scene,
              undefined,
              extension,
            );

            const root = new BABYLON.TransformNode("imported_" + obj.id, scene);

            attachImportedModelHierarchy(root, result);

            root.setEnabled(false);

            objectLibrary[obj.id] = {
              mesh: root,
              meshes: [root],
              name: obj.fileName || obj.id,
              animationGroups: result.animationGroups || [],
            };

            console.log("Button-model geladen:", obj.id);
          } finally {
            URL.revokeObjectURL(url);
          }
        } catch (error) {
          console.error("Button-model laden mislukt:", obj.id, error);
        }
      }
    }

    if (tycoonButtons.length > 0) {
      selectButton(tycoonButtons[0]);
    }

    console.log("Project succesvol geladen!");
  } catch (error) {
    console.error("Project laden mislukt:", error);
  }
}

// ============================================
// AUTOSAVE
// ============================================

setInterval(() => {
  if (!isPlayMode) {
    saveProject();
  }
}, 8000);

// ============================================
// IMPORTEREN VAN OBJECTEN
// ============================================

const fileInput = document.createElement("input");

fileInput.type = "file";
fileInput.accept = ".glb,.gltf";
fileInput.style.display = "none";

document.body.appendChild(fileInput);

let currentImportIndex = null;

function attachImportedModelHierarchy(root, result) {
  // Zowel meshes als TransformNodes meenemen.
  // Zo blijft de volledige GLB-hiërarchie behouden.
  const importedNodes = new Set([
    ...(result.transformNodes || []),
    ...(result.meshes || []),
  ]);

  importedNodes.forEach((node) => {
    // Alleen de bovenste onderdelen aan onze nieuwe root hangen.
    // De onderlinge hiërarchie blijft intact.
    if (!node.parent || !importedNodes.has(node.parent)) {
      node.parent = root;
    }
  });
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("choose-obj")) {
    if (!selectedButton || isPlayMode) return;

    currentImportIndex = Number(e.target.dataset.index);

    fileInput.click();
  }
});

fileInput.onchange = async (e) => {
  const file = e.target.files[0];

  if (
    !file ||
    currentImportIndex === null ||
    !selectedButton ||
    !selectedButton.metadata.objects[currentImportIndex]
  ) {
    fileInput.value = "";
    return;
  }

  const row = selectedButton.metadata.objects[currentImportIndex];

  const url = URL.createObjectURL(file);

  const id = row.id || file.name.replace(/\.[^/.]+$/, "");

  try {
    const extension = "." + file.name.split(".").pop().toLowerCase();

    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      "",
      url,
      "",
      scene,
      undefined,
      extension,
    );

    if (!result.meshes || result.meshes.length === 0) {
      throw new Error("Het bestand bevat geen 3D-meshes.");
    }

    const fileKey = projectId + "_button_model_" + id + "_" + Date.now();

    await storeFreeObject(fileKey, file);

    const root = new BABYLON.TransformNode("imported_" + id, scene);

    // Volledige modelhiërarchie behouden
    attachImportedModelHierarchy(root, result);

    root.setEnabled(false);

    objectLibrary[id] = {
      mesh: root,
      meshes: [root],
      name: file.name,
      animationGroups: result.animationGroups || [],
    };

    row.id = id;
    row.fileKey = fileKey;
    row.fileName = file.name;

    refreshInspector();

    saveProject();
    commitHistory();

    console.log("Model geïmporteerd:", id);
    console.log("Model opgeslagen:", fileKey);
  } catch (error) {
    console.error("Importeren mislukt:", error);

    alert(
      "Model importeren of opslaan mislukt. " +
        "Bekijk de console voor details.",
    );
  } finally {
    URL.revokeObjectURL(url);

    fileInput.value = "";
    currentImportIndex = null;
  }
};

// ============================================
// UNDO / REDO KNOPPEN
// ============================================

const historyToolbar = document.createElement("div");

historyToolbar.style.cssText = `
    position:absolute;
    top:75px;
    left:50%;
    transform:translateX(-50%);
    display:flex;
    gap:8px;
    z-index:20;
`;

function createHistoryButton(label, callback) {
  const button = document.createElement("button");

  button.textContent = label;

  button.style.cssText = `
        padding:8px 14px;
        background:#3a3a3a;
        border:none;
        color:white;
        border-radius:6px;
        cursor:pointer;
    `;

  button.onclick = callback;

  historyToolbar.appendChild(button);
}

createHistoryButton("↶ Undo", undo);

createHistoryButton("↷ Redo", redo);

document.body.appendChild(historyToolbar);

// ============================================
// EINDE DEEL 4
// ============================================

// ============================================
// DEEL 5 - EDITOR BEDIENING
// ============================================

// ============================================
// OBJECT SELECTEREN MET MUIS
// ============================================


scene.onPointerObservable.add(pointerInfo => {

    if (isPlayMode || previewMode) return;

    if (
        pointerInfo.type !==
        BABYLON.PointerEventTypes.POINTERDOWN
    ) return;

    if (
        pointerInfo.event.button !== 0 ||
        pointerInfo.event.target !== canvas
    ) return;

    const pick = scene.pick(
        scene.pointerX,
        scene.pointerY,
        mesh => {

            if (!mesh.isEnabled()) return false;

            const parent = mesh.parent;

            return (
                mesh.metadata?.isTycoonButton ||
                parent?.metadata?.isTycoonButton ||
                mesh.metadata?.isPlaceableButton ||
                parent?.metadata?.isPlaceableButton
            );
        }
    );

    if (pick?.hit && pick.pickedMesh) {

        let target = pick.pickedMesh;

        while (
            target &&
            !target.metadata?.isTycoonButton &&
            !target.metadata?.isPlaceableButton
        ) {
            target = target.parent;
        }

        if (target?.metadata?.isPlaceableButton) {

            selectPlaceableButton(target);

        } else if (target?.metadata?.isTycoonButton) {

            selectButton(target);

        }

    } else {

        selectedButton = null;
        selectedPlaceableButton = null;

        gizmoManager.attachToMesh(null);

        refreshInspector();

    }

});

// ============================================
// GIZMO VERBETERINGEN
// ============================================

function improveGizmo() {
  if (!gizmoManager) return;

  gizmoManager.positionGizmoEnabled = true;

  gizmoManager.usePointerToAttachGizmos = false;

  if (gizmoManager.gizmos.positionGizmo) {
    gizmoManager.gizmos.positionGizmo.scaleRatio = 1.2;
  }

  if (gizmoManager.gizmos.rotationGizmo) {
    gizmoManager.gizmos.rotationGizmo.scaleRatio = 1.2;
  }

  if (gizmoManager.gizmos.scaleGizmo) {
    gizmoManager.gizmos.scaleGizmo.scaleRatio = 1.2;
  }
}

improveGizmo();

// ============================================
// OBJECT OPSLAAN NA HET VERSLEPEN
// ============================================

window.addEventListener("pointerup", () => {
  if (isPlayMode || isRestoringHistory) return;

  // Alleen opslaan als er een object geselecteerd is
  if (!selectedButton && !selectedFreeObject) return;

  // Project direct opslaan
  saveProject();

  // Undo-geschiedenis bijwerken voor knoppen
    if (selectedButton || selectedPlaceableButton) {
        commitHistory();
    }

  if (
    !selectedButton &&
    !selectedFreeObject &&
    !selectedPlaceableButton
) return;

  console.log("Objectpositie opgeslagen!");
});

// ============================================
// GIZMO: POSITIE DIRECT OPSLAAN
// ============================================

function enableGizmoAutoSave() {
  if (!gizmoManager) return;

  const gizmos = [
    gizmoManager.gizmos.positionGizmo,
    gizmoManager.gizmos.rotationGizmo,
    gizmoManager.gizmos.scaleGizmo,
  ];

  gizmos.forEach((gizmo) => {
    if (!gizmo || !gizmo.onDragEndObservable) return;

    gizmo.onDragEndObservable.add(() => {
      if (isPlayMode || isRestoringHistory) return;

      // Positie en andere transformaties opslaan
      saveProject();

      // Undo/Redo geschiedenis bijwerken
      commitHistory();

      console.log("Objecttransformatie opgeslagen!");
    });
  });
}

enableGizmoAutoSave();

// ============================================
// KNOP VERWIJDEREN
// ============================================

function deleteSelectedButton() {

    if (selectedPlaceableButton) {

        const index = placeableButtons.indexOf(
            selectedPlaceableButton
        );

        if (index !== -1) {
            placeableButtons.splice(index, 1);
        }

        selectedPlaceableButton.dispose();

        selectedPlaceableButton = null;

        gizmoManager.attachToMesh(null);

        refreshInspector();

        commitHistory();

        return;
    }
  if (isPlayMode || !selectedButton) return;

  const index = tycoonButtons.indexOf(selectedButton);

  if (index === -1) return;

  selectedButton.dispose();

  tycoonButtons.splice(index, 1);

  selectedButton = null;

  gizmoManager.attachToMesh(null);

  refreshInspector();

  commitHistory();
}

// ============================================
// DELETE TOETS
// ============================================

window.addEventListener("keydown", (e) => {
  if (isPlayMode) return;

  if (e.key !== "Delete" && e.key !== "Backspace") return;

  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName))
    return;

  e.preventDefault();

  deleteSelectedButton();
});

// ============================================
// OBJECT RIJEN VERWIJDEREN
// ============================================

function removeSelectedObjectRow(index) {
  if (!selectedButton || isPlayMode) return;

  if (index < 0 || index >= selectedButton.metadata.objects.length) return;

  selectedButton.metadata.objects.splice(index, 1);

  refreshInspector();

  commitHistory();
}

// ============================================
// INSPECTOR VEILIGER MAKEN
// ============================================

const originalRefreshInspector = refreshInspector;

refreshInspector = function () {
  originalRefreshInspector();

  if (isPlayMode) return;

  const list = document.getElementById("object-list");

  if (!selectedButton) return;

  const d = selectedButton.metadata;

  const info = document.createElement("p");

  info.style.cssText = `
        font-size:11px;
        color:#aaa;
        margin-top:8px;
    `;

  info.textContent = "Delete = verwijder knop | O = preview";

  list.appendChild(info);
};

// ============================================
// EXTRA EDITOR KNOPPEN
// ============================================

const deleteButton = document.createElement("button");

deleteButton.textContent = "🗑 Verwijder knop";

deleteButton.style.cssText = `
    position:absolute;
    bottom:20px;
    right:460px;
    padding:12px 16px;
    background:#a33;
    color:white;
    border:none;
    border-radius:8px;
    cursor:pointer;
    z-index:20;
`;

deleteButton.onclick = deleteSelectedButton;

document.body.appendChild(deleteButton);

// ============================================
// EDITOR UI VERBERGEN IN PLAY MODE
// ============================================

const originalTogglePlayMode = togglePlayMode;

togglePlayMode = function () {
  originalTogglePlayMode();

  const display = isPlayMode ? "none" : "block";

  deleteButton.style.display = display;

  historyToolbar.style.display = isPlayMode ? "none" : "flex";

  toolBar.style.display = display;
};

// ============================================
// EINDE DEEL 5
// ============================================

// ============================================
// TYCOON MAKER
// DEEL 6 - FINALISATIE
// ============================================

// ============================================
// 1. VEILIGE STATUSCONTROLE
// ============================================

let editorInitialized = false;
let playModeTransition = false;

function isTypingInEditor() {
  const el = document.activeElement;

  return (
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
}

// ============================================
// 2. CAMERA INSTELLINGEN
// ============================================

const cameraSettings = {
  distance: 6,
  height: 1.8,
  sensitivity: 0.0015,
  minPitch: -0.45,
  maxPitch: 0.85,
  smoothness: 12,
};

// Camera opnieuw initialiseren
function resetPlayerCamera() {
  yaw = 0;
  pitch = 0.18;

  if (player && camera) {
    camera.position.set(
      player.position.x,
      player.position.y,
      player.position.z - 6,
    );

    camera.setTarget(player.position.add(new BABYLON.Vector3(0, 0, 0)));
  }
}

// ============================================
// 3. CAMERA MUISBEDIENING
// ============================================

canvas.addEventListener("mousemove", (e) => {
  if (!isPlayMode) return;

  if (document.pointerLockElement !== canvas) return;

  yaw += e.movementX * cameraSettings.sensitivity;

  pitch -= e.movementY * cameraSettings.sensitivity;

  pitch = Math.max(
    cameraSettings.minPitch,
    Math.min(cameraSettings.maxPitch, pitch),
  );
});

// ============================================
// 4. MUIS OPNIEUW VASTZETTEN
// ============================================

canvas.addEventListener("click", () => {
  if (isPlayMode && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

// ============================================
// 5. PLAY MODE VEILIGHEID
// ============================================

const previousTogglePlayMode = togglePlayMode;

togglePlayMode = function () {
  if (playModeTransition) return;

  playModeTransition = true;

  try {
    previousTogglePlayMode();

    if (isPlayMode) {
      resetPlayerCamera();

      if (player) {
        player.setEnabled(true);
      }

      if (camera) {
        camera.detachControl(canvas);
      }
    } else {
      if (camera) {
        camera.attachControl(canvas, true);
      }

      if (player) {
        player.setEnabled(false);
      }

      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  } finally {
    playModeTransition = false;
  }
};

// ============================================
// 6. BETERE TOETSENBEDIENING
// ============================================

window.addEventListener("keydown", (e) => {
  if (isTypingInEditor()) return;

  // Enter = Play Mode
  if (e.key === "Enter" && !e.ctrlKey && !e.altKey && !e.repeat) {
    e.preventDefault();

    togglePlayMode();

    return;
  }

  // Escape = Play Mode verlaten
  if (e.key === "Escape" && isPlayMode) {
    // Pointer lock wordt door de browser vrijgegeven.
    // Play Mode blijft actief totdat je Enter gebruikt.

    return;
  }
});

// ============================================
// 7. VEILIGE UNDO / REDO
// ============================================

function safeUndo() {
  if (isPlayMode || isTypingInEditor()) return;

  if (typeof undo === "function") {
    undo();
  }
}

function safeRedo() {
  if (isPlayMode || isTypingInEditor()) return;

  if (typeof redo === "function") {
    redo();
  }
}

// ============================================
// 8. OPSLAAN MET FOUTAFHANDELING
// ============================================

function verifyProjectStorage() {
  try {
    const key = "tycoon_" + projectId;

    const raw = localStorage.getItem(key);

    if (raw) {
      JSON.parse(raw);
    }

    return true;
  } catch (error) {
    console.error("Projectopslag controleren mislukt:", error);

    return false;
  }
}

// ============================================
// 9. AUTOMATISCHE CONTROLE
// ============================================

function validateEditor() {
  const requiredFunctions = [
    "saveProject",
    "loadProject",
    "commitHistory",
    "undo",
    "redo",
    "togglePlayMode",
    "togglePreview",
    "selectButton",
    "deleteSelectedButton",
    "tryBuy",
  ];

  const missing = requiredFunctions.filter(
    (name) =>
      typeof window[name] !== "function" && typeof eval(name) !== "function",
  );

  if (missing.length > 0) {
    console.warn("Controleer deze functies:", missing);

    return false;
  }

  return true;
}

// ============================================
// 10. EDITOR STATUS
// ============================================

function getEditorStatus() {
  return {
    playMode: isPlayMode,
    selectedButton: selectedButton?.metadata?.buttonID || null,
    buttonCount: tycoonButtons.length,
    money: money,
    currentPriority: currentPriority,
    previewMode: previewMode,
  };
}

// ============================================
// 11. RESIZE FIX
// ============================================

window.addEventListener("resize", () => {
  if (engine) {
    engine.resize();
  }
});

// ============================================
// 12. INITIALISATIE
// ============================================

function finishEditorInitialization() {
  if (editorInitialized) return;

  editorInitialized = true;

  if (typeof validateEditor === "function") {
    validateEditor();
  }

  if (typeof updateMoneyDisplay === "function") {
    updateMoneyDisplay();
  }

  console.log(
    "%cTYCOON MAKER READY",
    "color:#35d47a;font-size:20px;font-weight:bold",
  );

  console.log("Editor status:", getEditorStatus());
}

// ============================================
// EINDE DEEL 6
// ============================================

// De scene kan al klaar zijn wanneer dit
// laatste gedeelte wordt uitgevoerd.
if (scene && scene.isReady()) {
  finishEditorInitialization();
} else if (scene) {
  scene.executeWhenReady(() => {
    finishEditorInitialization();
  });
}

// FIX: PLAATS TYCOON KNOP

document.addEventListener("DOMContentLoaded", () => {
  const placeButton = document.getElementById("place-button");
  const floorCheckbox = document.getElementById("floor-as-object");

  if (!placeButton) {
    console.error("Plaats-knop niet gevonden!");
    return;
  }


// ============================================
// PLAATS UI BUTTON
// ============================================

const placeUIButton = document.createElement("button");

placeUIButton.textContent = "+ Plaats UI Button";

placeUIButton.style.cssText = `
    width:100%;
    padding:12px;
    margin-top:8px;
    background:#6554c0;
    color:white;
    border:none;
    border-radius:7px;
    cursor:pointer;
`;

placeButton.parentElement.appendChild(placeUIButton);

placeUIButton.addEventListener("click", () => {

    if (!scene || isPlayMode) return;

    const btn = createPlaceableButton(
        new BABYLON.Vector3(
            (Math.random() - 0.5) * 8,
            0.08,
            (Math.random() - 0.5) * 8
        )
    );

    selectPlaceableButton(btn);

    saveProject();
    commitHistory();

});


  placeButton.addEventListener("click", () => {
    if (!scene || isPlayMode) return;

    const btn = createTycoonButton(
      new BABYLON.Vector3(
        (Math.random() - 0.5) * 8,
        0,
        (Math.random() - 0.5) * 8,
      ),
    );

    selectButton(btn);
    saveProject();
  });

  if (floorCheckbox) {
    floorCheckbox.addEventListener("change", () => {
      const floor = scene.getMeshByName("floor");
      if (!floor) return;

      if (floorCheckbox.checked) {
        floor.metadata = { isFreeObject: true, fileName: "floor" };
        floor.isPickable = true;
        selectFreeObject(floor);
      } else {
        floor.metadata = null;
        floor.isPickable = false;
        if (selectedFreeObject === floor) {
          selectedFreeObject = null;
          if (gizmoManager) gizmoManager.attachToMesh(null);
        }
      }
    });
  }
});

// ============================================
// VRIJE 3D OBJECTEN IMPORTEREN
// ============================================

let selectedFreeObject = null;

const freeObjectInput = document.createElement("input");

freeObjectInput.type = "file";
freeObjectInput.accept = ".glb,.gltf";
freeObjectInput.style.display = "none";

document.body.appendChild(freeObjectInput);

// Importknop
const importFreeButton = document.createElement("button");

importFreeButton.textContent = "📦 Import 3D Object";

importFreeButton.style.cssText = `
    position:absolute;
    bottom:80px;
    left:20px;
    padding:12px 18px;
    background:#365b91;
    color:white;
    border:none;
    border-radius:8px;
    cursor:pointer;
    z-index:20;
`;

document.body.appendChild(importFreeButton);

importFreeButton.onclick = () => {
  if (isPlayMode) return;

  freeObjectInput.click();
};

// ============================================
// .TYCOON EXPORT / IMPORT
// ============================================

const tycoonFileInput = document.createElement("input");
tycoonFileInput.type = "file";
tycoonFileInput.accept = ".tycoon,.json";
tycoonFileInput.style.display = "none";
document.body.appendChild(tycoonFileInput);

const exportButton = document.createElement("button");
exportButton.textContent = "💾 Export .tycoon";
exportButton.style.cssText = `
    position:absolute;
    bottom:140px;
    left:20px;
    padding:12px 18px;
    background:#2e7d32;
    color:white;
    border:none;
    border-radius:8px;
    cursor:pointer;
    z-index:20;
`;
document.body.appendChild(exportButton);

const importButton = document.createElement("button");
importButton.textContent = "📂 Import .tycoon";
importButton.style.cssText = `
    position:absolute;
    bottom:190px;
    left:20px;
    padding:12px 18px;
    background:#1565c0;
    color:white;
    border:none;
    border-radius:8px;
    cursor:pointer;
    z-index:20;
`;
document.body.appendChild(importButton);

exportButton.onclick = exportTycoon;
importButton.onclick = () => tycoonFileInput.click();

tycoonFileInput.onchange = async () => {
  const file = tycoonFileInput.files[0];
  if (!file) return;
  await importTycoon(file);
  tycoonFileInput.value = "";
};

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function base64ToFile(base64, fileName, mimeType = "model/gltf-binary") {
  const res = await fetch(`data:${mimeType};base64,${base64}`);
  const blob = await res.blob();
  return new File([blob], fileName, { type: mimeType });
}

async function exportTycoon() {
  if (isPlayMode) return;

  try {
    saveProject();

    const data = JSON.parse(
      localStorage.getItem("tycoon_" + projectId) || "{}",
    );

    // Alle gebruikte modellen ophalen
    const modelKeys = new Set();

    (data.freeObjects || []).forEach((obj) => {
      if (obj.fileKey) modelKeys.add(obj.fileKey);
    });

    (data.buttons || []).forEach((btn) => {
      (btn.objects || []).forEach((obj) => {
        if (obj.fileKey) modelKeys.add(obj.fileKey);
      });
    });

    const models = {};

    for (const key of modelKeys) {
      const file = await getFreeObject(key);
      if (file) {
        models[key] = {
          name: file.name,
          data: await fileToBase64(file),
        };
      }
    }

    const exportData = {
      version: 1,
      project: data,
      models,
    };

    const blob = new Blob([JSON.stringify(exportData)], {
      type: "application/json",
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tycoon-" + (projectId || "project") + ".tycoon";
    a.click();
    URL.revokeObjectURL(a.href);

    console.log("Export gelukt!");
  } catch (error) {
    console.error("Export mislukt:", error);
    alert("Export mislukt. Bekijk de console.");
  }
}

async function importTycoon(file) {
  if (isPlayMode || !scene) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.project || !data.models) {
      throw new Error("Ongeldig .tycoon bestand");
    }

    // Modellen terugzetten in IndexedDB
    for (const [key, model] of Object.entries(data.models)) {
      const f = await base64ToFile(model.data, model.name);
      await storeFreeObject(key, f);
    }

    // Project data opslaan
    localStorage.setItem("tycoon_" + projectId, JSON.stringify(data.project));

    // Scene leegmaken en opnieuw laden
    tycoonButtons.forEach((b) => b.dispose());
    tycoonButtons.length = 0;

    freeObjects.forEach((o) => o.dispose());
    freeObjects.length = 0;

    Object.keys(objectLibrary).forEach((k) => delete objectLibrary[k]);

    selectedButton = null;
    selectedFreeObject = null;
    if (gizmoManager) gizmoManager.attachToMesh(null);

    await loadProject();

    alert("Tycoon succesvol geïmporteerd!");
  } catch (error) {
    console.error("Import mislukt:", error);
    alert("Import mislukt. Is het een geldig .tycoon bestand?");
  }
}

// Bestand importeren

freeObjectInput.onchange = async () => {
  const file = freeObjectInput.files[0];

  if (!file || !scene || isPlayMode) return;

  const extension = file.name.split(".").pop().toLowerCase();

  if (!["glb", "gltf"].includes(extension)) {
    alert("Kies een GLB- of GLTF-bestand.");
    freeObjectInput.value = "";
    return;
  }

  const url = URL.createObjectURL(file);

  try {
    // Bestandstype expliciet meegeven
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      "",
      url,
      "",
      scene,
      undefined,
      "." + extension,
    );

    // Hoofdobject maken
    const root = new BABYLON.TransformNode("freeObject_" + Date.now(), scene);

    // Geïmporteerde meshes koppelen
    result.meshes.forEach((mesh) => {
      if (!mesh.parent) {
        mesh.parent = root;
      }

      mesh.isPickable = true;
    });

    root.position.set(0, 0, 0);

    root.metadata = {
      isFreeObject: true,
      fileName: file.name,
    };

    // Unieke opslag-ID
    const fileKey = projectId + "_model_" + Date.now();

    root.metadata.fileKey = fileKey;

    // Bewaar het originele bestand
    await storeFreeObject(fileKey, file);

    // Voeg toe aan wereld
    freeObjects.push(root);

    selectFreeObject(root);

    // Project opslaan
    saveProject();

    console.log("3D-object succesvol geïmporteerd:", file.name);
  } catch (error) {
    console.error("Importeren mislukt:", error);

    alert("Importeren mislukt. Controleer of het GLB/GLTF-bestand geldig is.");
  } finally {
    URL.revokeObjectURL(url);

    freeObjectInput.value = "";
  }
};

// Vrij object selecteren
function selectFreeObject(object) {
  if (isPlayMode || previewMode || !object) return;

  selectedFreeObject = object;
  selectedButton = null;

  if (gizmoManager) {
    gizmoManager.attachToMesh(null);
    gizmoManager.attachToNode(object);
  }

  refreshInspector();

  console.log("Vrij object geselecteerd:", object.name);
}
// Vrij object verwijderen
function deleteSelectedFreeObject() {
  if (!selectedFreeObject || isPlayMode) return;

  const index = freeObjects.indexOf(selectedFreeObject);

  if (index !== -1) {
    freeObjects.splice(index, 1);
  }

  selectedFreeObject.dispose();

  selectedFreeObject = null;

  gizmoManager.attachToMesh(null);

  refreshInspector();

  saveProject();
}

// ============================================
// VRIJE OBJECTEN SELECTEREN MET MUIS
// ============================================

scene.onPointerObservable.add((pointerInfo) => {
  if (isPlayMode || previewMode) return;

  if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;

  if (pointerInfo.event.button !== 0) return;

  const pick = scene.pick(
    scene.pointerX,
    scene.pointerY,
    (mesh) => mesh.isPickable && !mesh.metadata?.isPreview,
  );

  if (!pick?.hit || !pick.pickedMesh) return;

  let object = pick.pickedMesh;

  while (object && !object.metadata?.isFreeObject) {
    object = object.parent;
  }

  if (object?.metadata?.isFreeObject) {
    selectFreeObject(object);
  }
});

// ============================================
// DELETE VOOR VRIJE OBJECTEN
// ============================================

window.addEventListener("keydown", (e) => {
  if (isPlayMode || isTypingInEditor()) return;

  if (e.key === "Delete" && selectedFreeObject) {
    e.preventDefault();

    deleteSelectedFreeObject();
  }
});

// ============================================
// PLAY MODE UI
// ============================================

let inspectorHidden = false;

function toggleInspector() {
  const inspector = document.getElementById("inspector");

  if (!inspector) return;

  inspectorHidden = !inspectorHidden;
  inspector.classList.toggle("hidden", inspectorHidden);
}

function updatePlayModeUI() {
  const inspector = document.getElementById("inspector");
  const moneyDisplay = document.getElementById("money-display");

  const editorElements = [
    playBtn,
    toolBar,
    historyToolbar,
    deleteButton,
    importFreeButton,
    exportButton,
    importButton,
  ];

  if (isPlayMode) {
    if (inspector) inspector.style.display = "none";
    if (moneyDisplay) moneyDisplay.style.display = "block";

    editorElements.forEach((element) => {
      if (element) element.style.display = "none";
    });
  } else {
    if (inspector) {
      inspector.style.display = inspectorHidden ? "none" : "";
    }

    if (moneyDisplay) moneyDisplay.style.display = "none";

    editorElements.forEach((element) => {
      if (element) element.style.display = "";
    });
  }
}
// ============================================
// EINDE VRIJE OBJECT IMPORT
// ============================================

// ============================================
// FREE OBJECT STORAGE - INDEXEDDB
// ============================================

const freeObjectDB = new Promise((resolve, reject) => {
  const request = indexedDB.open("TycoonMakerAssets", 1);

  request.onupgradeneeded = () => {
    const db = request.result;

    if (!db.objectStoreNames.contains("models")) {
      db.createObjectStore("models");
    }
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function storeFreeObject(key, file) {
  const db = await freeObjectDB;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("models", "readwrite");

    transaction.objectStore("models").put(file, key);

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getFreeObject(key) {
  const db = await freeObjectDB;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("models", "readonly");

    const request = transaction.objectStore("models").get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// FIX O-TOETS - PREVIEW

window.addEventListener("keydown", function (e) {
  if (e.repeat) return;

  if (e.code !== "KeyO") return;

  if (isPlayMode) return;

  // Niet activeren tijdens typen
  const active = document.activeElement;

  if (
    active &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT")
  )
    return;

  e.preventDefault();

  console.log("O ingedrukt!");

  if (typeof togglePreview !== "function") {
    console.error("togglePreview bestaat niet!");
    return;
  }

  togglePreview();
});

console.log("O-preview bediening geladen!");

function updateMoneyDisplay() {
  const display = document.getElementById("money-display");

  if (!display) return;

  moneyDisplay = display;

  display.textContent =
    "💰 Geld: " + Math.floor(Number(money) || 0).toLocaleString("nl-NL");

  display.style.display = isPlayMode ? "block" : "none";
}
updatePlayModeUI();

// ============================================
// APARTE PLAY-PAGINA OPENEN
// ============================================

function openPlayMode() {
  // Eerst het project opslaan
  saveProject();

  // Daarna de aparte Play-pagina openen
  window.location.href = "play/play.html?id=" + encodeURIComponent(projectId);
}

// Play-knop koppelen
playBtn.onclick = openPlayMode;

// Enter-toets koppelen
// Capture zorgt ervoor dat de oude Enter-handler
// de editor niet meer in de oude Play Mode zet.

window.addEventListener(
  "keydown",
  function (e) {
    if (e.key !== "Enter" || e.repeat) return;

    if (
      ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
    )
      return;

    e.preventDefault();
    e.stopImmediatePropagation();

    openPlayMode();
  },
  true,
);

console.log("Aparte Play-pagina gekoppeld!");
