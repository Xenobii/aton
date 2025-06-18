/*
    THOTH Plugin for ATON - Custom UI creation - EXPERIMENTAL

    author: steliosalvanos@gmail.com

===========================================================*/


let UI = {};


function getWindowDocument() {
    const globalObj = globalThis;
    return globalObj.document;
};

function createDefaultWrapperElement(document) {
    const element = document.createElement('div');
    element.classList.add(ClassName('defaultWrapperElement')());
    if (document.body) {
        document.body.appendChild(element);
    }
    return element;
};

UI.folderStyle = {
    // Placeholder
    textAlign: 'center',
    position: 'absolute',
    top: '0px',
    right: '0px',
    width: '220px',
    backgroundColor: '#606060',
    border: '1px solid #333',
    borderRadius: '6px',
    boxShadow: '2px 2px 10px rgba(0,0,0,0.2)',
    cursor: 'move',
    userSelect: 'none',
    zIndex: '1000',
    padding: '2px',
};

UI.buttonStyle = {
    // General
    display: 'inline-block',
    padding: '5px',
    margin: '10px',
    border: 'none',

    // Text
    fontSize: '12px',
    fontWeight: '500',
    textAlign: 'center',
    textDecoration: 'none',

    // Colors
    color: '#606060',

    // Hover
    // ':hover': {
    //     background: 'linear-gradient(to bottom, #3a7cff, #0052ff)',
    //     boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    //     transform: 'translateY(-1px)'
    // }
}

UI.headerStyle = {
    marginBottom: '0px',
    cursor: 'pointer',
    fontSize: '12px',
    // fontFamily: 'Helvetica',
    backgroundColor: '#303030'
};

UI.contentStyle = {
    display: 'none',
    overflow: 'hidden',
}

class UIElement {
    constructor(title, parent = document.body) {
        this.title  = title;
        this.parent = parent;
    }
}

class Folder extends UIElement {
    constructor(title, content, parent = document.body) {
        super(title, parent);
        
        this.content = content;

        this.folderElement = document.createElement('div');
        this.headerElement = document.createElement('div');
        this.bodyElement   = document.createElement('div');

        this.isDragging = false;

        this.offsetX = 0;
        this.offsetY = 0;

        this.init();
    }
    init() {
        this.build();
        this.style();
        this.event();
        this.parent.appendChild(this.folderElement);
    }
    build() {
        this.headerElement.textContent = this.title;
        // this.bodyElement.innerHTML = this.content;

        this.folderElement.appendChild(this.headerElement);
        this.folderElement.appendChild(this.bodyElement);
    }
    style() {
        Object.assign(this.folderElement.style, UI.folderStyle);
        Object.assign(this.headerElement.style, UI.headerStyle);
        Object.assign(this.bodyElement.style, UI.contentStyle);
    }
    event() {
        // Expand logic
        this.headerElement.onclick = (e) => {
            e.stopPropagation();
            this.bodyElement.style.display = 
                this.bodyElement.style.display === 'none' ? 'block' : 'none';
        }

        // Drag Logic later
    }
    addButton(btnTitle, btnOnEvent) {
        const button = new Button(btnTitle, btnOnEvent, this.bodyElement);
        return button;
    }
};

class Button extends UIElement {
    constructor(title, onEvent, parent = document.body) {
        super(title, parent);

        this.onEvent = onEvent;

        this.buttonElement = document.createElement('button');

        this.buttonElement.textContent = this.title;
        this.buttonElement.onclick = this.onEvent;
        
        this.init();
    }
    init() {
        this.style();
        this.parent.appendChild(this.buttonElement);
    }
    style() {
        const styleOptions = UI.buttonStyle;
        styleOptions.marginTop += this.parent.marginTop;
        Object.assign(this.buttonElement.style , styleOptions);
    }
};

class Slider extends UIElement {
    constructor(title, parent = document.body) {
        super(title, parent);
    }
}

class Bool extends UIElement {
    constructor(title, parent = document.body) {
        super(title, parent);
    }
}

UI.Folder = Folder;
UI.Button = Button;