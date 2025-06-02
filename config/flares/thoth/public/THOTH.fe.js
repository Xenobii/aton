/*
    THOTH Plugin for ATON - Front End

    author: steliosalvanos@gmail.com

===========================================================*/

let FE = {};

// Starting from after HATHOR selection actions
FE.SELACTION_STD    = 4;
FE.SELACTION_BRUSH  = 5;
FE.SELACTION_ERASER = 6;
FE.SELACTION_LASSO  = 7;

FE._actState = FE.SELACTION_STD;

/* 
Init
===========================================================*/

FE.init = async () => {
    while (!THOTH._bRealized) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    FE.PATH_RES_ICONS = ATON.PATH_RES+"icons/";
    FE.uiSetup();
    FE.setupEventHandlers();
}; 

FE.update = () => {
    FE.realTimeEventHandlers();
};

/* 
UI Layout
===========================================================*/

FE.uiSetup = () => {
    FE.uiAddButtonAnnotatorMode("idTopToolbar");
};

FE.uiSetAnnotatorMode = () => {
    $("#idTopToolbar").html("");

    FE.uiAddButtonBack("idTopToolbar");
    FE.uiAddButtonBrush("idTopToolbar");
    FE.uiAddButtonEraser("idTopToolbar");
    FE.uiAddButtonLasso("idTopToolbar");
};

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
            if (FE._actState !== FE.SELACTION_BRUSH) {
                FE.uiSetAnnotatorMode();
                FE.uiSwitchButton("brush", true);
                FE._actState = FE.SELACTION_BRUSH;
                ATON.Nav.setUserControl(false);
            }
            else {
                FE.uiSwitchButton("brush", false);
                FE._actState = FE.SELACTION_STD;
                ATON.Nav.setUserControl(true);
            }
        }
        // Eraser Tool
        if (k === 'w') {
            if (FE._actState !== FE.SELACTION_ERASER) {
                FE.uiSetAnnotatorMode();
                FE.uiSwitchButton("eraser", true);
                FE._actState = FE.SELACTION_ERASER;
                ATON.Nav.setUserControl(false);
            }
            else {
                FE.uiSwitchButton("eraser", false);
                FE._actState = FE.SELACTION_STD;
                ATON.Nav.setUserControl(true);
            }
        }
        // Lasso Tool
        if (k === 'r') {
            if (FE._actState !== FE.SELACTION_LASSO) {
                FE.uiSetAnnotatorMode();
                FE.uiSwitchButton("lasso", true);
                FE._actState = FE.SELACTION_LASSO;
                ATON.Nav.setUserControl(false);
            }
            else {
                FE.uiSwitchButton("lasso", false);
                FE._actState = FE.SELACTION_STD;
                ATON.Nav.setUserControl(true);
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
        if (THOTH._actState !== FE.SELACTION_STD) {
            THOTH.recordState();
        }
        
        // Lasso start
        if (FE._actState === FE.SELACTION_LASSO) {
            THOTH.Toolbox.lassoTool(THOTH.e);
        }
    })

    THOTH.on("MouseMove", () => {
        // Lasso update
        if (FE._actState === FE.SELACTION_LASSO && THOTH._bLeftMouseDown) {
            THOTH.Toolbox.lassoTool(THOTH.e);
        }
    }) 

    THOTH.on("MouseLeftButtonUp", () => {
        // Lasso end
        if (FE._actState === FE.SELACTION_LASSO) {
            THOTH.Toolbox.endLasso();
        }
    })
};

FE.realTimeEventHandlers = () => {
    // Brush 
    if (FE._actState === FE.SELACTION_BRUSH) {
        if (THOTH._bLeftMouseDown) {
            THOTH.Toolbox.brushTool();
        }
    }
    // Eraser
    if (FE._actState === FE.SELACTION_ERASER) {
        if (THOTH._bLeftMouseDown) {
            THOTH.Toolbox.eraserTool();
        }
    }
};

/* 
Buttons
===========================================================*/

FE.uiAddButtonBack = (idcontainer) => {
    FE.uiAddButton(idcontainer, "back", ()=>{
        $("#idTopToolbar").html("");
        ATON.FE.uiBasicSetup();
    }, "back");
};

FE.uiSwitchButton = (iconid, b)=>{
    if (b) $("#btn-"+iconid).addClass("switchedON");
    else $("#btn-"+iconid).removeClass("switchedON");
};

FE.uiAddButtonAnnotatorMode = (idcontainer) => {
    FE.uiAddButton(idcontainer, "next", ()=>{
        FE.uiSetAnnotatorMode();
    }, "next");
};

FE.uiAddButtonBrush = (idcontainer) => {
    FE.uiAddButton(idcontainer, "brush", ()=>{
    }, "brush");
};

FE.uiAddButtonEraser = (idcontainer) => {
    FE.uiAddButton(idcontainer, "eraser", ()=>{
    }, "eraser");
};

FE.uiAddButtonLasso = (idcontainer) => {
    FE.uiAddButton(idcontainer, "lasso", ()=>{
    }, "lasso");
};

