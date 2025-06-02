/*
THOTH Plugin for ATON

author: steliosalvanos@gmail.com

===========================================================*/


let THOTH = new ATON.Flare("thoth");

THOTH.FE      = FE;
THOTH.Mat     = Mat;
THOTH.Toolbox = Toolbox;
THOTH.Helpers = Helpers;

/* 
Flare setup
===========================================================*/

THOTH.setup = () => {
    THOTH._bLeftMouseDown = false;

    THOTH.initBridge();
    THOTH.initEventListeners();
    THOTH.initHistory();

    THOTH.Mat.init();
    THOTH.Toolbox.init();
    THOTH.FE.init();

    // Temporary function for testing
    THOTH.testFunction();
};

THOTH.update = () => {
    THOTH.FE.update();
    THOTH._queryDataScene = ATON._queryDataScene;
    THOTH._renderer = ATON._renderer;
};

/* 
Inits
===========================================================*/

THOTH.initBridge = async () => {
    // Placeholder function to move modules from ATON to THOTH
    THOTH.log("Transfering functionalities from ATON");

    while(ATON._queryDataScene === undefined) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    THOTH.PATH_RES = ATON.PATH_RES;

    THOTH._queryDataScene = ATON._queryDataScene;
    THOTH._renderer       = ATON._renderer;
    THOTH._camera         = ATON.Nav._camera;

    THOTH._mSelectorSphere = ATON.SUI._mSelectorSphere;

    THOTH._bRealized = ATON.FE._bRealized;
};

THOTH.initEventListeners = () => {
    THOTH.on = ATON.on;
    // THOTH.fire = ATON.fire

    let el = ATON._renderer.domElement;

    // Left mouse down
    el.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            THOTH._bLeftMouseDown = true;
            THOTH.e = e;
            ATON.fire("MouseLeftButtonDown");
        }
    });
    // Left mouse up
    el.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            THOTH._bLeftMouseDown = false;
            THOTH.e = e;
            ATON.fire("MouseLeftButtonUp");
        }
    });
    // Mouse move
    el.addEventListener('mousemove', (e) => {
        THOTH.e = e;
        ATON.fire("MouseMove");
    })
};

THOTH.initHistory = () => {
    THOTH.undoStack = [];
    THOTH.redoStack = [];

    // TODO Add step limit logic
    THOTH.maxSteps = 10;
};

/* 
Utils
===========================================================*/

THOTH.getSelectorRadius = () => {
    return ATON.SUI._selectorRad;
};

THOTH.setSelectorRadius = (r) => {
    ATON.SUI._selectorRad = r;
    ATON.SUI.mainSelector.scale.set(r,r,r);
};

THOTH.setSelectorColor = (color, opacity) => {
    let matSel = ATON.MatHub.materials.selector;

    matSel.uniforms.tint.value = color;
    if (opacity !== undefined) matSel.uniforms.opacity.value = opacity;
};

THOTH.testFunction = () => {
    // THOTH.FE.uiAddButtonTest("idTopToolbar");
};

/* 
History
===========================================================*/

THOTH.recordState = () => {
    // If last selection is the same return
    let lastSelection = THOTH.undoStack[THOTH.undoStack.length -1];

    if (lastSelection === undefined) lastSelection = []; 

    if (THOTH.Helpers.setsAreEqual(lastSelection, THOTH.Toolbox.currSelection)) {
        return;
    }

    THOTH.undoStack.push(new Set(THOTH.Toolbox.currSelection));
    THOTH.redoStack = [];
};

THOTH.undo = () => {
    if (THOTH.undoStack.length === 0) {
        return;
    }
    // Save current state to redo stakck first
    THOTH.redoStack.push(new Set(THOTH.Toolbox.currSelection));

    // Restore previous state
    THOTH.Toolbox.currSelection = THOTH.undoStack.pop();
    THOTH.Toolbox.applySelectionToMesh();
};

THOTH.redo = () => {
    if (THOTH.redoStack.length === 0) return;

    // Save current state to undo stack first
    THOTH.undoStack.push(new Set(THOTH.Toolbox.currSelection));

    // Restore next state
    THOTH.Toolbox.currSelection = THOTH.redoStack.pop();
    THOTH.Toolbox.applySelectionToMesh();
};