import { THREE } from "../../../artemis-web-main/lib/libs";

/*
    ATON Annotation Factory

    author: steliosalvanos@gmail.com

===========================================================*/
const { INTERSECTED, NOT_INTERSECTED, CONTAINED } = window.ThreeMeshBVH;

let AnnotFactory = {};

AnnotFactory.FLOAT_PREC = 5;

AnnotFactory.init = async () => {
    AnnotFactory.bAnnotBuilding = false;
    
    AnnotFactory.annotNode     = undefined;
    AnnotFactory.currAnnotMesh = undefined;
    
    // Brush tool state
    AnnotFactory.currSelection = new Set();    // Track selected face IDs to avoid duplicates

    await AnnotFactory.initQuerying();

    AnnotFactory.initHistory();
    
    AnnotFactory.completedAnnotations = [];
    
    // This only works with async
    AnnotFactory.STD_SEL_RAD = ATON.SUI.getSelectorRadius();
    AnnotFactory.brushRadius = AnnotFactory.STD_SEL_RAD;

    // Used colors
    AnnotFactory.highlightColor = ATON.MatHub.colors.green;
    AnnotFactory.defaultColor   = ATON.MatHub.colors.white;
    AnnotFactory.brushColor     = ATON.MatHub.colors.green;
    AnnotFactory.eraserColor    = ATON.MatHub.colors.orange;

    AnnotFactory.clearFaceHighlights();
};

AnnotFactory.initQuerying = async () => {
    // Polling for modularity 
    while (!ATON._queryDataScene?.o) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    // we only have one object in the annotation scene
    AnnotFactory.mainMesh     = ATON._queryDataScene.o;
    AnnotFactory.mainGeometry = AnnotFactory.mainMesh.geometry;

    AnnotFactory.mainMesh.material.vertexColors = true;
    AnnotFactory.mainMesh.material.needsUpdate  = true;

    if (!AnnotFactory.mainGeometry.attributes.color) {
        // Initialize vertex colors if they don't exist
        console.log("Initializing color");
        const colorArray = new Float32Array(AnnotFactory.mainGeometry.attributes.position.count * 3);
        colorArray.fill(AnnotFactory.defaultColor); // Default white color
        const colorAttr = new THREE.BufferAttribute(colorArray, 3);
        AnnotFactory.mainGeometry.setAttribute('color', colorAttr);
    }

};

// Utils
// =======================================================

/**
Extract Data from a specific face
@returns {[Int, [Vector3], [Vector3]]} - Face id, indicies and vertices
*/
AnnotFactory.extractFaceData = (faceIndex, geometry) => {
    if (!geometry) geometry = AnnotFactory.mainGeometry;

    let face = { index: faceIndex, vertices: [] };

    if (geometry.index) {
        let indices   = geometry.index.array;
        let positions = geometry.attributes.position.array;

        let a = indices[faceIndex * 3];
        let b = indices[faceIndex * 3 + 1];
        let c = indices[faceIndex * 3 + 2];

        face.vertices = [
            new THREE.Vector3(
                positions[a * 3],
                positions[a * 3 + 1],
                positions[a * 3 + 2]
            ),
            new THREE.Vector3(
                positions[b * 3],
                positions[b * 3 + 1],
                positions[b * 3 + 2]
            ),
            new THREE.Vector3(
                positions[c * 3],
                positions[c * 3 + 1],
                positions[c * 3 + 2]
            )
        ];
    }
    else {
        let positions = geometry.attributes.position.array;
        let idx       = faceIndex * 9;

        face.vertices = [
            new THREE.Vector3(
                positions[idx],
                positions[idx + 1],
                positions[idx + 2]
            ),
            new THREE.Vector3(
                positions[idx + 3],
                positions[idx + 4],
                positions[idx + 5]
            ),
            new THREE.Vector3(
                positions[idx + 6],
                positions[idx + 7],
                positions[idx + 8]
            )
        ];
    }

    ATON.Utils.setVectorPrecision(face.vertices[0], AnnotFactory.FLOAT_PREC);
    ATON.Utils.setVectorPrecision(face.vertices[1], AnnotFactory.FLOAT_PREC);
    ATON.Utils.setVectorPrecision(face.vertices[2], AnnotFactory.FLOAT_PREC);

    return face;
};

/**
Cancel current annot semantic shape, if building one
*/
AnnotFactory.stopCurrentAnnot = () => {
    if (!AnnotFactory.bAnnotBuilding) return;
    // complete
};

/**
Return true if currently building a convex annotation shape
@returns {boolean}
*/
AnnotFactory.isBuildingAnnot = () => {
    // if (AnnotFactory.annotGroup.children.length > 0) return true;
    // placeholder HUGE BRAIN 5HEAD 9000 IQ LOGIC
    return true;
};

AnnotFactory.setsAreEqual = (a, b) => {
    if (a.size !== b.size) return false;
    // Statistically overkill 
    // for (const item of a) if (!b.has(item)) return false;
    return true;
}

AnnotFactory.applySelectionToMesh = (mesh) =>{
    if (!mesh) mesh = AnnotFactory.mainMesh;

    mesh.material.vertexColors = true;

    AnnotFactory.clearFaceHighlights(mesh);
    
    let faces = Array.from(AnnotFactory.currSelection).map(index =>
        AnnotFactory.extractFaceData(index, mesh.geometry)
    );
    
    AnnotFactory.highlightFacesOnObject(faces, mesh);
    return;
};

// Face Selection
// ======================================================

/**
Select a single specific face of an object via ray-casting
Log the face id and defining vertices
@returns {{Int, [Vector3]}} - Face index and vertices 
*/

AnnotFactory.completeBrushAnnot = ()=>{
    AnnotFactory.bAnnotBuilding = false;

    // Unlike sompleteConvexShape, instead of a SemNode, we will
    // just save the selected faces 

    AnnotFactory.completedAnnotations.push(AnnotFactory.currSelection);

    AnnotFactory.stopCurrentAnnot();
}

/** 
Select multiple faces no the object by shapecasting a sphere
@returns {[{Int, [Vector3]}]} - Face index and vertices 
*/
AnnotFactory.selectMultipleFaces = (brushSize, mesh) => {
    if (!mesh) mesh = AnnotFactory.mainMesh;

    let hitPoint = ATON._queryDataScene.p;

    if (!hitPoint) return false;

    const geometry = mesh.geometry;
    let selectedFaces = [];
    const sphere = new THREE.Sphere();
    const inverseMatrix = new THREE.Matrix4();

    inverseMatrix.copy(mesh.matrixWorld).invert();
    sphere.center.copy(hitPoint).applyMatrix4(inverseMatrix);
    sphere.radius = brushSize;

    if (geometry.boundsTree) {
        geometry.boundsTree.shapecast({
            intersectsBounds: box => {
                const intersects = sphere.intersectsBox(box);
                if (intersects) {
                    const { min, max } = box;
                    const tempVec = new THREE.Vector3();

                    for (let x = 0; x <= 1; x++) {
                        for (let y = 0; y <= 1; y++) {
                            for (let z = 0; z <= 1; z++) {
                                tempVec.set(
                                    x === 0 ? min.x : max.x,
                                    y === 0 ? min.y : max.y,
                                    z === 0 ? min.z : max.z
                                );
                                if (!sphere.containsPoint(tempVec)) {
                                    return INTERSECTED;
                                }
                            }
                        }
                    }
                    return CONTAINED;
                }
                return intersects ? INTERSECTED : NOT_INTERSECTED;
            },
            intersectsTriangle: (tri, faceIndex, contained) => {
                if (contained || tri.intersectsSphere(sphere)) {
                    selectedFaces.push(AnnotFactory.extractFaceData(faceIndex, geometry));
                }
                return false;
            }
        });
    } else {
        console.warn("Geometry has no boundsTree, face selection will be less efficient");

        if (geometry.index) {
            const triangleCount = geometry.index.array.length / 3;
            for (let i = 0; i < triangleCount; i++) {
                const triangle = AnnotFactory.extractFaceData(i, geometry);
                const tri = new THREE.Triangle(...triangle.vertices);

                if (tri.intersectsSphere(sphere)) {
                    selectedFaces.push(triangle);
                }
            }
        }
    }

    return selectedFaces;
};

// Visualization
// =======================================================

/**
Highlight selected faces directly on the object by modifying vertex colors
@param {Object} mesh - The target mesh to highlight
@param {Array} selectedFaces - Array of face data from selectMultipleFaces()
@param {THREE.Color} color - Color to apply to selected faces
*/

AnnotFactory.changeSUISphere = (bBrush=true, bEraser=false)=>{
    // First time initialization (cause it works)
    // if (AnnotFactory.STD_SEL_RAD === undefined) {
    //     AnnotFactory.STD_SEL_RAD = ATON.SUI.getSelectorRadius();
    //     AnnotFactory.brushRadius = AnnotFactory.STD_SEL_RAD;
    // }
    let brushSize = AnnotFactory.brushRadius;

    if (bBrush || bEraser) { 
        ATON.SUI.setSelectorRadius(brushSize);
        ATON.SUI._mSelectorSphere.material.dispose();
        if (bBrush) {
            ATON.SUI.setSelectorColor(ATON.MatHub.colors.green);
            // ATON.SUI._mSelectorSphere.material = new THREE.MeshStandardMaterial({
            //     color: 0x00ffff, 
            //     roughness: 0.75,
            //     metalness: 0,
            //     transparent: true,
            //     opacity: 0.5,
            //     premultipliedAlpha: true,
            //     emissive: 0xEC407A,
            //     emissiveIntensity: 0.5,
            //     wireframe: false
            // });
        }
        else {
            ATON.SUI.setSelectorColor(ATON.MatHub.colors.orange);
            // ATON.SUI._mSelectorSphere.material = new THREE.MeshStandardMaterial({
            //     color: 0x000000, 
            //     roughness: 0.75,
            //     metalness: 0,
            //     transparent: true,
            //     opacity: 0.5,
            //     premultipliedAlpha: true,
            //     emissive: 0xEC407A,
            //     emissiveIntensity: 0.5,
            //     wireframe: false
            // });
        }
    }
    else {
        ATON.SUI.setSelectorRadius(AnnotFactory.STD_SEL_RAD);
        ATON.SUI.setSelectorColor(ATON.MatHub.colors.white);
    }
}

AnnotFactory.highlightFacesOnObject = (selectedFaces, mesh, color) => {
    if (!selectedFaces || selectedFaces.length === 0) return false;
    if (!color) color = AnnotFactory.highlightColor;
    if (!mesh) mesh = AnnotFactory.mainMesh;
    
    const geometry = mesh.geometry;
    // if (!geometry.attributes.color) {
    //     console.log("No Color");
    //     // Initialize vertex colors if they don't exist
    //     const colorArray = new Float32Array(geometry.attributes.position.count * 3);
    //     colorArray.fill(1); // Default white color
    //     const colorAttr = new THREE.BufferAttribute(colorArray, 3);
    //     geometry.setAttribute('color', colorAttr);
    // }

    const colorAttr = geometry.attributes.color;
    const indexAttr = geometry.index;

    // For each selected face, color its vertices
    selectedFaces.forEach(face => {
        if (indexAttr) {
            // Indexed geometry
            let indices = indexAttr.array;
            let faceIndex = face.index;
            
            let a = indices[faceIndex * 3];
            let b = indices[faceIndex * 3 + 1];
            let c = indices[faceIndex * 3 + 2];

            colorAttr.setXYZ(a, color.r, color.g, color.b);
            colorAttr.setXYZ(b, color.r, color.g, color.b);
            colorAttr.setXYZ(c, color.r, color.g, color.b);
        } else {
            // Non-indexed geometry
            let faceStart = face.index * 9;
            for (let i = 0; i < 3; i++) {
                let vertexIndex = faceStart + (i * 3);
                colorAttr.setXYZ(vertexIndex, color.r, color.g, color.b);
            }
        }
    });
    
    colorAttr.needsUpdate = true;
    return true;
};

/**
 * Clear highlights on specific faces (reset them to white)
 * @param {Object} mesh - The target mesh
 * @param {Array} faces - Array of face data to clear
 */
AnnotFactory.clearFaceHighlightsOnFaces = (faces, mesh) => {
    if (!mesh || !mesh.geometry.attributes.color || !faces.length) return false;

    let colorAttr = mesh.geometry.attributes.color;
    let indexAttr = mesh.geometry.index;

    faces.forEach(face => {
        if (indexAttr) {
            // Indexed geometry
            const indices = indexAttr.array;
            const faceIndex = face.index;
            
            const a = indices[faceIndex * 3];
            const b = indices[faceIndex * 3 + 1];
            const c = indices[faceIndex * 3 + 2];

            colorAttr.setXYZ(a, 1, 1, 1); // Reset to white
            colorAttr.setXYZ(b, 1, 1, 1);
            colorAttr.setXYZ(c, 1, 1, 1);
        } else {
            // Non-indexed geometry
            const faceStart = face.index * 9;
            for (let i = 0; i < 3; i++) {
                const vertexIndex = faceStart + (i * 3);
                colorAttr.setXYZ(vertexIndex, 1, 1, 1); // Reset to white
            }
        }
    });

    colorAttr.needsUpdate = true;
    return true;
};

/**
 * Clear face highlights from the object
 * @param {Object} mesh - The target mesh to clear highlights from
 */
AnnotFactory.clearFaceHighlights = (mesh) => {
    if (!mesh) mesh = AnnotFactory.mainMesh;
    if (!mesh.geometry.attributes.color) return false;

    const colorAttr = mesh.geometry.attributes.color;
    const colorArray = colorAttr.array;
    
    // Reset all colors to white
    for (let i = 0; i < colorArray.length; i++) {
        colorArray[i] = 1.0;
    }

    colorAttr.needsUpdate = true;
    return true;
};
// Brush tool
// =======================================================
// TEST if you can only select faces visible to the pov for selection
/**
 * Select and highlight multiple faces on the object
 * @param {number} brushSize - Size of the selection brush
 * @param {THREE.Color} color - Color to apply to selected faces
 */
AnnotFactory.brushTool = (brushSize = AnnotFactory.brushRadius) => {
    if (!ATON._queryDataScene?.o) return false; // Only work when over mesh
    const mesh = ATON._queryDataScene.o;

    // mesh.material.vertexColors = true;
    // mesh.material.needsUpdate = true;

    // Get newly selected faces
    const newFaces = AnnotFactory.selectMultipleFaces(brushSize, mesh);
    if (!newFaces.length) return false;

    // Skip already selected faces
    const newUniqueFaces = newFaces.filter(face => 
        !AnnotFactory.currSelection.has(face.index)
    );
    if (!newUniqueFaces.length) return false;

    // Add to current selection
    newUniqueFaces.forEach(face => {
        AnnotFactory.currSelection.add(face.index);
    });

    // Highlight ALL selected faces (not just new ones)
    const allFaces = Array.from(AnnotFactory.currSelection).map(index => 
        AnnotFactory.extractFaceData(index, mesh.geometry)
    );
    AnnotFactory.highlightFacesOnObject(allFaces, mesh);

    return true;
};

// Eraser tool
AnnotFactory.eraserTool = (brushSize = AnnotFactory.brushRadius) => {
    if (!ATON._queryDataScene?.o) return false; // Only work when over mesh
    const mesh = ATON._queryDataScene.o;

    // mesh.material.vertexColors = true;
    // mesh.material.needsUpdate = true;

    // Get newly selected faces
    let newFaces = AnnotFactory.selectMultipleFaces(brushSize, mesh);
    if (!newFaces.length) return false;

    // Skip already selected faces
    let newUniqueFaces = newFaces.filter(face => 
        AnnotFactory.currSelection.has(face.index)
    );
    if (!newUniqueFaces.length) return false;

    // Reset the erased faces to white (or their original color if available)
    AnnotFactory.clearFaceHighlightsOnFaces(newUniqueFaces, mesh);

    // Remove from current selection
    newUniqueFaces.forEach(face => {
        AnnotFactory.currSelection.delete(face.index);
    });

    return true;
};

// Lasso tool           
// =======================================================

AnnotFactory.lassoTool = (lassoPoints) => {
};

// History management
// =======================================================

AnnotFactory.initHistory = ()=>{
    AnnotFactory.undoStack = [];
    AnnotFactory.redoStack = [];

    AnnotFactory.maxSteps = 10;
    // Add step limit logic
};

// Helper function - return clone of current selection
AnnotFactory._saveSelectionState = () =>{
    return new Set(AnnotFactory.currSelection); // Clone current selection
};

AnnotFactory.recordState = () =>{
    // If last selection is the same return

    // TODO:
    // IMPLEMENT ERASER TO BE CLEAR ALL + REAPPLY CURRENT
    // FIX THIS MESS HERE

    let lastSelection = AnnotFactory.undoStack[AnnotFactory.undoStack.length -1];

    if (lastSelection === undefined) lastSelection = []; 

    if (AnnotFactory.setsAreEqual(lastSelection, AnnotFactory.currSelection)) {
        return;
    }

    AnnotFactory.undoStack.push(AnnotFactory._saveSelectionState());
    AnnotFactory.redoStack = [];
};

AnnotFactory.undo = ()=>{
    if (AnnotFactory.undoStack.length === 0) {
        return;
    }
    // Save current state to redo stakck first
    AnnotFactory.redoStack.push(AnnotFactory._saveSelectionState());

    // Restore previous state
    AnnotFactory.currSelection = AnnotFactory.undoStack.pop();
    AnnotFactory.applySelectionToMesh();
};

AnnotFactory.redo = () => {
    if (AnnotFactory.redoStack.length === 0) return;

    // Save current state to undo stack first
    AnnotFactory.undoStack.push(AnnotFactory._saveSelectionState());

    // Restore next state
    AnnotFactory.currSelection = AnnotFactory.redoStack.pop();
    AnnotFactory.applySelectionToMesh();
};

export default AnnotFactory;