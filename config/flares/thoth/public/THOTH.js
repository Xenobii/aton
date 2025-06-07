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

THOTH.createNewAnnotation = (newAnnotationName) => {
    if (!newAnnotationName) newAnnotationName = "Untitled Annotation";

    // Default annotation params
    const newAnnotation = {
        name: newAnnotationName,
        visible: true,
        highlightColor: "#FFFFFF",
        faceIndices: new Set(),
        description: undefined,
        numberOfFaces: 0,
    };

    // Create annotation folder 
    THOTH.FE.createNewAnnotationUI(newAnnotation);
    
    // Add to annotation array
    THOTH.annotations.push(newAnnotation);
};

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