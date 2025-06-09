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
    
    THOTH.realize();

    // Bridge gaps between ATON and THOTH
    THOTH.ATONISREAL = false;
    if (THOTH.ATONISREAL) THOTH.ATON2THOTH();
    else THOTH.bridge();

    // THOTH.initEventListeners();
    THOTH.initHistory();
    
    THOTH.FE.init();
    THOTH.Mat.init();
    THOTH.Toolbox.init();

    // List all completed annotations
    THOTH.annotations = [];
};

THOTH.update = () => {
    // Update querying
    if (FE.ATONISREAL) {
        THOTH._queryDataScene = ATON._queryDataScene;
    }
    else {
        THOTH._handleQueryScene();
    }
};

/* 
Ralize
===========================================================*/

THOTH.realize = () => {
    const wglopts = {
        atnialias: true,
        alpha: true,
    };

    // Renderer
    THOTH._renderer = new THREE.WebGLRenderer(wglopts);
    THOTH._renderer.setSize(window.innerWidth, window.innerHeight);

    // Raycaster
    THOTH._rcScene = new THREE.Raycaster();
    THOTH._rcScene.layers.set(ATON.NTYPES.SCENE);
    THOTH._rcScene.firstHitOnly = true;

    // Querying
    THOTH._handleQueryScene();
};

THOTH._handleQueryScene = () => {
    THOTH._hitsScene = [];
    
    THOTH._rcScene.setFromCamera(ATON._screenPointerCoords, ATON.Nav._camera);
    THOTH._rcScene.intersectObjects(ATON._mainRoot.children, true, THOTH._hitsScene);

    // Process hits
    const hitsnum = THOTH._hitsScene.length;
    if (hitsnum <= 0){
        ATON._queryDataScene = undefined;
        return;
    }

    const h = THOTH._hitsScene[0];
    
    THOTH._queryDataScene = {};
    THOTH._queryDataScene.p  = h.point;
    THOTH._queryDataScene.d  = h.distance;
    THOTH._queryDataScene.o  = h.object;
    THOTH._queryDataScene.uv = h.uv;

    // Compute boundsTree if not computed
    if (!THOTH._queryDataScene.o.geometry.boundsTree) {
        THOTH._queryDataScene.o.geometry.computeBoundsTree();
        THOTH.log("Computed visible BVH");
    }
    
    // Normals
    // if (!THOTH._bQueryNormals) return;
    // if (!h.face) return;
    // if (!h.face.normal) return;

    // THOTH._queryDataScene.matrixWorld = new THREE.Matrix3().getNormalMatrix( h.object.matrixWorld );
    // THOTH._queryDataScene.n = h.face.normal.clone().applyMatrix3( THOTH._queryDataScene.matrixWorld ).normalize();
};

THOTH.bridge = () => {
    // Placeholder function to move modules from ATON to THOTH
    THOTH._camera = ATON.Nav._camera;
    
    THOTH._mSelectorSphere = ATON.SUI._mSelectorSphere;
    
    THOTH._bRealized = ATON.FE._bRealized;
};

// Remove THOTH overhead when used with ATON 
THOTH.ATON2THOTH = () => {
    THOTH.log("Transfering functionalities from ATON");

    THOTH._renderer = ATON._renderer;
    THOTH._rcScene  = ATON._rcScene;
    THOTH._camera   = ATON.Nav._camera;

    THOTH._queryDataScene = ATON._queryDataScene;
    
    THOTH._mSelectorSphere = ATON.SUI._mSelectorSphere;
    
    THOTH._bRealized = ATON.FE._bRealized;
};

/* 
Inits
===========================================================*/

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

THOTH.createNewAnnotationParams = () => {
    let idx = undefined;
    
    // Determine the index at which to place annotation
    for (let i=0; i<THOTH.annotations.length + 1; i++) {
        // Otherwise place new Annotation at the end of the array
        if (THOTH.annotations[i] === undefined) {
            idx = i + 1;
            break;
        };
        // Check if annotation was removed at index i 
        // If yes, create index there
        if (THOTH.annotations[i].index !== i + 1) {
            idx = i + 1;
            break;
        };
    };

    // Create name based on index
    const name = `Annotation ${idx}`;
    
    // Create a rotating color for clarity
    const r = parseInt(255 * Math.sin(idx * Math.PI/4)/2 + 128);
    const g = parseInt(255 * Math.sin(idx * Math.PI/4 + 2* Math.PI/3)/2 + 128);
    const b = parseInt(255 * Math.sin(idx * Math.PI/4 - 2* Math.PI/3)/2 + 128);
    const color = THOTH.rgbToHex(r, g, b);

    return {
        idx :  idx,
        name:  name,
        color: color, 
    };
};

THOTH.rgbToHex = (r, g, b) => {
    componentToHex = (c) => {
        var hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

THOTH.createNewAnnotation = () => {
    // Defined annotation index for convenience
    const newAnnotationParams = THOTH.createNewAnnotationParams();

    THOTH.log("Created new Annotation: " + newAnnotationParams.name);
    
    // Default annotation params
    const newAnnotation = {
        index: newAnnotationParams.idx,
        name: newAnnotationParams.name,
        visible: true,
        highlightColor: newAnnotationParams.color,
        faceIndices: new Set(),
        description: undefined,
        numberOfFaces: 0,
    };

    // Create annotation folder 
    THOTH.FE.createNewAnnotationUI(newAnnotation);
    
    // Add to annotation array
    THOTH.annotations.splice(newAnnotation.index - 1, 0, newAnnotation);
};

THOTH.deleteAnnotation = (annotationParams) => {
    THOTH.log("Removing " + annotationParams.name + " with index " + annotationParams.index);

    // Find corresponding index in arrays
    let idx = undefined;
    for (let i=0; i<THOTH.annotations.length; i++) {
        if (annotationParams.index === THOTH.annotations[i].index)
        {
            idx = i;
            break;
        }
    };

    // Remove buttons
    THOTH.FE.annotationButtons[idx].dispose();
    THOTH.FE.annotationButtons.splice(idx, 1);
    // THOTH.FE.annotationButtons[annotationParams.index - 1] = undefined;
    THOTH.FE.detailTabs.dispose();

    // Remove from annotations array
    THOTH.annotations.splice(idx, 1);  

    // Update visuals
    THOTH.updateVisibility();
};

THOTH.editAnnotationName = (annotationParams) => {
    // Find corresponding index in arrays
    let idx = undefined;
    for (let i=0; i<THOTH.annotations.length; i++) {
        if (annotationParams.index === THOTH.annotations[i].index)
        {
            idx = i;
            break;
        }
    };

    // Edit buttons
    THOTH.FE.annotationButtons[idx].title = annotationParams.name;

    // annotationParams.name = newName;
};

THOTH.updateVisibility = () => {
    THOTH.Toolbox.highlightVisibleSelections(THOTH.annotations);
};

THOTH.editSelection = (annotation) => {
    THOTH.FE._actState = THOTH.FE.SELACTION_EDIT;
    THOTH.FE._tool = undefined
    
    THOTH.FE.uiSetAnnotatorMode();
    
    if (annotation.faceIndices !== undefined) {
        annotation.faceIndices.forEach(faceIndex => {
            THOTH.currAnnotation.faceIndices.add(faceIndex)
        });
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