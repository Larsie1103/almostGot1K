
// ============================================
// TYCOON MAKER - PLAY.JS
// VOLLEDIGE LOSSE PLAY MODE
// ============================================

const canvas = document.getElementById("renderCanvas");
const moneyDisplay = document.getElementById("money-display");
const exitButton = document.getElementById("exit-button");

const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true
});

const params = new URLSearchParams(location.search);

const projectId = params.get("id") || "local-default";
const storageKey = "tycoon_" + projectId;

// ============================================
// VARIABELEN
// ============================================

let scene = null;
let camera = null;
let player = null;

let money = 100;
let currentPriority = 0;

let yaw = 0;
let pitch = 0.18;

let jumpVelocity = 0;
let jumpBaseY = 0;
let isGrounded = true;

let currentAnim = null;
let lastBuyPressed = false;

const jumpPower = 7.5;
const gravity = 18;

const cameraDistance = 6;
const cameraHeight = 1.8;
const mouseSensitivity = 0.0015;

const keys = {};
const tycoonButtons = [];
const objectLibrary = {};
const spawnedObjects = [];

let projectData = null;
let incomeDisplayTimer = 0;

// ============================================
// INDEXEDDB
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

async function getFreeObject(key) {

    const db = await freeObjectDB;

    return new Promise((resolve, reject) => {

        const transaction = db.transaction("models", "readonly");

        const request = transaction.objectStore("models").get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

    });

}

// ============================================
// GELD
// ============================================

function updateMoneyDisplay() {

    const displayValue = Math.floor(money);

    moneyDisplay.textContent =
        "💰 Geld: " +
        displayValue.toLocaleString("nl-NL");

}

// ============================================
// SCENE
// ============================================

async function createScene() {

    scene = new BABYLON.Scene(engine);

    scene.clearColor = new BABYLON.Color4(
        0.12,
        0.12,
        0.12,
        1
    );

    scene.collisionsEnabled = true;

    // Licht

    const hemi = new BABYLON.HemisphericLight(
        "hemi",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );

    hemi.intensity = 0.85;

    // Vloer

    const floor = BABYLON.MeshBuilder.CreateGround(
        "floor",
        {
            width: 100,
            height: 100
        },
        scene
    );

    const floorMaterial = new BABYLON.StandardMaterial(
        "floorMaterial",
        scene
    );

    floorMaterial.diffuseColor =
        new BABYLON.Color3(0.25, 0.25, 0.28);

    floor.material = floorMaterial;

    // Camera

    camera = new BABYLON.FreeCamera(
        "playCamera",
        new BABYLON.Vector3(0, 3, -12),
        scene
    );

    camera.minZ = 0.1;

    // Speler

    try {

        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "../models/",
            "character.glb",
            scene
        );

        player = result.meshes[0];

        player.name = "playerRoot";

        player.scaling.setAll(1);

        player.position.set(0, 0, -6);

        player.computeWorldMatrix(true);

        const bounds = player.getHierarchyBoundingVectors(true);

        player.position.y -= bounds.min.y;

        player.rotationQuaternion = null;

        player.animationGroups = result.animationGroups || [];

        player.animationGroups.forEach(animation => {
            animation.stop();
        });

    } catch (error) {

        console.warn(
            "character.glb niet gevonden. Fallback capsule gebruikt.",
            error
        );

        player = BABYLON.MeshBuilder.CreateCapsule(
            "player",
            {
                height: 1.8,
                radius: 0.35
            },
            scene
        );

        player.position.set(0, 0.9, -6);

        const material = new BABYLON.StandardMaterial(
            "playerMaterial",
            scene
        );

        material.diffuseColor =
            new BABYLON.Color3(0.2, 0.6, 1);

        player.material = material;
    }

    player.setEnabled(true);

    // Collision ellipsoid voor de speler
    player.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);
    player.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);
    player.checkCollisions = true;

    jumpBaseY = player.position.y;

    // Camera direct achter speler zetten

    resetCamera();

}

// ============================================
// CAMERA
// ============================================

function resetCamera() {

    yaw = 0;
    pitch = 0.18;

    if (!player || !camera) return;

    camera.position.set(
        player.position.x,
        player.position.y + 3,
        player.position.z - 6
    );

    camera.setTarget(
        player.position.add(
            new BABYLON.Vector3(0, 1, 0)
        )
    );

}

canvas.addEventListener("mousemove", e => {

    if (document.pointerLockElement !== canvas) return;

    yaw += e.movementX * mouseSensitivity;

    pitch -= e.movementY * mouseSensitivity;

    pitch = Math.max(
        -0.45,
        Math.min(0.85, pitch)
    );

});

canvas.addEventListener("click", () => {

    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
    }

});

// ============================================
// KEYBOARD
// ============================================

window.addEventListener("keydown", e => {

    keys[e.key.toLowerCase()] = true;

    if (e.code === "Space") {
        keys.space = true;
    }

});

window.addEventListener("keyup", e => {

    keys[e.key.toLowerCase()] = false;

    if (e.code === "Space") {
        keys.space = false;
    }

});

// Voorkom dat de pagina scrollt tijdens spelen

window.addEventListener("keydown", e => {

    if (
        ["Space", "ArrowUp", "ArrowDown"].includes(e.code)
    ) {
        e.preventDefault();
    }

});

// ============================================
// TYCOON KNOPPEN
// ============================================


function createTycoonButton(data) {

    const btn = BABYLON.MeshBuilder.CreateCylinder(
        "tycoonButton",
        {
            diameter: 1.2,
            height: 0.12,
            tessellation: 64
        },
        scene
    );

    btn.position = BABYLON.Vector3.FromArray(
        data.pos || [0, 0, 0]
    );

    // Ook de opgeslagen draaiing en schaal herstellen
    btn.rotation = BABYLON.Vector3.FromArray(
        data.rotation || [0, 0, 0]
    );

    btn.scaling = BABYLON.Vector3.FromArray(
        data.scaling || [1, 1, 1]
    );

    btn.metadata = {
        ...data
    };

    const material = new BABYLON.StandardMaterial(
        "buttonMaterial_" + Math.random(),
        scene
    );

    material.diffuseColor =
        new BABYLON.Color3(0.15, 0.75, 0.25);

    material.emissiveColor =
        new BABYLON.Color3(0.05, 0.15, 0.05);

    btn.material = material;

    const ring = BABYLON.MeshBuilder.CreateTorus(
        "buttonRing",
        {
            diameter: 1.05,
            thickness: 0.035,
            tessellation: 64
        },
        scene
    );

    ring.parent = btn;
    ring.position.y = 0.07;

    const ringMaterial = new BABYLON.StandardMaterial(
        "ringMaterial",
        scene
    );

    ringMaterial.diffuseColor =
        new BABYLON.Color3(0.95, 0.95, 0.95);

    ring.material = ringMaterial;

    btn.metadata.bought = false;
    btn.metadata.forceShow = false;

    tycoonButtons.push(btn);

    return btn;

}

// ============================================
// OBJECTEN LADEN
// ============================================


function attachImportedModelHierarchy(root, result) {

    const importedNodes = new Set([
        ...(result.transformNodes || []),
        ...(result.meshes || [])
    ]);

    importedNodes.forEach(node => {

        if (!node.parent || !importedNodes.has(node.parent)) {
            node.parent = root;
        }

    });

}


async function loadButtonAssets() {

    for (const button of tycoonButtons) {

        const objects = button.metadata.objects || [];

        for (const obj of objects) {

            if (!obj.fileKey) {
                console.warn(
                    "Geen fileKey gevonden voor object:",
                    obj.id
                );
                continue;
            }

            try {

                const file = await getFreeObject(obj.fileKey);

                if (!file) {
                    console.warn("Modelbestand niet gevonden:", obj.id);
                    continue;
                }

                const url = URL.createObjectURL(file);

                try {

                    const extension = "." +
                        file.name.split(".").pop().toLowerCase();

                    const result = await BABYLON.SceneLoader.ImportMeshAsync(
                        "",
                        url,
                        "",
                        scene,
                        undefined,
                        extension
                    );

                    const root = new BABYLON.TransformNode(
                        "asset_" + obj.id,
                        scene
                    );

                    // Volledige GLB-hiërarchie behouden
                    attachImportedModelHierarchy(root, result);

                    root.setEnabled(false);

                    objectLibrary[obj.id] = {
                        mesh: root,
                        animationGroups: result.animationGroups || []
                    };

                } finally {

                    URL.revokeObjectURL(url);

                }

            } catch (error) {

                console.error(
                    "Object kon niet geladen worden:",
                    obj.id,
                    error
                );

            }

        }

    }

}

// ============================================
// VRIJE OBJECTEN LADEN
// ============================================

async function loadFreeObjects() {

    for (const saved of projectData.freeObjects || []) {

        if (!saved.fileKey) continue;

        try {

            const file = await getFreeObject(saved.fileKey);

            if (!file) {
                console.warn("Vrij object niet gevonden:", saved.fileName);
                continue;
            }

            const url = URL.createObjectURL(file);

            try {

                const extension = "." +
                    saved.fileName.split(".").pop().toLowerCase();

                const result = await BABYLON.SceneLoader.ImportMeshAsync(
                    "",
                    url,
                    "",
                    scene,
                    undefined,
                    extension
                );

                const root = new BABYLON.TransformNode(
                    "freeObject_" + Date.now(),
                    scene
                );

                result.meshes.forEach(mesh => {

                    if (!mesh.parent) {
                        mesh.parent = root;
                    }

                });

                root.position = BABYLON.Vector3.FromArray(
                    saved.position || [0, 0, 0]
                );

                root.rotation = BABYLON.Vector3.FromArray(
                    saved.rotation || [0, 0, 0]
                );

                root.scaling = BABYLON.Vector3.FromArray(
                    saved.scaling || [1, 1, 1]
                );

            } finally {

                URL.revokeObjectURL(url);

            }

        } catch (error) {

            console.error(
                "Vrij object laden mislukt:",
                saved.fileName,
                error
            );

        }

    }

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
            0
        );

    }

    else if (transition === "from heaven") {

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
            0
        );

    }

    else if (transition === "grow") {

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
            0
        );

    }

}

// ============================================
// PRIORITY SYSTEEM
// ============================================

function showCurrentPriority() {

    tycoonButtons.forEach(btn => {

        const show =
            !btn.metadata.bought &&
            (
                Number(btn.metadata.priority || 0) === currentPriority ||
                btn.metadata.forceShow
            );

        btn.setEnabled(show);

        btn.metadata.forceShow = false;

    });

    updateButtonColors();

}

// ============================================
// BUTTON KLEUREN
// ============================================

function updateButtonColors() {

    tycoonButtons.forEach(btn => {

        if (btn.metadata.bought) {
            btn.setEnabled(false);
            return;
        }

        const canAfford =
            money >= Number(btn.metadata.price || 0);

        btn.material.diffuseColor = canAfford
            ? new BABYLON.Color3(0.15, 0.75, 0.2)
            : new BABYLON.Color3(0.85, 0.15, 0.15);

    });

}

// ============================================
// KOPEN
// ============================================


function tryBuy(button) {

    if (!button || button.metadata.bought) return;

    const price = Math.max(
        0,
        Number(button.metadata.price) || 0
    );

    if (money < price) return;

    money -= price;

    button.metadata.bought = true;
    button.setEnabled(false);

    // Priority activator
    if (button.metadata.isPriorityActivator) {

        const target = parseInt(
            button.metadata.activatorTarget
        );

        if (!isNaN(target)) {

            const oldPriority = currentPriority;

            currentPriority = target;
            showCurrentPriority();
            currentPriority = oldPriority;

        }

    }

    // ID activator
    if (
        button.metadata.isIDActivator &&
        button.metadata.activatorTarget
    ) {

        const targetButton = tycoonButtons.find(btn =>
            btn.metadata.buttonID ===
            button.metadata.activatorTarget
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

        if (!asset || !asset.mesh) return;

        const clone = asset.mesh.clone(
            "spawn_" + Date.now() + "_" + index
        );

        if (!clone) return;

        button.computeWorldMatrix(true);

        const p = obj.pos || { x: 0, y: 0, z: 0 };

        if (obj.positionSpace === "button-local") {

            clone.position = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(p.x, p.y, p.z),
                button.getWorldMatrix()
            );

        } else {

            // Oude opgeslagen posities behouden
            clone.position = button.getAbsolutePosition().add(
                new BABYLON.Vector3(p.x, p.y, p.z)
            );

        }

        clone.rotation = new BABYLON.Vector3(
            obj.rot?.x || 0,
            obj.rot?.y || 0,
            obj.rot?.z || 0
        );

        clone.scaling = new BABYLON.Vector3(
            obj.scale?.x ?? 1,
            obj.scale?.y ?? 1,
            obj.scale?.z ?? 1
        );

        spawnWithTransition(
            clone,
            obj.transition || "None"
        );

        // Collision aanzetten op alle meshes
        clone.getChildMeshes(false).forEach(mesh => {
            mesh.checkCollisions = true;
        });

        clone.checkCollisions = true;

        spawnedObjects.push(clone);

    });

    // Volgende priority
    const remaining = tycoonButtons.some(btn =>
        !btn.metadata.bought &&
        (
            Number(btn.metadata.priority || 0) === currentPriority ||
            btn.metadata.forceShow
        )
    );

    if (!remaining) {

        currentPriority++;

        showCurrentPriority();

    }

    updateMoneyDisplay();
    updateButtonColors();

}

// ============================================
// GELD PER SECONDE
// ============================================

function updateIncome(delta) {

    const totalIncome = tycoonButtons.reduce((total, btn) => {

        if (!btn.metadata.bought) return total;

        return total + Math.max(
            0,
            Number(btn.metadata.incomePerSecond) || 0
        );

    }, 0);

    if (totalIncome <= 0) return;

    money += totalIncome * delta;

    // Voorkom rare floating point ophoping
    money = Math.round(money * 100) / 100;

    incomeDisplayTimer += delta;

    if (incomeDisplayTimer >= 0.25) {

        incomeDisplayTimer = 0;

        updateMoneyDisplay();

        updateButtonColors();

    }

}

// ============================================
// PLAYER BEWEGING
// ============================================

function updatePlayer(delta) {

    if (!player) return;

    // Springen

    if (keys.space && isGrounded) {

        jumpVelocity = jumpPower;

        isGrounded = false;

    }

    // Zwaartekracht

    if (!isGrounded) {

        player.position.y += jumpVelocity * delta;

        jumpVelocity -= gravity * delta;

        if (player.position.y <= jumpBaseY) {

            player.position.y = jumpBaseY;

            jumpVelocity = 0;

            isGrounded = true;

        }

    }

    // Bewegen

    const speed = keys.shift ? 9 : 4.5;

    const forward = new BABYLON.Vector3(
        Math.sin(yaw),
        0,
        Math.cos(yaw)
    );

    const right = new BABYLON.Vector3(
        Math.cos(yaw),
        0,
        -Math.sin(yaw)
    );

    const movement = BABYLON.Vector3.Zero();

    if (keys.w) movement.addInPlace(forward);
    if (keys.s) movement.subtractInPlace(forward);

    if (keys.d) movement.addInPlace(right);
    if (keys.a) movement.subtractInPlace(right);

    const moving = movement.lengthSquared() > 0.0001;

    if (moving) {

        movement.normalize();

        const displacement = movement.scale(speed * delta);

        // Collision-aware movement
        player.moveWithCollisions(displacement);

        player.rotation.y = Math.atan2(
            movement.x,
            movement.z
        );

    }

    // Animaties

    if (player.animationGroups?.length) {

        const idle =
            player.animationGroups.find(a =>
                a.name.toLowerCase().includes("idle")
            ) || player.animationGroups[0];

        const walk =
            player.animationGroups.find(a =>
                a.name.toLowerCase().includes("walk")
            ) || idle;

        const target = moving ? walk : idle;

        if (currentAnim !== target) {

            player.animationGroups.forEach(a => a.stop());

            target.start(true);

            currentAnim = target;

        }

    }

    // Camera

    const horizontalDistance =
        cameraDistance * Math.cos(pitch);

    const verticalDistance =
        cameraHeight + cameraDistance * Math.sin(pitch);

    const target = player.position.add(
        new BABYLON.Vector3(0, 1, 0)
    );

    const desiredPosition = new BABYLON.Vector3(
        player.position.x -
            Math.sin(yaw) * horizontalDistance,

        player.position.y + verticalDistance,

        player.position.z -
            Math.cos(yaw) * horizontalDistance
    );

    const smoothness =
        1 - Math.pow(0.001, delta);

    camera.position = BABYLON.Vector3.Lerp(
        camera.position,
        desiredPosition,
        smoothness
    );

    camera.setTarget(target);

    // Kopen met E

    if (keys.e && !lastBuyPressed) {

        tycoonButtons.forEach(btn => {

            if (
                btn.isEnabled() &&
                BABYLON.Vector3.Distance(
                    player.position,
                    btn.position
                ) < 1.8
            ) {

                tryBuy(btn);

            }

        });

    }

    lastBuyPressed = keys.e;

}

// ============================================
// RENDER LOOP
// ============================================

function startRenderLoop() {

    engine.runRenderLoop(() => {

        if (!scene) return;

        const delta = Math.min(
            engine.getDeltaTime() / 1000,
            0.05
        );

        updatePlayer(delta);

        updateIncome(delta);

        scene.render();

    });

}

// ============================================
// PROJECT LADEN
// ============================================

async function loadProject() {

    const raw = localStorage.getItem(storageKey);

    if (!raw) {

        console.warn(
            "Geen opgeslagen project gevonden:",
            storageKey
        );

        return false;

    }

    try {

        projectData = JSON.parse(raw);

        const savedBudget = Number(projectData.moneyStart);

        money = Number.isFinite(savedBudget)
            ? Math.max(0, savedBudget)
            : 100;

        (projectData.buttons || []).forEach(data => {

            createTycoonButton(data);

        });

        updateMoneyDisplay();

        await loadButtonAssets();

        await loadFreeObjects();

        showCurrentPriority();

        console.log(
            "Play project geladen:",
            projectId
        );

        return true;

    } catch (error) {

        console.error(
            "Project laden mislukt:",
            error
        );

        return false;

    }

}

// ============================================
// TERUG NAAR EDITOR
// ============================================

exitButton.addEventListener("click", () => {

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    window.location.href =
        "../index.html?id=" +
        encodeURIComponent(projectId);

});

// ============================================
// START
// ============================================

async function startGame() {

    try {

        await createScene();

        await loadProject();

        showCurrentPriority();

        updateMoneyDisplay();

        startRenderLoop();

        console.log("TYCOON MAKER PLAY READY");

    } catch (error) {

        console.error(
            "Play Mode starten mislukt:",
            error
        );

    }

}

window.addEventListener("resize", () => {
    engine.resize();
});

canvas.tabIndex = 1;

startGame();
