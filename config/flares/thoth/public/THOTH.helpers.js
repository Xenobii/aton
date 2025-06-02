/*
    THOTH Plugin for ATON - Helpers

    author: steliosalvanos@gmail.com

===========================================================*/


let Helpers = {};


Helpers.setsAreEqual = (a, b) => {
    if (a.size !== b.size) return false;

    // The following is more correct but statistically overkill 
    // for (const item of a) if (!b.has(item)) return false;
    return true;
};

Helpers.isPointInPolygon = (point, polygon) => {
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

Helpers.pointDistance = (pos1, pos2) => {
    const dist = Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) + 
        Math.pow(pos1.y - pos2.y, 2)
    );
    return dist;
};