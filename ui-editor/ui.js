
// ============================================================
// TYCOON MAKER - UI EDITOR
// Volledige versie: editor, eigenschappen, slepen, schalen,
// opslaan, laden, acties en tekstinstellingen.
// ============================================================

// ------------------------------------------------------------
// PROJECT- EN UI-ID
// ------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const projectId = params.get("id") || "default";
const storageKey = "tycoon_ui_menus_" + projectId;

// Een nieuwe UI krijgt één vaste ID.
let menuId = params.get("menuId");

function makeId(prefix) {
    const unique = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${unique}`;
}

if (!menuId) {
    menuId = makeId("ui");
    const stableUrl = new URL(window.location.href);
    stableUrl.searchParams.set("menuId", menuId);
    window.history.replaceState(window.history.state, "", stableUrl.href);
}

// ------------------------------------------------------------
// HTML-ELEMENTEN
// ------------------------------------------------------------

const workspace = document.getElementById("workspace");
const cubeTool = document.getElementById("cube-tool");
const buttonTool = document.getElementById("button-tool");
const textTool = document.getElementById("text-tool");

const emptySelection = document.getElementById("empty-selection");
const properties = document.getElementById("properties");

const widthInput = document.getElementById("width-input");
const heightInput = document.getElementById("height-input");
const xInput = document.getElementById("x-input");
const yInput = document.getElementById("y-input");
const radiusInput = document.getElementById("radius-input");
const colorInput = document.getElementById("color-input");
const zIndexInput = document.getElementById("element-zindex");

const alignXButton = document.getElementById("align-x");
const alignYButton = document.getElementById("align-y");
const deleteButton = document.getElementById("delete-element");
const backButton = document.getElementById("back-button");

const uiNameInput = document.getElementById("ui-name");
const shortcutInput = document.getElementById("ui-shortcut");
const saveStatus = document.getElementById("save-status");

const buttonProperties = document.getElementById("button-properties");
const actionType = document.getElementById("action-type");
const moneyProperty = document.getElementById("money-property");
const moneyAmount = document.getElementById("money-amount");
const buttonText = document.getElementById("button-text");

const textProperties = document.getElementById("text-properties");
const textContentInput = document.getElementById("text-content");
const textColorInput = document.getElementById("text-color");
const textSizeInput = document.getElementById("text-size");

const requiredElements = [
    workspace, cubeTool, buttonTool, textTool,
    emptySelection, properties,
    widthInput, heightInput, xInput, yInput,
    radiusInput, colorInput, zIndexInput,
    alignXButton, alignYButton, deleteButton, backButton,
    uiNameInput, shortcutInput, saveStatus,
    buttonProperties, actionType, moneyProperty,
    moneyAmount, buttonText,
    textProperties, textContentInput, textColorInput, textSizeInput
];

if (requiredElements.some(element => !element)) {
    throw new Error(
        "UI Editor: een of meer HTML-elementen ontbreken. " +
        "Controleer of ui.html bij deze ui.js hoort."
    );
}

// ------------------------------------------------------------
// EDITOR-STATUS
// ------------------------------------------------------------

let selectedObject = null;
let objectCount = 0;
let elements = [];

// ------------------------------------------------------------
// OPSLAGFUNCTIES
// ------------------------------------------------------------

function readSavedMenus() {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("UI-menu's konden niet worden gelezen:", error);
        saveStatus.textContent = "Opslag lezen mislukt";
        return [];
    }
}

function isValidElementType(type) {
    return type === "cube" || type === "button" || type === "text";
}

// Herstel alleen oude elementtypes die betrouwbaar herkenbaar zijn.
function repairLegacyElementType(data) {
    if (isValidElementType(data.type) && data.type !== "button") {
        return data.type;
    }

    if (data.type !== "button") return "cube";

    const text = String(data.text ?? "");
    const color = String(data.color ?? "").toLowerCase();
    const width = Number(data.width);
    const height = Number(data.height);

    if (color === "transparent") return "text";
    if (text === "Nieuwe tekst" && width === 180 && height === 50) return "text";
    if (!text.trim() && width === 100 && height === 100) return "cube";

    return "button";
}

function loadUI() {
    const menus = readSavedMenus();
    const menu = menus.find(item => String(item.id) === String(menuId));

    if (!menu) {
        elements = [];
        uiNameInput.value = "Nieuwe UI";
        shortcutInput.value = "";
        setSelection(null);
        saveStatus.textContent = "Nieuwe UI";
        return;
    }

    uiNameInput.value = menu.name || "Nieuwe UI";
    shortcutInput.value = String(menu.shortcut || "").slice(0, 1).toLowerCase();

    const sourceElements = Array.isArray(menu.elements) ? menu.elements : [];
    const usedIds = new Set();
    let repaired = false;

    elements = sourceElements.map(saved => {
        const data = { ...saved };

        const repairedType = repairLegacyElementType(data);
        if (data.type !== repairedType) {
            data.type = repairedType;
            repaired = true;
        }

        let id = data.id == null ? "" : String(data.id);
        if (!id || usedIds.has(id)) {
            id = makeId("element");
            data.id = id;
            repaired = true;
        }
        usedIds.add(id);

        data.x = Number(data.x) || 0;
        data.y = Number(data.y) || 0;
        data.width = Math.max(10, Number(data.width) || 100);
        data.height = Math.max(10, Number(data.height) || 100);
        data.zIndex = Number(data.zIndex ?? 0);
        data.radius = Math.max(0, Number(data.radius) || 0);

        if (data.color == null || data.color === "") {
            data.color = data.type === "text" ? "transparent" : "#4287f5";
            repaired = true;
        }

        if (data.textColor == null) data.textColor = "#ffffff";
        if (data.fontSize == null) data.fontSize = 24;
        if (data.action == null) data.action = "none";
        if (data.amount == null) data.amount = 100;

        return data;
    });

    objectCount = elements.length;
    elements.forEach(data => createElementFromData(data, false));

    setSelection(null);

    if (repaired) {
        saveUI({ preserveShortcut: true });
    }

    saveStatus.textContent = "Geladen";
}

function saveUI() {
    const menus = readSavedMenus();
    const existingIndex = menus.findIndex(
        item => String(item.id) === String(menuId)
    );
    const previousMenu = existingIndex >= 0 ? menus[existingIndex] : null;

    let shortcut = String(shortcutInput.value || "")
        .trim()
        .slice(0, 1)
        .toLowerCase();

    let warning = "";
    const forbidden = ["w", "a", "s", "d", " "];

    if (shortcut && forbidden.includes(shortcut)) {
        shortcut = previousMenu?.shortcut || "";
        shortcutInput.value = shortcut;
        warning = "Deze toets is verboden!";
    }

    const duplicate = shortcut && menus.find(item =>
        String(item.id) !== String(menuId) &&
        item.shortcut &&
        String(item.shortcut).toLowerCase() === shortcut
    );

    if (duplicate) {
        shortcut = previousMenu?.shortcut || "";
        shortcutInput.value = shortcut;
        warning = "Shortcut al in gebruik!";
    }

    const menuData = {
        ...(previousMenu || {}),
        id: String(menuId),
        name: uiNameInput.value.trim() || "Nieuwe UI",
        shortcut,
        elements: elements.map(element => ({ ...element }))
    };

    if (existingIndex >= 0) {
        menus[existingIndex] = menuData;
    } else {
        menus.push(menuData);
    }

    try {
        localStorage.setItem(storageKey, JSON.stringify(menus));
        saveStatus.textContent = warning || "Opgeslagen";
        return true;
    } catch (error) {
        console.error("UI opslaan mislukt:", error);
        saveStatus.textContent = "Opslaan mislukt!";
        return false;
    }
}

// ------------------------------------------------------------
// UI-NAAM, SHORTCUT EN TERUGKNOP
// ------------------------------------------------------------

uiNameInput.addEventListener("input", () => saveUI());

shortcutInput.addEventListener("input", () => {
    shortcutInput.value = shortcutInput.value.slice(0, 1).toLowerCase();
    saveUI();
});

backButton.addEventListener("click", () => {
    saveUI();

    const url = new URL("../index.html", window.location.href);
    url.searchParams.set("id", projectId);
    window.location.href = url.href;
});

// ------------------------------------------------------------
// SLEPEN VAN GEREEDSCHAPJES
// ------------------------------------------------------------

[cubeTool, buttonTool, textTool].forEach(tool => {
    tool.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", tool.id);
    });
});

workspace.addEventListener("dragover", event => event.preventDefault());

workspace.addEventListener("drop", event => {
    event.preventDefault();

    const toolType = event.dataTransfer.getData("text/plain");
    if (![
        "cube-tool",
        "button-tool",
        "text-tool"
    ].includes(toolType)) return;

    const rect = workspace.getBoundingClientRect();

    let type = "cube";
    if (toolType === "button-tool") type = "button";
    if (toolType === "text-tool") type = "text";

    const width = type === "text" ? 180 : type === "button" ? 130 : 100;
    const height = type === "text" ? 50 : type === "button" ? 45 : 100;

    const data = {
        id: makeId("element"),
        type,
        x: Math.max(0, event.clientX - rect.left - width / 2),
        y: Math.max(0, event.clientY - rect.top - height / 2),
        width,
        height,
        zIndex: 0,
        radius: 3,
        color: type === "text" ? "transparent" : "#4287f5",
        textColor: "#ffffff",
        fontSize: 24,
        text: type === "text" ? "Nieuwe tekst" : type === "button" ? "Button" : "",
        action: "none",
        amount: 100
    };

    elements.push(data);
    createElementFromData(data, true);
    saveUI();
});

// ------------------------------------------------------------
// ELEMENT LABELS - houdt de resize-handles intact
// ------------------------------------------------------------

function setElementLabel(element, text) {
    let label = element.querySelector(":scope > .ui-element-label");

    if (!label) {
        label = document.createElement("span");
        label.className = "ui-element-label";
        label.style.pointerEvents = "none";
        element.insertBefore(label, element.querySelector(":scope > .handle"));
    }

    label.textContent = text;
}

// ------------------------------------------------------------
// ELEMENT AANMAKEN / TERUGLADEN
// ------------------------------------------------------------

function createElementFromData(data, selectAfterCreate = true) {
    const type = isValidElementType(data.type) ? data.type : "cube";
    data.type = type;

    if (!data.id) data.id = makeId("element");

    const element = document.createElement(type === "button" ? "button" : "div");
    element.className = "ui-object";
    element.dataset.id = String(data.id);
    element.dataset.type = type;

    if (type === "button") {
        element.type = "button";
        element.classList.add("ui-button-element");
        setElementLabel(element, data.text || "Button");
    } else if (type === "text") {
        element.classList.add("ui-text-element");
        setElementLabel(element, data.text || "Nieuwe tekst");
    } else {
        element.classList.add("ui-cube-element");
    }

    element.style.left = (Number(data.x) || 0) + "px";
    element.style.top = (Number(data.y) || 0) + "px";
    element.style.zIndex = Number(data.zIndex ?? 0);
    element.style.width = Math.max(10, Number(data.width) || 100) + "px";
    element.style.height = Math.max(10, Number(data.height) || 100) + "px";
    element.style.borderRadius = Math.max(0, Number(data.radius) || 0) + "px";

    // Herstel de achtergrondkleur voor alle elementen.
    element.style.backgroundColor = data.color || (
        type === "text" ? "transparent" : "#4287f5"
    );

    if (type === "text") {
        element.style.color = data.textColor || "#ffffff";
        element.style.fontSize = (Number(data.fontSize) || 24) + "px";
        element.style.display = "flex";
        element.style.alignItems = "center";
        element.style.justifyContent = "center";
        element.style.whiteSpace = "pre-wrap";
    }

    ["tl", "tr", "bl", "br"].forEach(position => {
        const handle = document.createElement("div");
        handle.className = "handle " + position;
        handle.dataset.handle = position;
        element.appendChild(handle);
    });

    workspace.appendChild(element);

    element.addEventListener("pointerdown", event => {
        if (event.target.classList.contains("handle")) {
            startResize(event, element, event.target.dataset.handle);
        } else {
            startMove(event, element);
        }
    });

    if (selectAfterCreate) selectObject(element);
    return element;
}

// ------------------------------------------------------------
// ELEMENTDATA EN SELECTIE
// ------------------------------------------------------------

function getElementData(element) {
    if (!element) return null;
    return elements.find(item => String(item.id) === String(element.dataset.id)) || null;
}

function setPanelHidden(panel, shouldHide) {
    if (!panel) return;

    panel.hidden = Boolean(shouldHide);

    if (shouldHide) {
        panel.setAttribute("hidden", "");
        panel.style.setProperty("display", "none", "important");
    } else {
        panel.removeAttribute("hidden");
        panel.style.removeProperty("display");
    }
}

function setSelection(object) {
    if (selectedObject) selectedObject.classList.remove("selected");

    selectedObject = object || null;

    if (!selectedObject) {
        setPanelHidden(properties, true);
        setPanelHidden(emptySelection, false);
        setPanelHidden(buttonProperties, true);
        setPanelHidden(textProperties, true);
        setPanelHidden(moneyProperty, true);
        return;
    }

    selectedObject.classList.add("selected");
    setPanelHidden(emptySelection, true);
    setPanelHidden(properties, false);
    updateProperties();
}

function selectObject(object) {
    setSelection(object);
}

// ------------------------------------------------------------
// EIGENSCHAPPEN BIJWERKEN
// ------------------------------------------------------------

function updateProperties() {
    if (!selectedObject) {
        setSelection(null);
        return;
    }

    const data = getElementData(selectedObject);
    if (!data) {
        setSelection(null);
        return;
    }

    widthInput.value = selectedObject.offsetWidth;
    heightInput.value = selectedObject.offsetHeight;
    xInput.value = selectedObject.offsetLeft;
    yInput.value = selectedObject.offsetTop;
    zIndexInput.value = data.zIndex ?? 0;
    radiusInput.value = data.radius ?? 0;

    // Een kleurveld kan geen 'transparent' tonen.
    colorInput.value = /^#[0-9a-f]{6}$/i.test(String(data.color || ""))
        ? data.color
        : "#242424";

    const type = selectedObject.dataset.type || data.type || "cube";
    const isButton = type === "button";
    const isText = type === "text";

    setPanelHidden(buttonProperties, !isButton);
    setPanelHidden(textProperties, !isText);

    if (isText) {
        textContentInput.value = data.text || "";
        textColorInput.value = data.textColor || "#ffffff";
        textSizeInput.value = data.fontSize || 24;
    }

    if (isButton) {
        actionType.value = data.action || "none";
        moneyAmount.value = data.amount ?? 100;
        buttonText.value = data.text || "Button";
        setPanelHidden(moneyProperty, actionType.value !== "give-money");
    } else {
        setPanelHidden(moneyProperty, true);
    }
}

// ------------------------------------------------------------
// POSITIE / GROOTTE / Z-INDEX
// ------------------------------------------------------------

zIndexInput.addEventListener("input", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data) return;

    data.zIndex = Number(zIndexInput.value) || 0;
    selectedObject.style.zIndex = String(data.zIndex);
    saveUI();
});

function applyProperties() {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data) return;

    data.width = Math.max(10, Number(widthInput.value) || 10);
    data.height = Math.max(10, Number(heightInput.value) || 10);
    data.x = Math.max(0, Number(xInput.value) || 0);
    data.y = Math.max(0, Number(yInput.value) || 0);

    selectedObject.style.width = data.width + "px";
    selectedObject.style.height = data.height + "px";
    selectedObject.style.left = data.x + "px";
    selectedObject.style.top = data.y + "px";

    saveUI();
    updateProperties();
}

[widthInput, heightInput, xInput, yInput].forEach(input => {
    input.addEventListener("input", applyProperties);
});

// ------------------------------------------------------------
// BORDER RADIUS EN ACHTERGRONDKLEUR
// ------------------------------------------------------------

radiusInput.addEventListener("input", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data) return;

    data.radius = Math.max(0, Number(radiusInput.value) || 0);
    selectedObject.style.borderRadius = data.radius + "px";
    saveUI();
});

colorInput.addEventListener("input", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data) return;

    // Dit is ook de ACHTERGRONDKLEUR van normale tekst.
    data.color = colorInput.value;
    selectedObject.style.backgroundColor = data.color;
    saveUI();
});

// ------------------------------------------------------------
// KNOPACTIES
// ------------------------------------------------------------

actionType.addEventListener("change", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data || data.type !== "button") {
        actionType.value = "none";
        return;
    }

    data.action = actionType.value;
    setPanelHidden(moneyProperty, data.action !== "give-money");
    saveUI();
});

moneyAmount.addEventListener("input", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data || data.type !== "button") return;

    data.amount = Math.max(0, Number(moneyAmount.value) || 0);
    saveUI();
});

buttonText.addEventListener("input", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data || data.type !== "button") return;

    data.text = buttonText.value;
    setElementLabel(selectedObject, data.text);
    saveUI();
});

// ------------------------------------------------------------
// NORMALE TEKST-INSTELLINGEN
// ------------------------------------------------------------

textContentInput.addEventListener("input", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data || data.type !== "text") return;

    data.text = textContentInput.value;
    setElementLabel(selectedObject, data.text);
    saveUI();
});

textColorInput.addEventListener("input", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data || data.type !== "text") return;

    data.textColor = textColorInput.value;
    selectedObject.style.color = data.textColor;
    saveUI();
});

textSizeInput.addEventListener("input", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data || data.type !== "text") return;

    data.fontSize = Math.max(1, Math.min(200, Number(textSizeInput.value) || 1));
    selectedObject.style.fontSize = data.fontSize + "px";
    saveUI();
});

// ------------------------------------------------------------
// UITLIJNEN
// ------------------------------------------------------------

alignXButton.addEventListener("click", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data) return;

    data.x = Math.max(0, (workspace.clientWidth - selectedObject.offsetWidth) / 2);
    selectedObject.style.left = data.x + "px";

    updateProperties();
    saveUI();
});

alignYButton.addEventListener("click", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data) return;

    data.y = Math.max(0, (workspace.clientHeight - selectedObject.offsetHeight) / 2);
    selectedObject.style.top = data.y + "px";

    updateProperties();
    saveUI();
});

// ------------------------------------------------------------
// ELEMENT VERPLAATSEN
// ------------------------------------------------------------

function startMove(event, object) {
    if (event.button !== 0) return;

    event.preventDefault();
    selectObject(object);

    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = object.offsetLeft;
    const originalY = object.offsetTop;

    function move(moveEvent) {
        const data = getElementData(object);
        if (!data) return;

        const wantedX = originalX + moveEvent.clientX - startX;
        const wantedY = originalY + moveEvent.clientY - startY;

        const maxX = Math.max(0, workspace.clientWidth - object.offsetWidth);
        const maxY = Math.max(0, workspace.clientHeight - object.offsetHeight);

        data.x = Math.max(0, Math.min(maxX, wantedX));
        data.y = Math.max(0, Math.min(maxY, wantedY));

        object.style.left = data.x + "px";
        object.style.top = data.y + "px";
        updateProperties();
    }

    function stop() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        saveUI();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
}

// ------------------------------------------------------------
// ELEMENT SCHALEN
// ------------------------------------------------------------

function startResize(event, object, handle) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    selectObject(object);

    const data = getElementData(object);
    if (!data) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = object.offsetLeft;
    const originalY = object.offsetTop;
    const originalWidth = object.offsetWidth;
    const originalHeight = object.offsetHeight;

    function resize(moveEvent) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        let x = originalX;
        let y = originalY;
        let width = originalWidth;
        let height = originalHeight;

        if (handle.includes("r")) width += dx;
        if (handle.includes("b")) height += dy;

        if (handle.includes("l")) {
            width -= dx;
            x += dx;
        }

        if (handle.includes("t")) {
            height -= dy;
            y += dy;
        }

        if (width < 10) {
            if (handle.includes("l")) {
                x = originalX + originalWidth - 10;
            }
            width = 10;
        }

        if (height < 10) {
            if (handle.includes("t")) {
                y = originalY + originalHeight - 10;
            }
            height = 10;
        }

        x = Math.max(0, x);
        y = Math.max(0, y);
        width = Math.max(10, Math.min(width, workspace.clientWidth - x));
        height = Math.max(10, Math.min(height, workspace.clientHeight - y));

        data.x = x;
        data.y = y;
        data.width = width;
        data.height = height;

        object.style.left = x + "px";
        object.style.top = y + "px";
        object.style.width = width + "px";
        object.style.height = height + "px";

        updateProperties();
    }

    function stop() {
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        saveUI();
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
}

// ------------------------------------------------------------
// ELEMENT VERWIJDEREN
// ------------------------------------------------------------

deleteButton.addEventListener("click", () => {
    if (!selectedObject) return;

    const data = getElementData(selectedObject);
    if (!data) return;

    elements = elements.filter(
        item => String(item.id) !== String(data.id)
    );

    selectedObject.remove();
    selectedObject = null;

    setSelection(null);
    saveUI();
});

// Klik op de lege workspace om selectie te wissen.
workspace.addEventListener("pointerdown", event => {
    if (event.target !== workspace) return;
    setSelection(null);
});

// ------------------------------------------------------------
// VEILIG OPSLAAN BIJ PAGINA VERLATEN
// ------------------------------------------------------------

window.addEventListener("beforeunload", () => {
    saveUI();
});

// ------------------------------------------------------------
// UI LADEN - altijd als laatste uitvoeren
// ------------------------------------------------------------

loadUI();
