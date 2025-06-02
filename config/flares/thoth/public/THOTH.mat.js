/*
THOTH Plugin for ATON - Materials

author: steliosalvanos@gmail.com

===========================================================*/


let Mat = {};


Mat.init = () => {
    Mat.materials = {};
    Mat.colors    = {};

    Mat.addDefaults();
};


Mat.addDefaults = () => {
    // Colors 
    Mat.colors.white  = new THREE.Color(1,1,1);
    Mat.colors.black  = new THREE.Color(0,0,0);
    Mat.colors.green  = new THREE.Color(0,1,0);
    Mat.colors.yellow = new THREE.Color(1,1,0);
    Mat.colors.red    = new THREE.Color(1,0,0);
    Mat.colors.blue   = new THREE.Color(0,0,1);
    Mat.colors.orange = new THREE.Color(1,0.5,0);
};