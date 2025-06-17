/*
THOTH Plugin for ATON - Materials

author: steliosalvanos@gmail.com

===========================================================*/


let Mat = {};


Mat.init = () => {
    Mat.materials   = {};
    Mat.colors      = {};
    Mat.colorsThree = {};

    Mat.addDefaults();
    Mat.addDefaultsThree();
};

Mat.addDefaultsThree = () => {
    // Colors 
    Mat.colorsThree.white  = new THREE.Color(1,1,1);
    Mat.colorsThree.black  = new THREE.Color(0,0,0);
    Mat.colorsThree.green  = new THREE.Color(0,1,0);
    Mat.colorsThree.yellow = new THREE.Color(1,1,0);
    Mat.colorsThree.red    = new THREE.Color(1,0,0);
    Mat.colorsThree.blue   = new THREE.Color(0,0,1);
    Mat.colorsThree.orange = new THREE.Color(1,0.5,0);
};

Mat.addDefaults = () => {
    Mat.colors.red = '#ff0000';
};