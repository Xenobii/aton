/*
    THOTH Plugin for ATON - Scene management

    author: steliosalvanos@gmail.com

===========================================================*/

let Scene = {};


Scene.init = () => {
    Scene.initRC();
    Scene.sid = Scene.getSceneID();
};

Scene.initRC = async () => {
    const wglopts = {
        antialias: true,
        alpha: true,
    };

    // Renderer
    Scene._renderer = new THREE.WebGLRenderer(wglopts);
    Scene._renderer.setSize(window.innerWidth, window.innerHeight);

    // Raycaster
    Scene._raycaster = new THREE.Raycaster();
    Scene._raycaster.layers.set(ATON.NTYPES.SCENE);
    Scene._raycaster.firstHitOnly = true;

    await Scene.prepareObject();
};

Scene._handleQuery = () => {
    Scene._hits = [];
    
    Scene._raycaster.setFromCamera(ATON._screenPointerCoords, ATON.Nav._camera);
    Scene._raycaster.intersectObjects(ATON._mainRoot.children, true, Scene._hits);

    // Process hits
    const hitsnum = Scene._hits.length;
    if (hitsnum <= 0){
        Scene._queryData = undefined;
        return;
    }

    const h = Scene._hits[0];
    
    Scene._queryData = {};
    Scene._queryData.p  = h.point;
    Scene._queryData.d  = h.distance;
    Scene._queryData.o  = h.object;
    Scene._queryData.uv = h.uv;

    // Compute boundsTree if not computed
    if (!Scene._queryData.o.geometry.boundsTree) {
        Scene._queryData.o.geometry.computeBoundsTree();
        THOTH.log("Computed visible BVH");
    };

    // Normals
    // if (!THOTH._bQueryNormals) return;
    // if (!h.face) return;
    // if (!h.face.normal) return;

    // THOTH._queryDataScene.matrixWorld = new THREE.Matrix3().getNormalMatrix( h.object.matrixWorld );
    // THOTH._queryDataScene.n = h.face.normal.clone().applyMatrix3( THOTH._queryDataScene.matrixWorld ).normalize();
};

Scene.prepareObject = async () => {
    // Polling
    while (!Scene._queryData?.o) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Single object in annotator scene
    Scene.mainMesh = THOTH.Scene._queryData.o;
    
    // Color propertied for face selection
    Scene.mainMesh.material.vertexColors = true;
    Scene.mainMesh.material.needsUpdate  = true;

    // Initialize vertex colors if they don't exist
    if (!Scene.mainMesh.geometry.attributes.color) {
        THOTH.log("Initializing color");
        
        const colorArray = new Float32Array(Scene.mainMesh.geometry.attributes.position.count * 3);
        colorArray.fill(THOTH.Mat.colorsThree.white); // Default white color

        const colorAttr = new THREE.BufferAttribute(colorArray, 3);
        
        Scene.mainMesh.geometry.setAttribute('color', colorAttr);
    }
}

Scene.getSceneID = (sid) => {
    if (!sid) {
        // Get sid directly from url
        const path = window.location.pathname;
        const pathArray = path.split('/');

        sid = String(pathArray[2]+'/'+pathArray[3]);
    };

    return sid;
};

Scene.patchScene = (patch, mode, onComplete) => {
    if (patch === undefined) return;
    if (mode === undefined) mode = ATON.SceneHub.MODE_ADD;

    let sid = ATON.SceneHub.currID;

    let O = {};
    O.data = patch;
    O.mode = mode;

    O.mode = (mode === ATON.SceneHub.MODE_DEL)? "DEL" : "ADD";

    let jstr = JSON.stringify(O);

    $.ajax({
        url: ATON.PATH_RESTAPI2 + "scenes/"+sid,
        type:"PATCH",
        data: jstr,
        contentType:"application/json; charset=utf-8",
        dataType:"json",

        success: (r) => {
            if (onComplete) onComplete();
        }
    });
};