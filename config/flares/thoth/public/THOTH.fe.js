/*
    THOTH Plugin for ATON - Front End

    author: steliosalvanos@gmail.com

===========================================================*/

let FE = {};

// Starting from after HATHOR selection actions
FE.SELACTION_STD    = 1;
FE.SELACTION_EDIT   = 2;

FE.TOOL_BRUSH  = 1;
FE.TOOL_ERASER = 2;
FE.TOOL_LASSO  = 3;

FE._actState = FE.SELACTION_STD;
FE._tool     = undefined;

/* 
Init
===========================================================*/

FE.init = async () => {
    while (!THOTH._bRealized) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    FE.PATH_RES_ICONS = ATON.PATH_RES+"icons/";
    FE.uiSetup();
    FE.datGUISetup();
    FE.setupEventHandlers();

}; 

FE.update = () => {
    FE.realTimeEventHandlers();
};

/* 
UI Layout
===========================================================*/

FE.uiSetup = () => {
    // FE.uiAddButtonAnnotatorMode("idTopToolbar");
};

FE.datGUISetup =() => {
    // Create a new container
    const guiContainer = document.createElement('div');
    guiContainer.id = 'guicanvas';
    guiContainer.style.position = 'absolute';
    guiContainer.style.top = '0px';          
    guiContainer.style.right = '0px';   
    guiContainer.style.zIndex = '120';
    document.body.appendChild(guiContainer);

    // Apply styling options (css)
    FE.datGUIStyle();

    // Attach dat gui
    FE.gui = new dat.GUI({ autoPlace: false });
    guiContainer.appendChild(FE.gui.domElement);

    const actions = {
        create: () => {
            THOTH.createAnnotation()
        }
    };

    // Add annotation folder
    FE.annotationFolder = FE.gui.addFolder('Annotations');
    FE.annotationFolder
        .add(actions, 'create')
        .name('Create Annotation');

    // FE.annotationFolder.open();  // Open it :)
};

FE.datGUIStyle = () => {
    const style = document.createElement('style');
    style.innerHTML = `
    .dg {
    font: 11px 'Lucida Grande', sans-serif;
    line-height: 1;
    color: #eee;
    }

    .dg .cr {
    clear: both;
    padding: 0;
    height: 27px;
    line-height: 27px;
    overflow: hidden;
    }

    .dg .property-name {
    float: left;
    width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    }

    .dg .c input[type="text"],
    .dg .c select {
    float: right;
    width: 58%;
    margin-top: 2px;
    transform: scale(1);
    }

    .dg input[type="checkbox"] {
    float: right;
    margin-top: 4px;
    margin-right: 0px;
    transform: scale(0.6);
    }
    `;
    document.head.appendChild(style);

};

/* 
Annotation Management
===========================================================*/

FE.createAnnotationFolder = (annotation) => {
    const label = `Annotation ${THOTH.annotations.length}`;
    const currAnnotationFolder = FE.annotationFolder.addFolder(label);
    annotation.name = label;

    // Name editor
    currAnnotationFolder
        .add(annotation, 'name')
        .name('Name')
        .onChange((newName) => {THOTH.editAnnotationName(annotation, newName)});
    
    // Visibility toggle
    currAnnotationFolder
        .add(annotation, 'visible')
        .name('Visible')
        .onChange((isVisible) => THOTH.toggleVisibility(annotation, isVisible));
    // Color Change

    // Delete annotation
    const actions = {
        delete: () => {
            FE.annotationFolder.removeFolder(currAnnotationFolder);
            // THOTH.annotations[THOTH.annotations.length]
        },
        edit: () => {
            THOTH.editSelection(annotation);
        },
        apply: () => {
            THOTH.applyAnnotation(annotation);
        }
    };
    currAnnotationFolder
        .add(actions, 'edit')
        .name('Edit Selection');
    
    currAnnotationFolder
        .add(actions, 'apply')
        .name('Apply Annotation')
    
    currAnnotationFolder
        .add(actions, 'delete')
        .name('Delete Annotation');
};

FE.uiSetAnnotatorMode = () => {
    $("#idTopToolbar").html("");

    FE.uiAddButtonBrush("idTopToolbar");
    FE.uiAddButtonEraser("idTopToolbar");
    FE.uiAddButtonLasso("idTopToolbar");
};

FE.uiSetDefaultMode = () => {
    $("#idTopToolbar").html("");
};  

/* 
Event Handlers
===========================================================*/

FE.setupEventHandlers = () => {
    THOTH.on("KeyPress", (k) => {
        // Annotator UI
        if (k === 'j') {
            FE.uiSetAnnotatorMode();
        }
        // Brush Tool
        if (k === 'q') {
            if (FE._actState === FE.SELACTION_EDIT) {
                if (FE._tool !== FE.TOOL_BRUSH) {
                    FE.uiSetAnnotatorMode();
                    FE.uiSwitchButton("brush", true);
                    FE.uiSwitchButton("eraser", false);
                    FE.uiSwitchButton("lasso", false);
                    
                    ATON.Nav.setUserControl(false);
                    
                    FE._tool = FE.TOOL_BRUSH;
                }
                else {
                    FE.uiSwitchButton("brush", false);
                    ATON.Nav.setUserControl(true);
                    FE._tool = undefined;
                }
            }
        }
        // Eraser Tool
        if (k === 'w') {
            if (FE._actState === FE.SELACTION_EDIT) {
                if (FE._tool !== FE.TOOL_ERASER) {
                    FE.uiSwitchButton("brush", false);
                    FE.uiSwitchButton("eraser", true);
                    FE.uiSwitchButton("lasso", false);
                    
                    ATON.Nav.setUserControl(false);
                    
                    FE._tool = FE.TOOL_ERASER;
                }
                else {
                    FE.uiSwitchButton("eraser", false);
                    ATON.Nav.setUserControl(true);
                    FE._tool = undefined;
                }
            }
        }
        // Lasso Tool
        if (k === 'r') {
            if (FE._actState === FE.SELACTION_EDIT) {
                if (FE._tool !== FE.TOOL_LASSO) {
                    FE.uiSwitchButton("brush", false);
                    FE.uiSwitchButton("eraser", false);
                    FE.uiSwitchButton("lasso", true);

                    ATON.Nav.setUserControl(false);

                    FE._tool = FE.TOOL_LASSO;
                }
                else {
                    FE.uiSwitchButton("lasso", false);
                    ATON.Nav.setUserControl(true);
                    FE._tool = undefined;
                }
            }
        }
        // Decrease brush radius
        if (k === '[') {
            FE.uiSetAnnotatorMode();
            THOTH.Toolbox.brushRadius -= 1;
            THOTH.Toolbox.changeSUISphere();
        }
        // Increase brush radius
        if (k === ']') {
            FE.uiSetAnnotatorMode();
            THOTH.Toolbox.brushRadius += 1;
            THOTH.Toolbox.changeSUISphere();
        }
        // Undo
        if (k === 'z') {
            THOTH.undo();
        }
        // Redo
        if (k === 'y') {
            THOTH.redo();
        }

    })

    THOTH.on("MouseLeftButtonDown", () => {
        if (FE._actState === FE.SELACTION_EDIT) {
            THOTH.recordState();

            // Lasso start
            if (FE._tool === FE.TOOL_LASSO) {
                THOTH.Toolbox.lassoTool(THOTH.e);
            }
        }
    })

    THOTH.on("MouseMove", () => {
        if (FE._actState === FE.SELACTION_EDIT) {
            // Lasso update
            if (FE._tool === FE.TOOL_LASSO && THOTH._bLeftMouseDown) {
                THOTH.Toolbox.lassoTool(THOTH.e);
            }
        }
    }) 

    THOTH.on("MouseLeftButtonUp", () => {
        if (FE._actState === FE.SELACTION_EDIT) {
            // Lasso end
            if (FE._tool === FE.TOOL_LASSO) {
                THOTH.Toolbox.endLasso();
            }
        }
    })
};

FE.realTimeEventHandlers = () => {
    if (FE._actState === FE.SELACTION_EDIT) {
        // Brush 
        if (FE._tool === FE.TOOL_BRUSH) {
            if (THOTH._bLeftMouseDown) {
                THOTH.Toolbox.brushTool();
            }
        }
        // Eraser
        if (FE._tool === FE.TOOL_ERASER) {
            if (THOTH._bLeftMouseDown) {
                THOTH.Toolbox.eraserTool();
            }
        }
    }
};

FE.disableTools = () => {
    FE._tool = undefined;

    FE.uiSwitchButton("brush", false);
    FE.uiSwitchButton("eraser", false);
    FE.uiSwitchButton("lasso", false);
};

/* 
Buttons
===========================================================*/

FE.uiAddButton = (idcontainer, icon, onPress, tooltip)=>{
    let iconurl;
    let iconid;

    if (icon.endsWith(".png")){
        iconurl = icon;
        iconid  = icon.slice(0,-4);
    }
    else {
        // Temporary: replace with standard res icons
        iconurl = FE.PATH_RES_ICONS+icon+".png";
        iconid  = icon;
    }

    let elid = "btn-"+iconid;
    //let htmlcode = "<div id='"+elid+"' class='atonBTN' ><img src='"+iconurl+"'></div>";
    let el = $("<div id='"+elid+"' class='atonBTN' ><img src='"+iconurl+"'></div>");
    
    $("#"+idcontainer).append(el);

    if (onPress) el.click( onPress ); //$("#"+elid).click( onPress );
    if (tooltip) el.attr("title", tooltip); //$("#"+elid).attr("title", tooltip);
};

FE.uiSwitchButton = (iconid, b)=>{
    if (b) $("#btn-"+iconid).addClass("switchedON");
    else $("#btn-"+iconid).removeClass("switchedON");
};

FE.uiAddButtonUndo = (idcontainer) => {
    FE.uiAddButton(idcontainer, "undo", ()=>{
        // Logic
    }, "undo");
};

FE.uiAddButtonRedo = (idcontainer) => {
    FE.uiAddButton(idcontainer, "redo", ()=>{
        // Logic
    }, "redo");
};

FE.uiAddButtonBrush = (idcontainer) => {
    FE.uiAddButton(idcontainer, "brush", ()=>{
        if (FE._actState === FE.SELACTION_EDIT) {
            if (FE._tool !== FE.TOOL_BRUSH) {
                FE.uiSwitchButton("brush", true);
                FE.uiSwitchButton("eraser", false);
                FE.uiSwitchButton("lasso", false);

                ATON.Nav.setUserControl(false);
                
                FE._tool = FE.TOOL_BRUSH;
            }
            else {
                FE.uiSwitchButton("brush", false);
                ATON.Nav.setUserControl(true);
                FE._tool = undefined;
            }
        }
    }, "brush");
};

FE.uiAddButtonEraser = (idcontainer) => {
    FE.uiAddButton(idcontainer, "eraser", ()=>{
        if (FE._actState === FE.SELACTION_EDIT) {
            if (FE._tool !== FE.TOOL_ERASER) {
                FE.uiSwitchButton("brush", false);
                FE.uiSwitchButton("eraser", true);
                FE.uiSwitchButton("lasso", false);

                ATON.Nav.setUserControl(false);

                FE._tool = FE.TOOL_ERASER;
            }
            else {
                FE.uiSwitchButton("eraser", false);
                ATON.Nav.setUserControl(true);
                FE._tool = undefined;
            }
        }
    }, "eraser");
};

FE.uiAddButtonLasso = (idcontainer) => {
    FE.uiAddButton(idcontainer, "lasso", ()=>{
        if (FE._actState === FE.SELACTION_EDIT) {
            if (FE._tool !== FE.TOOL_LASSO) {
                FE.uiSwitchButton("brush", false);
                FE.uiSwitchButton("eraser", false);
                FE.uiSwitchButton("lasso", true);

                ATON.Nav.setUserControl(false);

                FE._tool = FE.TOOL_LASSO;
            }
            else {
                FE.uiSwitchButton("lasso", false);
                ATON.Nav.setUserControl(true);
                FE._tool = undefined;
            }
        }
    }, "lasso");
};