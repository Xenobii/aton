/*
    ATON Annotation Factory

    author: steliosalvanos@gmail.com

===========================================================*/
const { INTERSECTED, NOT_INTERSECTED, CONTAINED } = window.ThreeMeshBVH;


let GeometryHelpers = {};


GeometryHelpers.FLOAT_PREC = 5;

/**
Extract Data from a specific face
@returns {[Int, [Vector3], [Vector3]]} - Face id, indicies and vertices
*/
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

export default GeometryHelpers;