/*
    THOTH Plugin for ATON - Helpers

    author: steliosalvanos@gmail.com

===========================================================*/


let Utils = {};


Utils.setsAreEqual = (a, b) => {
    if (a.size !== b.size) return false;

    // The following is more correct but statistically overkill 
    // for (const item of a) if (!b.has(item)) return false;
    return true;
};

Utils.isPointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

Utils.pointDistance = (pos1, pos2) => {
    const dist = Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) + 
        Math.pow(pos1.y - pos2.y, 2)
    );
    return dist;
};

Utils.rgb2hex = (r, g, b) => {
    componentToHex = (c) => {
        var hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

Utils.hex2rgb = (hex) => {
    // Also normalize
    const r = parseInt(hex.slice(1, 3), 16)/255;
    const g = parseInt(hex.slice(3, 5), 16)/255;
    const b = parseInt(hex.slice(5, 7), 16)/255;
    return {r, g, b};
};

Utils.getJSON = (jsonurl, onLoad)=>{
    fetch(jsonurl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    })
    .then(response => response.json())
    .then(response => {
        if (onLoad) onLoad(response);
    });
};