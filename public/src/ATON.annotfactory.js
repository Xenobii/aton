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

    // Inits
    await AnnotFactory.initQuerying();
    AnnotFactory.initHistory();
    AnnotFactory.initLasso();
    AnnotFactory.initLassoEventHandlers();
    
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

AnnotFactory.initLassoCanvas = () => {
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

    AnnotFactory.lassoCtx = canvas.getContext('2d');

    AnnotFactory.lassoCtx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    AnnotFactory.lassoCtx.lineWidth   = 1;
    AnnotFactory.lassoCtx.fillStyle   = 'rgba(0, 255, 0, 0.2)';
};

AnnotFactory.initLasso = () => {
    AnnotFactory.initLassoCanvas();
    
    AnnotFactory.lassoState = {
        isActive: false,
        points: [],
        lastPosition: null, // {x, y}
        lastProcessedPosition: null // for dupe check
    };

    AnnotFactory.currentMousePosition = {x: 0, y: 0};
    // AnnotFactory.currentMousePosition = getMousePosition()

    AnnotFactory.isLassoEnabled = false;
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

AnnotFactory._getCurrentPixelRatio = () => {
    if (!AnnotFactory.lassoCtx) return;

    const canvas = AnnotFactory.lassoCtx.canvas;
    const pixelRatio = ATON._renderer.getPixelRatio();

    // const displayWidth = ATON._renderer.domElement.clientWidth;
    // const displayHeight = ATON._renderer.domElement.clientHeight;

    // canvas.width = Math.floor(displayWidth * pixelRatio);
    // canvas.height = Math.floor(displayHeight * pixelRatio);
    
    // AnnotFactory.lassoCtx.setTransform(1, 0, 0, 1, 0, 0);
    // AnnotFactory.lassoCtx.scale(pixelRatio, pixelRatio);

    return 1; 
}

AnnotFactory.getMousePosition = (event) => {
    if (!AnnotFactory.lassoCtx) return { x: 0, y: 0 };

    const scale = AnnotFactory._getCurrentPixelRatio();
    const rect = ATON._renderer.domElement.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * scale,
        y: (event.clientY - rect.top) * scale
    };
};

AnnotFactory.updateMousePosition = (event) => {
    if (!AnnotFactory.lassoCtx) return;

    const scale = AnnotFactory._getCurrentPixelRatio();
    const rect = AnnotFactory.lassoCtx.canvas.getBoundingClientRect();

    AnnotFactory.currentMousePosition = {
        x: (event.clientX - rect.left) * scale,
        y: (event.clientY - rect.top) * scale
    };
};

AnnotFactory.clearSelection = () => {
    AnnotFactory.cleanupLasso();
};

AnnotFactory.isPointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
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

    // Highlight ALL selected faces
    AnnotFactory.applySelectionToMesh();

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

    AnnotFactory.applySelectionToMesh();
    
    return true;
};

// Lasso tool          
// =======================================================

// Create a 2D canvas for lass tool 

AnnotFactory.startLasso = (event) => {
    // if (!ATON._queryDataScene?.o) return;

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
    // AnnotFactory.lassoCtx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    // AnnotFactory.lassoCtx.lineWidth = 2;
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
    const dist = AnnotFactory.pointDistance(currentPos, previousPos);

    // Reduce oversampling
    if (dist < 5) return;

    AnnotFactory.lassoState.points.push(currentPos);

    // AnnotFactory.lassoState.lastPosition = currentPos;

    // Draw the line
    AnnotFactory.lassoCtx.lineTo(currentPos.x, currentPos.y);
    AnnotFactory.lassoCtx.stroke();
};

AnnotFactory.endLasso = () => {
    if (!AnnotFactory.lassoState.isActive) return;

    AnnotFactory.lassoCtx.closePath();
    AnnotFactory.lassoCtx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    AnnotFactory.lassoCtx.fill();

    AnnotFactory.processLassoSelection();
    AnnotFactory.lassoState.isActive = false;
    AnnotFactory.cleanupLasso();
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

    console.time('Lasso Selection');
    
    const drawArray = AnnotFactory.getLassoPixels();
    if (drawArray.length === 0 ) return;
    
    const mesh = AnnotFactory.mainMesh;
    const geometry = mesh.geometry;
    const camera = ATON.Nav._camera;
    const canvas = AnnotFactory.lassoCtx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    
    // Optimization
    const bounds = AnnotFactory.getLassoScreenBounds();
    const sampleStep = Math.max(1, Math.floor(Math.sqrt(bounds.width * bounds.height) / 20));
    
    const selectedFaces = [];

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Smaple points from the drawn area (TODO, send this elsewhere)
    for (let i = 0; i < drawArray.length; i += 4) {
        const point = drawArray[i];

        // Normalize coords
        mouse.x = (point.x / width) * 2 - 1;
        mouse.y = (point.y / height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(mesh);

        if(intersects.length > 0) {
            const faceIndex = intersects[0].faceIndex;
            if ( faceIndex !== undefined) {
                selectedFaces.push(faceIndex);
            }
        }
    }
    // check if face centroids are inside the lasso polygon 
    const faceCount = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 9;
    for (let i = 0; i < faceCount; i++) {
        const face = AnnotFactory.extractFaceData(i, geometry);
        const centroid = new THREE.Vector3();
        centroid.add(face.vertices[0]).add(face.vertices[1]).add(face.vertices[2]).divideScalar(3);
        
        // Project centroid to screen space
        const centroidScreen = centroid.clone().project(camera);
        const screenX = (centroidScreen.x * 0.5 + 0.5) * width;
        const screenY = (centroidScreen.y * -0.5 + 0.5) * height;

        if (AnnotFactory.isPointInPolygon({x: screenX, y: screenY}, AnnotFactory.lassoState.points)) {
            selectedFaces.push(i);
        }
    }

    // Skip already selected faces
    const newUniqueFaces = selectedFaces.filter(face => 
        !AnnotFactory.currSelection.has(face.index)
    );

    // Add to current selection
    newUniqueFaces.forEach(face => {
        AnnotFactory.currSelection.add(face);
    });

    // AnnotFactory.currSelection.add(selectedFaces);
    AnnotFactory.applySelectionToMesh();
};

AnnotFactory.getLassoPixels = () => {
    const canvas = AnnotFactory.lassoCtx.canvas;
    const imgData = AnnotFactory.lassoCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
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

    // AnnotFactory.updateMousePosition(event);
    AnnotFactory.updateMousePosition(event);

    // Skip if position hasn't changed
    if (AnnotFactory.lassoState.lastProcessedPosition &&
        AnnotFactory.lassoState.lastProcessedPosition.x === AnnotFactory.currentMousePosition.x
        &&
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

// EventListeners
AnnotFactory.initLassoEventHandlers = () => {
    AnnotFactory._lastMouseEvent = null;
};

// History management
// =======================================================

AnnotFactory.initHistory = () => {
    AnnotFactory.undoStack = [];
    AnnotFactory.redoStack = [];

    AnnotFactory.maxSteps = 10;
    // Add step limit logic
};

// Helper function - return clone of current selection
AnnotFactory._saveSelectionState = () => {
    return new Set(AnnotFactory.currSelection); // Clone current selection
};

AnnotFactory.recordState = () => {
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

AnnotFactory.undo = () => {
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

// Optimization
// =======================================================

AnnotFactory.prepareMeshforSelection = (mesh) => {
    if (!mesh) mesh = AnnotFactory.mainMesh;

    const geometry = mesh.geometry;
    const faceCount = geometry.index ? geometry.index.count / 3 : geometry.atributes.position.count / 9;
    AnnotFactory.faceCentroids = new Array(faceCount);   
    // Pre-compute centroids and other data
    for (let i = 0; i < faceCount; i++) {
        const face = AnnotFactory.extractFaceData(i, geometry);
        const centroid = new THREE.Vector3();
        centroid.add(face.vertices[0]).add(face.vertices[1]).add(face.vertices[2]).divideScalar(3);
        AnnotFactory.faceCentroids[i] = centroid;
    }
};

AnnotFactory.pointDistance = (pos1, pos2) => {
    const dist = Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) + 
        Math.pow(pos1.y - pos2.y)
    );
    return dist;
};

AnnotFactory.getLassoScreenBounds = () => {
    const points = AnnotFactory.lassoState.points;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }
    
    return {
        minX: Math.floor(minX),
        minY: Math.floor(minY),
        maxX: Math.ceil(maxX),
        maxY: Math.ceil(maxY),
        width: Math.ceil(maxX - minX),
        height: Math.ceil(maxY - minY)
    };
};

export default AnnotFactory;