/*
THOTH Plugin for ATON

author: steliosalvanos@gmail.com

===========================================================*/


let THOTH = new ATON.Flare("thoth");

THOTH.FE      = FE;
THOTH.Mat     = Mat;
THOTH.Toolbox = Toolbox;
THOTH.Utils   = Utils;
THOTH.Scene   = Scene;

/* 
Flare setup
===========================================================*/

THOTH.setup = async () => {
    THOTH._bLeftMouseDown = false;
    THOTH._bLoading = true;

    // ATON Overhead
    THOTH.ATONISREAL = true;
    if (THOTH.ATONISREAL) THOTH.ATON2THOTH();
    else THOTH.bridge();

    // Init Scene
    await THOTH.Scene.init();

    THOTH.initHistory();
    THOTH.Mat.init();
    THOTH.FE.init();
    await THOTH.Toolbox.init();

    // Annotation list
    THOTH.annotations = [];

    THOTH.sid = THOTH.Scene.sid;
    await THOTH.importAnnotations(THOTH.sid);
    THOTH.updateVisibility();
}

THOTH.update = () => {
    if (THOTH.ATONISREAL) {
        THOTH.Scene._queryData = ATON._queryDataScene;
    }
    else {
        THOTH.Scene._handleQuery();
    }
}

/* 
Ralize
===========================================================*/

THOTH.bridge = () => {
    // Placeholder function to move modules from ATON to THOTH
    THOTH._camera = ATON.Nav._camera;
    
    THOTH._mSelectorSphere = ATON.SUI._mSelectorSphere;
    
    THOTH._bRealized = ATON.FE._bRealized;
};

// Remove THOTH overhead when used with ATON 
THOTH.ATON2THOTH = () => {
    THOTH.log("Transfering functionalities from ATON");

    THOTH.Scene._renderer = ATON._renderer;
    THOTH.Scene._rcScene  = ATON._rcScene;
    THOTH._camera   = ATON.Nav._camera;

    THOTH.Scene._queryData = ATON._queryDataScene;
    
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

    if (THOTH.Utils.setsAreEqual(lastSelection, THOTH.currAnnotation.faceIndices)) {
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
    const color = THOTH.Utils.rgb2hex(r, g, b);

    return {
        idx :  idx,
        name:  name,
        color: color, 
    };
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
        description: "Nothing here yes",
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

THOTH.exportAnnotations = () => {
    THOTH.log("Exporting annotations...");

    let A = THOTH.annotations2Object(THOTH.annotations);

    
    // Patch changes
    THOTH.Scene.patchScene(A, ATON.SceneHub.MODE_ADD, () => {
        THOTH.log("Success!");
    });
};

THOTH.annotations2Object = (annotationArray) => {
    const annotationObject = {};
    annotationObject.annotations = {};

    for (let i=0; i<annotationArray.length; i++) {
        const name = annotationArray[i].name;
        const faceIndices = Array.from(annotationArray[i].faceIndices);

        // Add to annotation object
        annotationObject.annotations[name] = annotationArray[i];
        annotationObject.annotations[name].faceIndices = faceIndices;
    };
    return annotationObject;
};

THOTH.importAnnotations = async (sid, onSuccess) => {
    if (sid === undefined) return;

    THOTH.log("Importing annotations from scene: "+sid);
    
    const reqpath = ATON.PATH_RESTAPI2+"scenes/"+sid;

    return new Promise((resolve, reject) => {
        THOTH.Utils.getJSON(reqpath, (data) => {
            // Parse JSON and apply to scene
            THOTH.parseJSON(data);
    
            if (onSuccess) onSuccess();
            resolve();
        });
    });
};

THOTH.parseJSON = (data) => {
    if (data.annotations === undefined) return;

    // Convert annotations object to array and parse
    THOTH.annotations = Object.values(data.annotations);

    // Iterate through the array
    Object.keys(THOTH.annotations).forEach(i => {
        // Convert faceIndices to Sets
        THOTH.annotations[i].faceIndices = new Set(THOTH.annotations[i].faceIndices);

        // Create annotation button for each
        THOTH.FE.createNewAnnotationUI(THOTH.annotations[i]);
    });
};