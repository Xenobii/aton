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
    THOTH.FE.init();
    THOTH.Toolbox.init();

    // List all completed annotations
    THOTH.annotations = [];

    // Selected annotation
    THOTH.currAnnotation = {
        name: undefined,
        visible: true,
        highlightColor: "#FFFFFF",
        faceIndices: new Set(),
        description: undefined
    };
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

/* 
History
===========================================================*/

THOTH.recordState = () => {
    // If last selection is the same return
    let lastSelection = THOTH.undoStack[THOTH.undoStack.length -1];

    if (lastSelection === undefined) lastSelection = []; 

    if (THOTH.Helpers.setsAreEqual(lastSelection, THOTH.currAnnotation.faceIndices)) {
        return;
    }

    THOTH.undoStack.push(new Set(THOTH.currAnnotation.faceIndices));
    THOTH.redoStack = [];
};

THOTH.undo = () => {
    if (THOTH.undoStack.length === 0) {
        return;
    }
    // Save current state to redo stack first
    THOTH.redoStack.push(new Set(THOTH.currAnnotation.faceIndices));

    // Restore previous state
    THOTH.currAnnotation.faceIndices = THOTH.undoStack.pop();
    THOTH.Toolbox.highlightVisibleSelections();
};

THOTH.redo = () => {
    if (THOTH.redoStack.length === 0) return;

    // Save current state to undo stack first
    THOTH.undoStack.push(new Set(THOTH.currAnnotation.faceIndices));

    // Restore next state
    THOTH.currAnnotation.faceIndices = THOTH.redoStack.pop();
    THOTH.Toolbox.highlightVisibleSelections();
};

/* 
Annotation Management
===========================================================*/

THOTH.createAnnotation = () => {
    // const currAnnotation = {
    //     name: undefined,
    //     visible: true,
    //     highlightColor: "#FFFFFF",
    //     faceIndices: undefined,
    //     description: undefined
    // };

    THOTH.annotations.push(THOTH.currAnnotation);
    
    THOTH.FE.createAnnotationFolder(THOTH.annotations[0]);
};

// TODO DEBUG TOMORROW

THOTH.editAnnotationName = (annotation, newName) => {
    // Edit annotation folder name ???
    annotation.name = newName;
};

THOTH.toggleVisibility = (annotation, isVisible) => {
    // TODO: change currselection to be annotation.faceIndices
    annotation.visible = isVisible;
    THOTH.Toolbox.highlightVisibleSelections(THOTH.annotations);
}

THOTH.editSelection = (annotation) => {
    THOTH.FE._actState = THOTH.FE.SELACTION_EDIT;
    THOTH.FE._tool = undefined
    
    THOTH.FE.uiSetAnnotatorMode();
    
    if (annotation.faceIndices !== undefined) {
        THOTH.currAnnotation.faceIndices = annotation.faceIndices;
    };
};

THOTH.applyAnnotation = (annotation) => {
    if (THOTH.currAnnotation.faceIndices.length === 0) {
        console.warn("There are no selected faces to ba applied");
        THOTH.FE._actState = THOTH.FE.SELACTION_STD;
        return;
    }
    
    THOTH.FE._actState = THOTH.FE.SELACTION_STD;
    
    THOTH.FE.disableTools();
    THOTH.FE.uiSetDefaultMode();
    
    ATON.Nav.setUserControl(true);
    
    // Push current selection to this annotation
    console.log(annotation.faceIndices)

    THOTH.currAnnotation.faceIndices.forEach(faceIndex => {
        annotation.faceIndices.add(faceIndex)
    });
    
    // Clear current selection
    THOTH.currAnnotation.faceIndices = new Set();
    
    console.log("Applied selection for", annotation.name);
    console.log(annotation.faceIndices)
};

THOTH.deleteAnnotation = (annotation) => {
    // THOTH.FE._actState = THOTH.FE.SELACTION_STD;

    // Delete folder
    THOTH.FE.annotationFolder.removeFolder(annotation.name);

    // Remove from annotation array
    const index = THOTH.annotations.indexOf(annotation)
    THOTH.annotations.splice(index, l);

    // Update visuals
    THOTH.Toolbox.highlightVisibleSelections();

    console.log("Deleted annotation", annotation.name);
};