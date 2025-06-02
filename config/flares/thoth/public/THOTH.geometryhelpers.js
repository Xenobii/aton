/*
    THOTH Plugin for ATON - Geometry Helpers

    author: steliosalvanos@gmail.com

===========================================================*/
const { INTERSECTED, NOT_INTERSECTED, CONTAINED } = window.ThreeMeshBVH;


let GeometryHelpers = {};


GeometryHelpers.FLOAT_PREC = 5;


GeometryHelpers.extractFaceData = (faceIndex, geometry, getVertices = false) => {
    let face = { index: faceIndex, vertices: [] };

    // Only get vertices if specified
    if (getVertices) {
        if (geometry.index) {
            // Indexed geometry
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
            // Non-indexed geometry
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
    
        ATON.Utils.setVectorPrecision(face.vertices[0], GeometryHelpers.FLOAT_PREC);
        ATON.Utils.setVectorPrecision(face.vertices[1], GeometryHelpers.FLOAT_PREC);
        ATON.Utils.setVectorPrecision(face.vertices[2], GeometryHelpers.FLOAT_PREC);
    }

    return face;
};

GeometryHelpers.getAllFaceIndices = (mesh) => {
    const geometry = mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const indexAttr = geometry.index;

    // Face count
    const faceCount = indexAttr ? indexAttr.count / 3 : positionAttr / 3; 
    const faceIndices = [];
    
    for (let i = 0; i < faceCount; i++) {
        const face = GeometryHelpers.extractFaceData(i, geometry, false);
        faceIndices.push(face.index);
    }
    return faceIndices;
};

GeometryHelpers.frustumCulling = (mesh, camera) => {
    if (!camera) camera = ATON.Nav._camera;

    const geometry = mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const indexAttr = geometry.index;

    // Total number of faces
    const faceCount = indexAttr ? indexAttr.count / 3 : positionAttr / 3;
    const facesInFrustum = [];

    // Setup matrices for transformations
    const modelMatrix = mesh.matrixWorld;
    const viewMatrix = camera.matrixWorldInverse;
    const projectionMatrix = camera.projectionMatrix;
    const mvpMatrix = new THREE.Matrix4()
        .multiplyMatrices(projectionMatrix, viewMatrix)
        .multiply(modelMatrix);

    // Camera frustum
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(mvpMatrix);
    
    // Helper vectors
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const faceCentroid = new THREE.Vector3();
    
    for (let i = 0; i < faceCount; i++) {
        // Get Face Vertices
        const face = GeometryHelpers.extractFaceData(i, geometry, true);
        v0.copy(face.vertices[0]);
        v1.copy(face.vertices[1]);
        v2.copy(face.vertices[2]);

        // Transform to world space
        v0.applyMatrix4(modelMatrix);
        v1.applyMatrix4(modelMatrix);
        v2.applyMatrix4(modelMatrix);

        // Calculate face center
        faceCentroid.copy(v0).add(v1).add(v2).multiplyScalar(1/3);

        // Test if face is within frustu,
        if (frustum.containsPoint(faceCentroid)) {
            facesInFrustum.push(i);
        }
    }
    return facesInFrustum;
};

GeometryHelpers.frustumCullingBVH = (mesh, camera) => {
    if (!camera) camera = ATON.Nav._camera;

    const geometry = mesh.geometry;
    
    // Ensure BVH is computed
    if (!geometry.boundsTree) {
        console.warn('Mesh BVH not computed. Computing now...');
        geometry.computeBoundsTree();
    }
    
    const facesInFrustum = [];
    const frustum = new THREE.Frustum();
    
    // Setup camera frustum
    const mvpMatrix = new THREE.Matrix4()
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        .multiply(mesh.matrixWorld);
    frustum.setFromProjectionMatrix(mvpMatrix);
    
    // Helper vectors
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const faceCentroid = new THREE.Vector3();
    
    // Use BVH to traverse only potentially visible faces
    geometry.boundsTree.shapecast({
        intersectsBounds: (box) => {
            // Quick frustum test on bounding box
            return frustum.intersectsBox(box);
        },
        
        intersectsTriangle: (tri, triangleIndex) => {
            // Get triangle vertices
            const face = GeometryHelpers.extractFaceData(triangleIndex, geometry, true);
            v0.copy(face.vertices[0]);
            v1.copy(face.vertices[1]);
            v2.copy(face.vertices[2]);
            
            // Transform to world space
            v0.applyMatrix4(mesh.matrixWorld);
            v1.applyMatrix4(mesh.matrixWorld);
            v2.applyMatrix4(mesh.matrixWorld);
            
            // Calculate face center
            faceCentroid.copy(v0).add(v1).add(v2).multiplyScalar(1/3);
            
            // Final frustum test on face center
            if (frustum.containsPoint(faceCentroid)) {
                facesInFrustum.push(triangleIndex);
            }
            
            return false; // Continue traversal
        }
    });
    
    return facesInFrustum;
};

GeometryHelpers.getFacesFacingCamera = (faceIndices, mesh, camera) => {
    if (!faceIndices) faceIndices = GeometryHelpers.getAllFaceIndices(mesh);
    if (!camera) camera = ATON.Nav._camera;

    const geometry = mesh.geometry;
    const modelMatrix = mesh.matrixWorld;
    const cameraPos = camera.getWorldPosition(new THREE.Vector3());
    const frontFacingFaces = [];

    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const faceCentroid = new THREE.Vector3();
    const faceNormal = new THREE.Vector3();
    const viewDirection = new THREE.Vector3();

    for (const faceIndex of faceIndices) {
        const face = GeometryHelpers.extractFaceData(faceIndex, geometry, true);
        v0.copy(face.vertices[0]);
        v1.copy(face.vertices[1]);
        v2.copy(face.vertices[2]);

        // Transform to world space
        v0.applyMatrix4(modelMatrix);
        v1.applyMatrix4(modelMatrix);
        v2.applyMatrix4(modelMatrix);

        // Calculate centroid and normal
        faceCentroid.copy(v0).add(v1).add(v2).multiplyScalar(1/3);
        faceNormal.crossVectors(
            v1.clone().sub(v0),
            v2.clone().sub(v0)
        ).normalize();

        // Calculate view direction from face to camera
        viewDirection.copy(cameraPos).sub(faceCentroid).normalize();

        // Test if face is facing camera
        if (faceNormal.dot(viewDirection) > 0) {
            frontFacingFaces.push(faceIndex);
        }
    }

    return frontFacingFaces;
};

GeometryHelpers.depthMappingBVH = (faceIndices, mesh, camera) => {
    if (!camera) camera = ATON.Nav._camera;
    if (!faceIndices) faceIndices = GeometryHelpers.getAllFaceIndices(mesh);

    const geometry = mesh.geometry;
    const modelMatrix = mesh.matrixWorld;
    const cameraPos = camera.getWorldPosition(new THREE.Vector3());
    
    if (!geometry.boundsTree) {
        console.warn('Mesh BVH not computed. Computing now...');
        geometry.computeBoundsTree();
    }

    const visibleFaces = [];
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const faceCentroid = new THREE.Vector3();
    const faceNormal = new THREE.Vector3();
    const viewDirection = new THREE.Vector3();

    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;

    for (const faceIndex of faceIndices) {
        const face = GeometryHelpers.extractFaceData(faceIndex, geometry, true);
        v0.copy(face.vertices[0]);
        v1.copy(face.vertices[1]);
        v2.copy(face.vertices[2]);

        // Transform to world space
        v0.applyMatrix4(modelMatrix);
        v1.applyMatrix4(modelMatrix);
        v2.applyMatrix4(modelMatrix);

        // Calculate centroid and normal
        faceCentroid.copy(v0).add(v1).add(v2).multiplyScalar(1/3);

        const rayDirection = faceCentroid.clone().sub(cameraPos).normalize();
        const maxDistance = cameraPos.distanceTo(faceCentroid);

        // Check if ray hits any geometry before reaching our target face
        let _bVisible = true;

        const ray = new THREE.Ray(cameraPos, rayDirection);
        const hit = geometry.boundsTree.raycastFirst(ray, THREE.SingleSide);

        if (hit && hit.distance < maxDistance - 0.01) {
            _bVisible = false;
        }

        if (_bVisible) {
            visibleFaces.push(faceIndex);
        }

    }

    return visibleFaces;
};

GeometryHelpers.visibleFaceFiltering = (faceIndices, mesh, camera) => {
    if (!camera) camera = ATON.Nav._camera;
    if (!faceIndices) faceIndices = GeometryHelpers.getAllFaceIndices(mesh);

    const geometry = mesh.geometry;
    const modelMatrix = mesh.matrixWorld;
    const cameraPos = camera.getWorldPosition(new THREE.Vector3());
    
    if (!geometry.boundsTree) {
        console.warn('Mesh BVH not computed. Computing now...');
        geometry.computeBoundsTree();
    }

    const visibleFaces = [];
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const faceCentroid = new THREE.Vector3();
    const faceNormal = new THREE.Vector3();
    const viewDirection = new THREE.Vector3();

    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;

    for (const faceIndex of faceIndices) {
        // Change behaviour based on data type
        const face = GeometryHelpers.extractFaceData(faceIndex.index, geometry, true);
        v0.copy(face.vertices[0]);
        v1.copy(face.vertices[1]);
        v2.copy(face.vertices[2]);

        // Transform to world space
        v0.applyMatrix4(modelMatrix);
        v1.applyMatrix4(modelMatrix);
        v2.applyMatrix4(modelMatrix);

        // Calculate centroid and normal
        faceCentroid.copy(v0).add(v1).add(v2).multiplyScalar(1/3);
        faceNormal.crossVectors(
            v1.clone().sub(v0),
            v2.clone().sub(v0)
        ).normalize();

        // Calculate view direction from face to camera
        viewDirection.copy(cameraPos).sub(faceCentroid).normalize();

        // Test if face is facing camera
        if (faceNormal.dot(viewDirection) < 0) {
            continue;
        }

        const rayDirection = faceCentroid.clone().sub(cameraPos).normalize();
        const maxDistance = cameraPos.distanceTo(faceCentroid);

        // Check if ray hits any geometry before reaching our target face
        let _bVisible = true;

        const ray = new THREE.Ray(cameraPos, rayDirection);
        const hit = geometry.boundsTree.raycastFirst(ray, THREE.SingleSide);

        if (hit && hit.distance < maxDistance - 0.01) {
            _bVisible = false;
        }

        if (_bVisible) {
            visibleFaces.push(faceIndex);
        }

    }

    return visibleFaces;
};

GeometryHelpers.visibleFaceFilteringAlt = (faceIndices, mesh, camera) => {
    if (!camera) camera = ATON.Nav._camera;
    if (!faceIndices) faceIndices = GeometryHelpers.getAllFaceIndices(mesh);

    const geometry = mesh.geometry;
    const modelMatrix = mesh.matrixWorld;
    const cameraPos = camera.getWorldPosition(new THREE.Vector3());
    
    // disposeBoundsTreeReal.call(geometry);
    if (!geometry.boundsTree) {
        console.warn('Mesh BVH not computed. Computing now...');
        // geometry.computeBoundsTree();
        computeBoundsTreeReal.call(geometry);
    }

    const visibleFaces = [];
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const faceCentroid = new THREE.Vector3();
    const faceNormal = new THREE.Vector3();
    const viewDirection = new THREE.Vector3();

    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;

    for (const faceIndex of faceIndices) {
        const face = GeometryHelpers.extractFaceData(faceIndex.index, geometry, true);
        v0.copy(face.vertices[0]);
        v1.copy(face.vertices[1]);
        v2.copy(face.vertices[2]);

        // Transform to world space
        v0.applyMatrix4(modelMatrix);
        v1.applyMatrix4(modelMatrix);
        v2.applyMatrix4(modelMatrix);

        // Calculate centroid and normal
        faceCentroid.copy(v0).add(v1).add(v2).multiplyScalar(1/3);
        faceNormal.crossVectors(
            v1.clone().sub(v0),
            v2.clone().sub(v0)
        ).normalize();

        // Calculate view direction from face to camera
        viewDirection.copy(cameraPos).sub(faceCentroid).normalize();

        // Test if face is facing camera
        if (faceNormal.dot(viewDirection) < 0) {
            continue;
        }

        // Ray from camera to centroid
        const raycaster = new THREE.Raycaster(
            cameraPos.clone(),
            faceCentroid.clone().sub(cameraPos).normalize(),
            0.0001, // avoid zero distance hit
            cameraPos.distanceTo(faceCentroid) - 0.0001
        );
        raycaster.firstHitOnly = true;

        const rayDirection = faceCentroid.clone().sub(cameraPos).normalize();
        const maxDistance = cameraPos.distanceTo(faceCentroid);

        raycaster.set(cameraPos, rayDirection);
        raycaster.near = 0.001;
        raycaster.far = maxDistance - 0.001;

        // Raycast against bvh
        const intersections = raycaster.intersectObject(mesh, false);

        // Check if ray hits any geometry before reaching our target face
        let _bVisible = true;

        if (intersections.length > 0) {
            // Check if intersection is closer than our target
            for (const intersection of intersections) {
                if (intersection.distance < maxDistance - 0.001 ) {
                    _bVisible = false;
                    break;
                }
            }
        }

        if (_bVisible) {
            visibleFaces.push(faceIndex);
        }

    }

    return visibleFaces;
};