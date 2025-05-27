/*
    ATON Annotation Factory

    author: steliosalvanos@gmail.com

===========================================================*/
const { INTERSECTED, NOT_INTERSECTED, CONTAINED } = window.ThreeMeshBVH;
import Helpers from "./ATON.annotfactory.helpers.js";
import GeometryHelpers from "./ATON.geometryhelpers.js";

let AnnotFactory = {};


AnnotFactory.FLOAT_PREC = 5;

// Inits
// =======================================================

AnnotFactory.init = async () => {
    // Curretn selection
    AnnotFactory.currSelection = new Set();    // Track selected face IDs
    
    // Inits
    AnnotFactory.initHistory();
    await AnnotFactory.initQuerying();
    await AnnotFactory.initLasso();
    
    // Init selection sphere logic (This only works with async)
    AnnotFactory.STD_SEL_RAD = ATON.SUI.getSelectorRadius();
    AnnotFactory.brushRadius = AnnotFactory.STD_SEL_RAD;

    // Used colors
    AnnotFactory.highlightColor = ATON.MatHub.colors.green;
    AnnotFactory.defaultColor   = ATON.MatHub.colors.white;
    AnnotFactory.brushColor     = ATON.MatHub.colors.green;
    AnnotFactory.eraserColor    = ATON.MatHub.colors.orange;
    
    // Clear face highlights
    AnnotFactory.clearFaceHighlights();
};

AnnotFactory.initQuerying = async () => {
    // Polling for modularity 
    while (!ATON._queryDataScene?.o) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    AnnotFactory.raycaster = ATON._rcScene;
    AnnotFactory.queryData = ATON._queryDataScene;

    // We only have one object in the annotation scene
    AnnotFactory.mainMesh  = AnnotFactory.queryData.o;
    
    // Color properties
    AnnotFactory.mainMesh.material.vertexColors = true;
    AnnotFactory.mainMesh.material.needsUpdate  = true;
    
    // Initialize vertex colors if they don't exist
    if (!AnnotFactory.mainMesh.geometry.attributes.color) {
        console.log("Initializing color");
        const colorArray = new Float32Array(AnnotFactory.mainMesh.geometry.attributes.position.count * 3);
        colorArray.fill(AnnotFactory.defaultColor); // Default white color
        const colorAttr = new THREE.BufferAttribute(colorArray, 3);
        AnnotFactory.mainMesh.geometry.setAttribute('color', colorAttr);
    }

};

AnnotFactory.initLassoCanvas = () => {
    // Create new canvas for lasso drawing 
    const canvas = document.createElement('canvas');
    canvas.id = 'lassoCanvas';
    document.body.appendChild(canvas);

    Object.assign(canvas.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '10'
    });

    canvas.width  = ATON._renderer.domElement.width;
    canvas.height = ATON._renderer.domElement.height;

    // Retrieve context for drawing functions 
    AnnotFactory.lassoCtx = canvas.getContext('2d');

    AnnotFactory.lassoCtx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    AnnotFactory.lassoCtx.lineWidth   = 1;
    AnnotFactory.lassoCtx.fillStyle   = 'rgba(0, 255, 0, 0.2)';
};

AnnotFactory.initLassoEventHandlers = () => {
    AnnotFactory._lastMouseEvent = null;
};

AnnotFactory.initLasso = async () => {
    // Wait for querying for proper init  
    while (!ATON._queryDataScene?.o) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Init canvas
    AnnotFactory.initLassoCanvas();
    
    // Init state for event listeners 
    AnnotFactory.lassoState = {
        isActive: false,
        points: [],
        lastPosition: null, // {x, y}
        lastProcessedPosition: null // for dupe check
    };

    // Init mouse position
    AnnotFactory.currentMousePosition = {x: 0, y: 0};
    AnnotFactory.isLassoEnabled = false;
    AnnotFactory.initLassoEventHandlers();
};

AnnotFactory.initHistory = () => {
    AnnotFactory.undoStack = [];
    AnnotFactory.redoStack = [];

    // TODO Add step limit logic
    AnnotFactory.maxSteps = 10;
};

// Utils
// =======================================================

/**
Return true if currently building a convex annotation shape
@returns {boolean}
*/
AnnotFactory.isBuildingAnnot = () => {
    // placeholder HUGE BRAIN 5HEAD 9000 IQ LOGIC
    return true;
};

AnnotFactory.getMousePosition = (event) => {
    if (!AnnotFactory.lassoCtx) return { x: 0, y: 0 };

    const rect = ATON._renderer.domElement.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left),
        y: (event.clientY - rect.top)
    };
};

AnnotFactory.updateMousePosition = (event) => {
    if (!AnnotFactory.lassoCtx) return;

    const rect = AnnotFactory.lassoCtx.canvas.getBoundingClientRect();

    AnnotFactory.currentMousePosition = {
        x: (event.clientX - rect.left),
        y: (event.clientY - rect.top)
    };
};

AnnotFactory.completeBrushAnnot = ()=>{
    AnnotFactory.bAnnotBuilding = false;

    // Unlike sompleteConvexShape, instead of a SemNode, we will
    // just save the selected faces 

    AnnotFactory.completedAnnotations.push(AnnotFactory.currSelection);

    AnnotFactory.stopCurrentAnnot();
};

AnnotFactory.changeSUISphere = (bBrush=true, bEraser=false)=>{
    let brushSize = AnnotFactory.brushRadius;

    // Change SUI sphere to appropriate color and radius for visualization
    if (bBrush || bEraser) { 
        ATON.SUI.setSelectorRadius(brushSize);
        ATON.SUI._mSelectorSphere.material.dispose();
        if (bBrush) {
            ATON.SUI.setSelectorColor(ATON.MatHub.colors.green);
        }
        else {
            ATON.SUI.setSelectorColor(ATON.MatHub.colors.orange);
        }
    }
    else {
        ATON.SUI.setSelectorRadius(AnnotFactory.STD_SEL_RAD);
        ATON.SUI.setSelectorColor(ATON.MatHub.colors.white);
    }
};

// Selection Utils
// =======================================================

AnnotFactory.applySelectionToMesh = (mesh) =>{
    if (!mesh) mesh = AnnotFactory.mainMesh;

    mesh.material.vertexColors = true;

    AnnotFactory.clearFaceHighlights(mesh);
    
    let faces = Array.from(AnnotFactory.currSelection).map(
        index => GeometryHelpers.extractFaceData(index, mesh.geometry)
    );

    AnnotFactory.highlightFacesOnObject(faces, mesh);
    return;
};

/** 
Select multiple faces no the object by shapecasting a sphere
@returns {[{Int, [Vector3]}]} - Face index and vertices 
*/
AnnotFactory.selectMultipleFaces = (brushSize, mesh) => {
    if (!mesh) mesh = AnnotFactory.mainMesh;

    let hitPoint = ATON._queryDataScene.p;

    if (!hitPoint) return false;

    let selectedFaces = [];
    const geometry = mesh.geometry;
    
    // Raycast sphere on the object
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
                    selectedFaces.push(GeometryHelpers.extractFaceData(faceIndex, geometry));
                }
                return false;
            }
        });
    } else {
        console.warn("Geometry has no boundsTree, face selection will not work");
    }

    return selectedFaces;
};

AnnotFactory.clearSelection = () => {
    AnnotFactory.cleanupLasso();
};

// Visualization
// =======================================================

/**
Highlight selected faces directly on the object by modifying vertex colors
@param {Object} mesh - The target mesh to highlight
@param {Array} selectedFaces - Array of face data from selectMultipleFaces()
@param {THREE.Color} color - Color to apply to selected faces
*/
AnnotFactory.highlightFacesOnObject = (selectedFaces, mesh, color) => {
    if (!selectedFaces || selectedFaces.length === 0) return false;
    if (!mesh) mesh   = AnnotFactory.mainMesh;
    if (!color) color = AnnotFactory.highlightColor;

    const geometry  = mesh.geometry;
    const colorAttr = geometry.attributes.color;
    const indexAttr = geometry.index;

    const colors = colorAttr.array;
    const r = color.r, g = color.g, b = color.b;
    
    if (indexAttr) {
        // Indexed geometry
        const indices = indexAttr.array;
        for (let i = 0; i < selectedFaces.length; i++) {
            const faceIndex = selectedFaces[i].index;

            const a = indices[faceIndex * 3];
            const b = indices[faceIndex * 3 + 1];
            const c = indices[faceIndex * 3 + 2];

            const ai = a * 3, bi = b * 3, ci = c * 3;
            colors[ai] = r; colors[ai + 1] = g; colors[ai + 2] = b;
            colors[bi] = r; colors[bi + 1] = g; colors[bi + 2] = b;
            colors[ci] = r; colors[ci + 1] = g; colors[ci + 2] = b;
        }
    } else {
        // Non-indexed geometry
        for (let i = 0; i < selectedFaces.length; i++) {
            const faceStart = selectedFaces[i].index * 9;
            for (let j = 0; j < 3; j++) {
                const vertexIndex = faceStart + j * 3;
                colors[vertexIndex]     = r;
                colors[vertexIndex + 1] = g;
                colors[vertexIndex + 2] = b;
            }
        }
    }

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
        colorArray[i] = 1;
    }

    colorAttr.needsUpdate = true;
    return true;
};

// Brush tool
// =======================================================

/**
 * Select and highlight multiple faces on the object
 * @param {number} brushSize - Size of the selection brush
 * @param {THREE.Color} color - Color to apply to selected faces
 */
AnnotFactory.brushTool = (brushSize = AnnotFactory.brushRadius) => {
    if (!ATON._queryDataScene?.o) return false; // Only work when over mesh
    const mesh = AnnotFactory.mainMesh;

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

    // Highlight ALL selected faces
    AnnotFactory.applySelectionToMesh();

    return true;
};

// Eraser tool
// =======================================================

AnnotFactory.eraserTool = (brushSize = AnnotFactory.brushRadius) => {
    if (!ATON._queryDataScene?.o) return false; // Only work when over mesh
    const mesh = AnnotFactory.mainMesh;

    // Get newly selected faces
    let newFaces = AnnotFactory.selectMultipleFaces(brushSize, mesh);
    if (!newFaces.length) return false;

    // Skip already selected faces
    let newUniqueFaces = newFaces.filter(face => 
        AnnotFactory.currSelection.has(face.index)
    );
    if (!newUniqueFaces.length) return false;

    // Remove from current selection
    newUniqueFaces.forEach(face => {
        AnnotFactory.currSelection.delete(face.index);
    });

    AnnotFactory.applySelectionToMesh();
    
    return true;
};

// Lasso tool          
// =======================================================

AnnotFactory.startLasso = (event) => {
    // Clear previous selection (unnecessary once logic is complete)
    if (AnnotFactory.lassoState.isActive) {
        AnnotFactory.cleanupLasso();
    }
    AnnotFactory.currentMousePosition = {x: 0, y: 0};

    AnnotFactory.lassoState.isActive = true;
    AnnotFactory.lassoState.points = [AnnotFactory.getMousePosition(event)];

    // Init canvas 
    if (!AnnotFactory.lassoCtx) AnnotFactory.initLassoCanvas();

    // Visual setup
    AnnotFactory.lassoCtx.clearRect(0, 0,
        AnnotFactory.lassoCtx.canvas.width,
        AnnotFactory.lassoCtx.canvas.height
    );
    AnnotFactory.lassoCtx.beginPath();
    AnnotFactory.lassoCtx.moveTo(
        AnnotFactory.lassoState.points[0].x,
        AnnotFactory.lassoState.points[0].y
    );
};

AnnotFactory.updateLasso = (event) => {
    if(!AnnotFactory.lassoState.isActive) return;

    const currentPos  = AnnotFactory.getMousePosition(event);
    const previousPos = AnnotFactory.lassoState.points[AnnotFactory.lassoState.points.length - 1];
    const dist = Helpers.pointDistance(currentPos, previousPos);
    
    // Reduce oversampling
    if (dist < 5) return;

    AnnotFactory.lassoState.points.push(currentPos);

    // Draw the line
    AnnotFactory.lassoCtx.lineTo(currentPos.x, currentPos.y);
    AnnotFactory.lassoCtx.stroke();
};

AnnotFactory.endLasso = () => {
    if (!AnnotFactory.lassoState.isActive) return;

    AnnotFactory.processLassoSelection();
    AnnotFactory.cleanupLasso();
    AnnotFactory.lassoState.isActive = false;
};

AnnotFactory.cleanupLasso = () => {
    if (!AnnotFactory.lassoCtx) return;
    
    AnnotFactory.lassoState.isActive = false;

    AnnotFactory.lassoCtx.clearRect(0, 0, 
        AnnotFactory.lassoCtx.canvas.width,
        AnnotFactory.lassoCtx.canvas.height
        );
    AnnotFactory.lassoState.points = [];
};

AnnotFactory.processLassoSelection = () => {
    if (!AnnotFactory.lassoState.points || AnnotFactory.lassoState.points.length < 3) return;
    if (!AnnotFactory.mainMesh) return;

    const lassoPoints = AnnotFactory.lassoState.points;
    const mesh = AnnotFactory.mainMesh;
    const geometry = mesh.geometry;
    const camera = ATON.Nav._camera;
    const canvas = AnnotFactory.lassoCtx.canvas;
    const width = canvas.width;
    const height = canvas.height;

    const positionAttr = geometry.attributes.position;
    const indexAttr = geometry.index;
    const faceCount = indexAttr ? indexAttr.count / 3 : positionAttr.count / 9;

    const selectedFaces = [];

    const tempV1 = new THREE.Vector3();
    const tempV2 = new THREE.Vector3();
    const tempV3 = new THREE.Vector3();
    const centroid = new THREE.Vector3();

    for (let i = 0; i < faceCount; i++) {
        let a, b, c;
        if (indexAttr) {
            a = indexAttr.getX(i * 3);
            b = indexAttr.getX(i * 3 + 1);
            c = indexAttr.getX(i * 3 + 2);
        } else {
            a = i * 3;
            b = i * 3 + 1;
            c = i * 3 + 2;
        }

        tempV1.fromBufferAttribute(positionAttr, a);
        tempV2.fromBufferAttribute(positionAttr, b);
        tempV3.fromBufferAttribute(positionAttr, c);

        centroid.copy(tempV1).add(tempV2).add(tempV3).divideScalar(3);

        const projected = centroid.clone().project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * width;
        const screenY = (projected.y * -0.5 + 0.5) * height;

        if (Helpers.isPointInPolygon({ x: screenX, y: screenY }, lassoPoints)) {
            selectedFaces.push(GeometryHelpers.extractFaceData(i, geometry));
        }
    }
    if (!selectedFaces.length) return false;

    // Skip already selected faces
    const newUniqueFaces = selectedFaces.filter(
        face => !AnnotFactory.currSelection.has(face.index)
    );
    if (!newUniqueFaces.length) return false;

    const newUniqueFacesFiltered = GeometryHelpers.visibleFaceFiltering(newUniqueFaces, mesh);
    newUniqueFacesFiltered.forEach(face => {
        AnnotFactory.currSelection.add(face.index);
    });

    AnnotFactory.applySelectionToMesh();

    return true;
};

AnnotFactory.getLassoPixels = () => {
    const canvas    = AnnotFactory.lassoCtx.canvas;
    const imgData   = AnnotFactory.lassoCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data      = imgData.data;
    const drawArray = [];
    
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            drawArray.push({x, y});
        }
    }
    return drawArray;
};

AnnotFactory.lassoTool = (event) => {
    if (!event) return;
    if (!AnnotFactory.mainMesh) return;
    if (!AnnotFactory.lassoState) return;

    // AnnotFactory.updateMousePosition(event);
    AnnotFactory.updateMousePosition(event);

    // Skip if position hasn't changed
    if (AnnotFactory.lassoState.lastProcessedPosition &&
        AnnotFactory.lassoState.lastProcessedPosition.x === AnnotFactory.currentMousePosition.x &&
        AnnotFactory.lassoState.lastProcessedPosition.y === AnnotFactory.currentMousePosition.y
    ) {
        return;
    }

    if (!AnnotFactory.lassoState.isActive) {
        AnnotFactory.cleanupLasso();
        AnnotFactory.startLasso(event);      
    }
    else {
        AnnotFactory.updateLasso(event);
    }
    AnnotFactory.lassoState.lastProcessedPosition = {...AnnotFactory.currentMousePosition};
};

// History management
// =======================================================

// Helper function - return clone of current selection

AnnotFactory.recordState = () => {
    // If last selection is the same return

    // TODO:
    // IMPLEMENT ERASER TO BE CLEAR ALL + REAPPLY CURRENT
    // FIX THIS MESS HERE

    let lastSelection = AnnotFactory.undoStack[AnnotFactory.undoStack.length -1];

    if (lastSelection === undefined) lastSelection = []; 

    if (Helpers.setsAreEqual(lastSelection, AnnotFactory.currSelection)) {
        return;
    }

    AnnotFactory.undoStack.push(new Set(AnnotFactory.currSelection));
    AnnotFactory.redoStack = [];
};

AnnotFactory.undo = () => {
    if (AnnotFactory.undoStack.length === 0) {
        return;
    }
    // Save current state to redo stakck first
    AnnotFactory.redoStack.push(new Set(AnnotFactory.currSelection));

    // Restore previous state
    AnnotFactory.currSelection = AnnotFactory.undoStack.pop();
    AnnotFactory.applySelectionToMesh();
};

AnnotFactory.redo = () => {
    if (AnnotFactory.redoStack.length === 0) return;

    // Save current state to undo stack first
    AnnotFactory.undoStack.push(new Set(AnnotFactory.currSelection));

    // Restore next state
    AnnotFactory.currSelection = AnnotFactory.redoStack.pop();
    AnnotFactory.applySelectionToMesh();
};

// Lasso optimization

// Camera frustum culling
// ADD another function to check if the whole mesh (bbox) is visible for optimization 
// ADD another function to first get all mesh faces if necessary 

AnnotFactory.faceSelectionTest = () => {
    console.time('1')
    const faces1 = AnnotFactory.frustumCullingBVH();
    console.timeEnd('1')
    console.time('2')
    const faces2 = AnnotFactory.getFacesFacingCamera(faces1);
    console.timeEnd('2')
    console.time('3')
    const faces3 = AnnotFactory.depthMappingBVH(faces2)
    console.timeEnd('3')
    console.time('4')
    const faces4 = AnnotFactory.depthMappingBVH2(faces2)
    console.timeEnd('4')
    AnnotFactory.currSelection = faces3;
    console.log(faces3)
    console.log(faces4)
    AnnotFactory.applySelectionToMesh()
};

export default AnnotFactory;