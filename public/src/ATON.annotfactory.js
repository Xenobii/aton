/*
    ATON Annotation Factory

    author: steliosalvanos@gmail.com

===========================================================*/
const { INTERSECTED, NOT_INTERSECTED, CONTAINED } = window.ThreeMeshBVH;

let AnnotFactory = {};

AnnotFactory.FLOAT_PREC = 5;

AnnotFactory.init = () => {
    AnnotFactory.bAnnotBuilding = false;
    AnnotFactory.convexPoints = [];
    AnnotFactory.annotFaces = [];
    AnnotFactory.annotNode = undefined;
    AnnotFactory.currAnnotMesh = undefined;

    // Temp sem node to hold developing annotation mesh
    AnnotFactory.currSemNode = ATON.createSemanticNode();
    AnnotFactory.currSemNode.disablePicking();
    AnnotFactory.currSemNode.attachToRoot();

    AnnotFactory.resetMaterial();

    AnnotFactory._numFaces = 0; // counter of facesproduced
};

// Current material
AnnotFactory.resetMaterial = () => {
    AnnotFactory.currMaterial = ATON.MatHub.getMaterial("semanticShapeHL"); // current sem material we are using. Was "semanticShape"
};

AnnotFactory.setMaterial = (m) => {
    if (m === undefined) return;
    AnnotFactory.currMaterial = m;
};

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

/** 
Select multiple faces no the object by shapecasting a sphere
@returns {[{Int, [Vector3]}]} - Face index and vertices 
*/
AnnotFactory.selectMultipleFaces = (brushSize = 0.01) => {
    if (ATON._queryDataScene === undefined) return false;

    const mesh     = ATON._queryDataScene.o;
    const hitPoint = ATON._queryDataScene.p;

    if (!mesh || !hitPoint) return false;

    const geometry = mesh.geometry;
    const selectedFaces = [];
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

/**
Get a unique vertices list from a set of faces 
*/
AnnotFactory.getUniqueVertices = (faces) => {
    if (faces === undefined) return false;

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

    // TODO: add offset to the points for visualization
    console.log(`Extracted ${uniqueVertices.length} unique vertices from ${faces.length} faces`);

    return uniqueVertices;
}

/**
Converts faces to mesh
@param faces 
@returns {Mesh} - faceMesh
 */
AnnotFactory.convertFacesToMesh = (faces) => {
    // See SemFactory.addConvexPoint
    if (faces === undefined) return false;
    
    // Push to convexPoints
    let uniqueVertices = AnnotFactory.getUniqueVertices(faces);
    uniqueVertices.forEach(p => {
        AnnotFactory.convexPoints.push(p);
    });
    let numVertices = AnnotFactory.convexPoints.length;

    // Simple debugging
    if (numVertices < 1) {
        console.log("wtf");
        return false;
    }

    // Create the mesh
    let geom = new THREE.ConvexGeometry(AnnotFactory.convexPoints);
    let semesh = new THREE.Mesh(geom, ATON.MatHub.getMaterial("semanticShapeEdit"));

    // First selection
    if (!AnnotFactory.bAnnotBuilding) {
        AnnotFactory.currSemNode.add(semesh);

        // Store
        semesh.userData._convexPoints = [];
        for (let i=0; i < numVertices; i++) {
            ATON.Utils.setVectorPrecision(AnnotFactory.convexPoints[i], AnnotFactory.FLOAT_PREC);

            semesh.userData._convexPoints.push(AnnotFactory.convexPoints[i].x);
            semesh.userData._convexPoints.push(AnnotFactory.convexPoints[i].y);
            semesh.userData._convexPoints.push(AnnotFactory.convexPoints[i].z);
        }

        AnnotFactory.currAnnotMesh = semesh;
        AnnotFactory.bAnnotBuilding = true;
    }

    // Add to existing geometry
    else {
        let currSemesh = AnnotFactory.currAnnotMesh;
        currSemesh.geometry.dispose();
        currSemesh.geometry = geom;

        for (let i=0; i < numVertices; i++) {
            ATON.Utils.setVectorPrecision(AnnotFactory.convexPoints[i], AnnotFactory.FLOAT_PREC);

            currSemesh.userData._convexPoints.push(AnnotFactory.convexPoints[i].x);
            currSemesh.userData._convexPoints.push(AnnotFactory.convexPoints[i].y);
            currSemesh.userData._convexPoints.push(AnnotFactory.convexPoints[i].z);
        }
    }
    return true;
};

/**
Cancel current annot semantic shape, if building one
*/
AnnotFactory.stopCurrentAnnot = () => {
    if (!AnnotFactory.bAnnotBuilding) return;

    AnnotFactory.convexPoints = [];
    AnnotFactory.bAnnotBuilding = false;

    AnnotFactory.currSemNode.removeChildren();
    ATON.SUI.gPoints.removeChildren();
};

/**
Return true if currently building a convex annotation shape
@returns {boolean}
*/
AnnotFactory.isBuildingAnnot = () => {
    if (AnnotFactory.convexPoints.length > 0) return true;

    return false;
};

export default AnnotFactory;