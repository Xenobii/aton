/*
    ATON Annotation Factory

    author: steliosalvanos@gmail.com

===========================================================*/
const { INTERSECTED, NOT_INTERSECTED, CONTAINED } = window.ThreeMeshBVH;

let AnnotFactory = {};

AnnotFactory.FLOAT_PREC = 5;

AnnotFactory.init = () => {
    AnnotFactory.bAnnotBuilding = false;
    
    AnnotFactory.convexShapes = [];
    AnnotFactory.annotNode = undefined;
    AnnotFactory.currAnnotMesh = undefined;

    // Temp sem node to hold developing annotation mesh
    AnnotFactory.currSemNode = ATON.createSemanticNode();
    AnnotFactory.currSemNode.disablePicking();
    AnnotFactory.currSemNode.attachToRoot();

    // Brush tool state
    AnnotFactory.currSelection = new Set();    // Track selected face IDs to avoid duplicates
    AnnotFactory.history = [];                 // Store undo history
    AnnotFactory.historyIndex = -1;  

    AnnotFactory.annotGroup = new THREE.Group();
    // AnnotFactory.annotGroup.clear();
    
    AnnotFactory._numFaces = 0; // counter of faces produced

    AnnotFactory.completedAnnotations = [];
    
    AnnotFactory.brushRadius = 0.0005;
    AnnotFactory.selectionSphere = null;
    AnnotFactory.resetMaterial();
};

// Current material
// =======================================================

AnnotFactory.resetMaterial = () => {
    AnnotFactory.currMaterial = ATON.MatHub.getMaterial("semanticShapeHL"); // current sem material we are using. Was "semanticShape"
};

AnnotFactory.setMaterial = (m) => {
    if (m === undefined) return;
    AnnotFactory.currMaterial = m;
};

// Utils
// =======================================================

/**
Extract Data from a specific face
@returns {[Int, [Vector3], [Vector3]]} - Face id, indicies and vertices
*/
AnnotFactory.extractFaceData = (geometry, faceIndex) => {
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

    AnnotFactory.convexPoints = [];
    AnnotFactory.bAnnotBuilding = false;
    AnnotFactory.annotGroup.clear();

    AnnotFactory.currSemNode.removeChildren();
    ATON.SUI.gPoints.removeChildren();
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

// Face Selection
// ======================================================

/**
Get a unique vertices list from a set of faces 
*/
AnnotFactory.getUniqueVertices = (faces) => {
    if (faces === undefined || faces === false) return false;

    // Get all vertices with non-duplicates
    let verticeMap = new Map();
    let uniqueVertices = [];

    faces.forEach(face => {
        if (!face.vertices || face.vertices.length !== 3) return;

        face.vertices.forEach(vertex => {
            // Create key with its coordinates
            let key = `${vertex.x.toFixed(6)},${vertex.y.toFixed},${vertex.x.toFixed(6)}`;

            if (!verticeMap.has(key)) {
                verticeMap.set(key, uniqueVertices.length);
                uniqueVertices.push(vertex.clone());
            }
        });
    });

    console.log(`Extracted ${uniqueVertices.length} unique vertices from ${faces.length} faces`);

    return uniqueVertices;
};

/**
Select a single specific face of an object via ray-casting
Log the face id and defining vertices
@returns {{Int, [Vector3]}} - Face index and vertices 
*/
AnnotFactory.selectSingleFace = () => {
    if (ATON._queryDataScene === undefined) return false;

    let mesh = ATON._queryDataScene.o;
    let fid  = ATON._queryDataScene.f;

    if (!mesh || fid === undefined) return false;

    let geometry = mesh.geometry;

    face = AnnotFactory.extractFaceData(geometry, fid);

    console.log("Selected face id: ", face.index);
    console.log("Selected face vertices: ", face.vertices);

    return face;
};

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
AnnotFactory.selectMultipleFaces = (brushSize = AnnotFactory.brushRadius) => {
    if (ATON._queryDataScene === undefined) return false;

    let mesh     = ATON._queryDataScene.o;
    let hitPoint = ATON._queryDataScene.p;

    if (!mesh || !hitPoint) return false;

    const geometry = mesh.geometry;
    const selectedFaces = [];
    const sphere = new THREE.Sphere();
    const inverseMatrix = new THREE.Matrix4();

    inverseMatrix.copy(mesh.matrixWorld).invert();
    sphere.center.copy(hitPoint).applyMatrix4(inverseMatrix);
    sphere.radius = brushSize;

    // ADD RAYCASTING LIMITATIONS (TO NOT CAST ON CONVEX GEOMETRIES)

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
                    selectedFaces.push(AnnotFactory.extractFaceData(geometry, faceIndex));
                }
                return false;
            }
        });
    } else {
        console.warn("Geometry has no boundsTree, face selection will be less efficient");

        if (geometry.index) {
            const triangleCount = geometry.index.array.length / 3;
            for (let i = 0; i < triangleCount; i++) {
                const triangle = AnnotFactory.extractFaceData(geometry, i);
                const tri = new THREE.Triangle(...triangle.vertices);

                if (tri.intersectsSphere(sphere)) {
                    selectedFaces.push(triangle);
                }
            }
        }
    }

    console.log(`Selected ${selectedFaces.length} faces with brush size ${brushSize}`);
    return selectedFaces;
};

// Semantic utils
// ======================================================
/**
Converts faces to mesh
@param faces 
@returns {Mesh} - faceMesh
*/
AnnotFactory.convertFacesToMesh = (faces) => {
    // See SemFactory.addConvexPoint
    if (faces === undefined || faces === false) return false;
    
    if (AnnotFactory.currConvexPoints) {
        AnnotFactory.currConvexPoints = [];
    };

    // Get uniqueVertices
    let uniqueVertices = AnnotFactory.getUniqueVertices(faces);
    
    // Push to currConvexPoints
    uniqueVertices.forEach(p => {
        AnnotFactory.currConvexPoints.push(p);
    });

    // Create the mesh
    let geom = new THREE.ConvexGeometry(AnnotFactory.currConvexPoints);
    let currSemesh = new THREE.Mesh(geom, ATON.MatHub.getMaterial("semanticShapeEdit"));
    
    // Add to Group, add group to semNode 
    // Adding to SemNode is necessary for visibility
    
    // First item
    if (AnnotFactory.annotGroup.children.length === 0) {
        AnnotFactory.annotGroup.add(currSemesh);
        AnnotFactory.currSemNode.add(AnnotFactory.annotGroup);
        AnnotFactory.bAnnotBuilding = true;
    }
    else {
        AnnotFactory.annotGroup.add(currSemesh);
        AnnotFactory.currSemNode.removeChildren();
        AnnotFactory.currSemNode.add(AnnotFactory.annotGroup);
    }
    // Create method for storing and DISPLAYING annotations without
    // userData storage
    
    return true;
};

AnnotFactory.clearSelection = () => {
    let mesh = ATON._queryDataScene?.o;
    if (mesh) AnnotFactory.clearFaceHighlights(mesh);
    AnnotFactory.currSelection.clear();
};

// Visualization
// =======================================================

/**
Highlight selected faces directly on the object by modifying vertex colors
@param {Object} mesh - The target mesh to highlight
@param {Array} selectedFaces - Array of face data from selectMultipleFaces()
@param {THREE.Color} color - Color to apply to selected faces
*/

AnnotFactory.changeSUISphere = (bBrush=true, brushSize=AnnotFactory.brushRadius)=>{
    if (bBrush) { 
        ATON.SUI._mSelectorSphere.scale.setScalar(brushSize*5000);
        ATON.SUI._mSelectorSphere.material.dispose();
        ATON.SUI._mSelectorSphere.material = new THREE.MeshStandardMaterial({
            color: 0xEC407A, // Pink color similar to the example
            roughness: 0.75,
            metalness: 0,
            ransparent: true,
            opacity: 0.5,
            premultipliedAlpha: true,
            emissive: 0xEC407A,
            emissiveIntensity: 0.5,
            wireframe: false
        });
        // change to mathub material
    }
    else {
        ATON.SUI._mSelectorSphere.scale.setScalar(1);
        ATON.SUI._mSelectorSphere.material.dispose();
        ATON.SUI._mSelectorSphere.material = ATON.MatHub.getMaterial("selector")
    }
}

AnnotFactory.highlightFacesOnObject = (mesh, selectedFaces, color = new THREE.Color(1, 0, 0)) => {
    if (!mesh || !selectedFaces || selectedFaces.length === 0) return false;

    let geometry = mesh.geometry;
    if (!geometry.attributes.color) {
        console.log("No Color");
        // Initialize vertex colors if they don't exist
        const colorArray = new Float32Array(geometry.attributes.position.count * 3);
        colorArray.fill(1); // Default white color
        const colorAttr = new THREE.BufferAttribute(colorArray, 3);
        geometry.setAttribute('color', colorAttr);
    }

    let colorAttr = geometry.attributes.color;
    let indexAttr = geometry.index;

    // For each selected face, color its vertices
    selectedFaces.forEach(face => {
        if (indexAttr) {
            // Indexed geometry
            const indices = indexAttr.array;
            const faceIndex = face.index;
            
            const a = indices[faceIndex * 3];
            const b = indices[faceIndex * 3 + 1];
            const c = indices[faceIndex * 3 + 2];

            colorAttr.setXYZ(a, color.r, color.g, color.b);
            colorAttr.setXYZ(b, color.r, color.g, color.b);
            colorAttr.setXYZ(c, color.r, color.g, color.b);
        } else {
            // Non-indexed geometry
            const faceStart = face.index * 9;
            for (let i = 0; i < 3; i++) {
                const vertexIndex = faceStart + (i * 3);
                colorAttr.setXYZ(vertexIndex, color.r, color.g, color.b);
            }
        }
    });

    colorAttr.needsUpdate = true;
    return true;
};

AnnotFactory.toggleSelectionSphere = (visible=true, radius=AnnotFactory.brushRadius) => {
    if(!AnnotFactory.selectionSpere) {
        let sphereGeometry = new THREE.SphereGeometry(radius, 16, 16);
        let sphereMaterial = new THREE.MeshStandardMaterial({
            color: 0xEC407A, // Pink color similar to the example
            roughness: 0.75,
            metalness: 0,
            transparent: true,
            opacity: 0.5,
            premultipliedAlpha: true,
            emissive: 0xEC407A,
            emissiveIntensity: 0.5,
            wireframe: false
        });
        // Replace with Mathub material
        AnnotFactory.selectionSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        AnnotFactory.currSemNode.add(AnnotFactory.selectionSphere);
    }
    
    AnnotFactory.selectionSphere.visible = visible;

    // Update position if we have a hit point

    if (visible && ATON._queryDataScene?.p) {
        AnnotFactory.selectionSphere.position.copy(ATON._queryDataScene.p);
        // AnnotFactory.selectionSphere.scale.setScalar(radius);
    }

    // Enable/disable controls logic
}; 

/**
 * Clear face highlights from the object
 * @param {Object} mesh - The target mesh to clear highlights from
 */
AnnotFactory.clearFaceHighlights = (mesh) => {
    if (!mesh || !mesh.geometry.attributes.color) return false;

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

/**
 * Select and highlight multiple faces on the object
 * @param {number} brushSize - Size of the selection brush
 * @param {THREE.Color} color - Color to apply to selected faces
 */
AnnotFactory.selectAndHighlightFaces = (brushSize = AnnotFactory.brushRadius, color = new THREE.Color(1, 0, 0)) => {
    if (!ATON._queryDataScene?.o) return false;
    let mesh = ATON._queryDataScene.o;

    mesh.material.vertexColors = true;
    mesh.material.needsUpdate = true;

    // Get newly selected faces
    let newFaces = AnnotFactory.selectMultipleFaces(brushSize);
    if (!newFaces.length) return false;

    // Skip already selected faces
    let newUniqueFaces = newFaces.filter(face => 
        !AnnotFactory.currSelection.has(face.index)
    );

    // Add to current selection
    newUniqueFaces.forEach(face => {
        AnnotFactory.currSelection.add(face.index);
    });

    // Highlight ALL selected faces (not just new ones)
    const allFaces = Array.from(AnnotFactory.currSelection).map(index => 
        AnnotFactory.extractFaceData(mesh.geometry, index)
    );
    AnnotFactory.highlightFacesOnObject(mesh, allFaces, color);

    // Save to history (for undo)
    return true;
};

// Lasso tool           
// =======================================================

AnnotFactory.lassoTool = () => {
    if (!ATON._queryDataScene?.o) return false;

    let mesh     = ATON._queryDataScene.o;
    let hitPoint = ATON._queryDataScene.p;

    if (!mesh || !hitPoint) return false;
};

// History management
// =======================================================

export default AnnotFactory;