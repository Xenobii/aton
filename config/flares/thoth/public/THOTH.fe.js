/*
    THOTH Plugin for ATON - Front End

    author: steliosalvanos@gmail.com

===========================================================*/

let FE = {};

// Starting from after HATHOR selection actions
FE.SELACTION_STD    = 1;
FE.SELACTION_EDIT   = 2;

FE.TOOL_NONE   = 0;
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
    
    FE._tool = FE.TOOL_NONE;
    FE.currAnnotationParams = undefined;
    FE.annotationButtons = [];

    FE.toolSizes = {
        brushScale  : 0.0,
        eraserScale : 0.0,
    };
    FE.brushSize  = FE.computeToolRadius(FE.toolSizes.brushScale),
    FE.eraserSize = FE.computeToolRadius(FE.toolSizes.eraserScale),

    FE.setupEventHandlers();
    FE.setupUI();

};

/* 
Event Handlers
===========================================================*/

FE.setupEventHandlers = () => {
    // let el = ATON._renderer.domElement;
    let el = document;

    // Left mouse down
    el.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            THOTH._bLeftMouseDown = true;

            // Record state
            
            // Brush
            if (FE._tool === FE.TOOL_BRUSH) {
                THOTH.Toolbox.brushTool(FE.currAnnotationParams, FE.brushSize);
            }

            // Eraser
            if (FE._tool === FE.TOOL_ERASER) {
                THOTH.Toolbox.eraserTool(FE.currAnnotationParams, FE.eraserSize);
            }

            // Lasso
            if (FE._tool === FE.TOOL_LASSO) {
                THOTH.Toolbox.lassoTool(e);
            }
        }
    });

    // Left mouse up
    el.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            THOTH._bLeftMouseDown = false;

            if (FE._tool === FE.TOOL_LASSO) {
                THOTH.Toolbox.endLasso(FE.currAnnotationParams);
            }
        }
    });

    // Mouse Move
    el.addEventListener('mousemove', (e) => {
        if (THOTH._bLeftMouseDown) {
            // Brush
            if (FE._tool === FE.TOOL_BRUSH) {
                THOTH.Toolbox.brushTool(FE.currAnnotationParams, FE.brushSize);
            }

            // Eraser
            if (FE._tool === FE.TOOL_ERASER) {
                THOTH.Toolbox.eraserTool(FE.currAnnotationParams, FE.eraserSize);
            }

            // Lasso
            if (FE._tool === FE.TOOL_LASSO) {
                THOTH.Toolbox.lassoTool(e);
            }
        }
    });

    // Key Press
    el.addEventListener('keydown', (k) => {
        // Increase tool radius
        if (k.key === '['){
            // Brush
            if (FE._tool === FE.TOOL_BRUSH) {
                FE.toolSizes.brushScale = FE.toolSizes.brushScale - 1;
                FE.brushSize  = FE.computeToolRadius(FE.toolSizes.brushScale);
                FE.toolboxPane.refresh();
            }
            // Eraser
            if (FE._tool === FE.TOOL_ERASER) {
                FE.toolSizes.eraserScale = FE.toolSizes.eraserScale - 1;
                FE.eraserSize  = FE.computeToolRadius(FE.toolSizes.eraserScale);
                FE.toolboxPane.refresh();
            }
        }
        
        // Dencrease tool radius
        if (k.key === ']'){
            if (FE._tool === FE.TOOL_BRUSH) {
                FE.toolSizes.brushScale = FE.toolSizes.brushScale + 1;
                FE.brushSize  = FE.computeToolRadius(FE.brushScale);
                FE.toolboxPane.refresh();
            }
            if (FE._tool === FE.TOOL_ERASER) {
                FE.toolSizes.eraserScale = FE.toolSizes.eraserScale + 1;
                FE.eraserSize  = FE.computeToolRadius(FE.toolSizes.eraserScale);
                FE.toolboxPane.refresh();
            }
        }
    });

};

FE.computeToolRadius = (r) => {
    return (0.25 * 1.2**r);
};

/* 
UI Setup
===========================================================*/

FE.setupUI =() => {
    // Create new containers
    const TopRightContainer = document.createElement('div');
    TopRightContainer.id = 'guicanvas';
    TopRightContainer.style.position = 'absolute';
    TopRightContainer.style.top = '0px';          
    TopRightContainer.style.right = '0px';   
    TopRightContainer.style.zIndex = '120';
    document.body.appendChild(TopRightContainer);

    const bottomRightContainer = document.createElement('div');
    bottomRightContainer.id = 'guicanvas';
    bottomRightContainer.style.position = 'absolute';
    bottomRightContainer.style.bottom = '50px';          
    bottomRightContainer.style.right = '0px';   
    bottomRightContainer.style.zIndex = '120';
    document.body.appendChild(bottomRightContainer);

    const bottomLeftContainer = document.createElement('div');
    bottomLeftContainer.id = 'guicanvas';
    bottomLeftContainer.style.position = 'absolute';
    bottomLeftContainer.style.bottom = '50px';          
    bottomLeftContainer.style.left = '0px';   
    bottomLeftContainer.style.zIndex = '120';
    document.body.appendChild(bottomLeftContainer);

    // Toolbox
    FE.toolboxPane = new Pane({
        container: bottomLeftContainer,
        title: 'Toolbox',
        expanded: true,
    });

    // Layer Management
    FE.layerManagementPane = new Pane({
        container: TopRightContainer, 
        title: 'Layer Management',
        expanded: true,
    });

    // Quick Select Layer Pane
    FE.layerSelectionPane = new Pane({
        container: TopRightContainer,
        title: 'Annotations',
        expanded: true,
    });
    
    // Details Pane
    FE.detailsPane = new Pane({
        container: bottomRightContainer,
        title: 'Annotation details',
        expanded: true,
    });

    FE.exportPane = new Pane({
        container: bottomRightContainer,
        title: 'Export Settings',
        expanded: true,
    });

    FE.setupToolboxPane();
    FE.setupLayerManagementPane();
    FE.setupExportPane();
};

FE.setupToolboxPane = () => {
    // Brush
    const btnBrush = FE.toolboxPane.addButton({
        title: 'Brush',
    });
    btnBrush.on('click', () => {
        if (FE._tool !== FE.TOOL_BRUSH) {
            // Disable Nav
            ATON.Nav.setUserControl(false);
            
            FE._tool = FE.TOOL_BRUSH;
            FE.updateToolRadiusUI();
        }
    });

    // Eraser
    const btnEraser = FE.toolboxPane.addButton({
        title: 'Eraser',
    });
    btnEraser.on('click', () => {
        if (FE._tool !== FE.TOOL_ERASER) {
            // Disable Nav
            ATON.Nav.setUserControl(false);
            
            FE._tool = FE.TOOL_ERASER;
            FE.updateToolRadiusUI();
        }
    });

    // Lasso
    const btnLasso = FE.toolboxPane.addButton({
        title: 'Lasso',
    });
    btnLasso.on('click', () => {
        if (FE._tool !== FE.TOOL_LASSO) {
            // Disable Nav
            ATON.Nav.setUserControl(false);
            
            FE._tool = FE.TOOL_LASSO;
            FE.updateToolRadiusUI();
        }
    });

    // None
    const btnNone = FE.toolboxPane.addButton({
        title: 'None',
    });
    btnNone.on('click', () => {
        if (FE._tool !== FE.TOOL_NONE) {
            // Enable Nav
            ATON.Nav.setUserControl(true);

            FE._tool = FE.TOOL_NONE;
            FE.updateToolRadiusUI();
        }
    });
};

FE.updateToolRadiusUI = () => {
    if (FE.toolboxPane.brushScale)  FE.toolboxPane.brushScale.dispose();
    if (FE.toolboxPane.eraserScale) FE.toolboxPane.eraserScale.dispose();
    
    if (FE._tool === FE.TOOL_BRUSH) {
        FE.toolboxPane.brushScale = FE.toolboxPane.addBinding(FE.toolSizes, 'brushScale', {
            min: -10,
            max:  10,
            step: 1,
        });
    }
    if (FE._tool === FE.TOOL_ERASER) {
        FE.toolboxPane.eraserScale = FE.toolboxPane.addBinding(FE.toolSizes, 'eraserScale', {
            min: -10,
            max:  10,
            step: 1,
        });
    }

    // Event listener for changes
    // Brush
    if (FE.toolboxPane.brushScale) {
        FE.toolboxPane.brushScale.on('change', (e) => {
            FE.brushSize = FE.computeToolRadius(FE.toolSizes.brushScale);
        });
    }
    // Eraser 
    if (FE.toolboxPane.eraserScale) {
        FE.toolboxPane.eraserScale.on('change', (e) => {
            FE.eraserSize = FE.computeToolRadius(FE.toolSizes.eraserScale);
        });
    }
};

FE.setupLayerManagementPane = () => {
    const addAnnotationBtn = FE.layerManagementPane.addButton({
        title: "New Annotation",
    });

    addAnnotationBtn.on('click', () => {
        THOTH.createNewAnnotation();
    });
};

FE.createNewAnnotationUI = (annotationParams) => {
    const newAnnotation = FE.layerSelectionPane.addButton({
        title: annotationParams.name,
    });

    FE.annotationButtons.splice(annotationParams.index - 1, 0, newAnnotation);
    
    // Event handler
    newAnnotation.on('click', () => {
        // Switch to current annotation
        FE.currAnnotationParams = annotationParams;
        FE.setupDetailsUI(annotationParams);
    });
};

FE.setupDetailsUI = (annotationParams) => {
    if (FE.detailTabs) FE.detailTabs.dispose();
    
    FE.detailTabs = FE.detailsPane.addTab({
        pages: [
            {title: "General"},
            {title: "Advanced"},
        ],
    });

    // Attributes
    FE.name    = FE.detailTabs.pages[0].addBinding(annotationParams, 'name'); 
    FE.visible = FE.detailTabs.pages[0].addBinding(annotationParams, 'visible');
    FE.color   = FE.detailTabs.pages[0].addBinding(annotationParams, 'highlightColor', {
        picker: 'inline',
        expanded: true,
    });

    // Buttons
    FE.delete  = FE.detailTabs.pages[0].addButton({
        title: "Delete Annotation",
    });

    // Event listeners
    FE.name.on('change', () => {
        THOTH.editAnnotationName(annotationParams);
    });
    FE.visible.on('change', () => {
        THOTH.updateVisibility();
    });
    FE.color.on('change', () => {
        THOTH.updateVisibility();
    });
    FE.delete.on('click', () => {
        THOTH.deleteAnnotation(annotationParams);
    });
};

FE.setupExportPane = () => {
    const exportAnnotationBtn = FE.exportPane.addButton({
        title: "Export Current Annotation",
    });

    exportAnnotationBtn.on('click', () => {
        THOTH.exportAnnotations();
    });
};