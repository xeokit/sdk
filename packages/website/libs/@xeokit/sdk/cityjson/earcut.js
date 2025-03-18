// Original algorithm by https://github.com/mapbox/earcut
//
// Ported to TypeScript by Ikaros Kappler
// @date 2020-12-08
;
export const earcut = (() => {
    /**
     * Nodes of a linked list, each node representing a vertex of a ring (a polygon).
     */
    class Node {
        i;
        x;
        y;
        prev;
        next;
        z;
        prevZ;
        nextZ;
        steiner;
        constructor(i, x, y) {
            // vertex index in coordinates array
            this.i = i;
            // vertex coordinates
            this.x = x;
            this.y = y;
            // previous and next vertex nodes in a polygon ring
            this.prev = null;
            this.next = null;
            // z-order curve value
            this.z = null;
            // previous and next nodes in z-order
            this.prevZ = null;
            this.nextZ = null;
            // indicates whether this is a steiner point
            this.steiner = false;
        }
    }
    ;
    const earcut = (data, holeIndices, dim = 2) => {
        dim = dim || 2;
        const hasHoles = holeIndices && holeIndices.length > 0;
        const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
        let outerNode = linkedList(data, 0, outerLen, dim, true);
        const triangles = []; // [t0a, t0b, t0c,  t1a, t2a, t3a, ... ]
        if (!outerNode || outerNode.next === outerNode.prev)
            return triangles;
        let minX;
        let minY;
        let maxX;
        let maxY;
        let x;
        let y;
        let invSize;
        if (hasHoles) {
            outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
        }
        // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
        // TODO: use Bounds class for calculation?
        if (data.length > 80 * dim) {
            minX = maxX = data[0];
            minY = maxY = data[1];
            for (var i = dim; i < outerLen; i += dim) {
                x = data[i];
                y = data[i + 1];
                if (x < minX)
                    minX = x;
                if (y < minY)
                    minY = y;
                if (x > maxX)
                    maxX = x;
                if (y > maxY)
                    maxY = y;
            }
            // minX, minY and invSize are later used to transform coords into integers for z-order calculation
            invSize = Math.max(maxX - minX, maxY - minY);
            invSize = invSize !== 0 ? 1 / invSize : 0;
        }
        earcutLinked(outerNode, triangles, dim, minX, minY, invSize);
        return triangles;
    };
    // create a circular doubly linked list from polygon points in the specified winding order
    const linkedList = (data, start, end, dim, clockwise) => {
        var i;
        var last;
        if (clockwise === (signedArea(data, start, end, dim) > 0)) {
            for (i = start; i < end; i += dim) {
                last = insertNode(i, data[i], data[i + 1], last);
            }
        }
        else {
            for (i = end - dim; i >= start; i -= dim) {
                last = insertNode(i, data[i], data[i + 1], last);
            }
        }
        if (last && equals(last, last.next)) {
            removeNode(last);
            last = last.next;
        }
        return last;
    };
    // eliminate colinear or duplicate points
    const filterPoints = (start, end) => {
        if (!start)
            return start;
        if (!end)
            end = start;
        // Remember starting node
        let p = start;
        let again = false;
        do {
            // TODO: move into 'else' branch?
            again = false;
            if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
                removeNode(p);
                p = end = p.prev;
                if (p === p.next)
                    break;
                again = true;
            }
            else {
                p = p.next;
            }
        } while (again || p !== end);
        return end;
    };
    // main ear slicing loop which triangulates a polygon (given as a linked list)
    const earcutLinked = (ear, triangles, dim, minX, minY, invSize, pass) => {
        if (!ear)
            return;
        // interlink polygon nodes in z-order
        if (!pass && invSize) {
            indexCurve(ear, minX, minY, invSize);
        }
        let stop = ear;
        let prev;
        let next;
        // iterate through ears, slicing them one by one
        while (ear.prev !== ear.next) {
            prev = ear.prev;
            next = ear.next;
            if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
                // cut off the triangle
                triangles.push(prev.i / dim);
                triangles.push(ear.i / dim);
                triangles.push(next.i / dim);
                removeNode(ear);
                // skipping the next vertex leads to less sliver triangles
                ear = next.next;
                stop = next.next;
                continue;
            }
            ear = next;
            // if we looped through the whole remaining polygon and can't find any more ears
            if (ear === stop) {
                // try filtering points and slicing again
                if (!pass) {
                    earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);
                    // if this didn't work, try curing all small self-intersections locally
                }
                else if (pass === 1) {
                    ear = cureLocalIntersections(filterPoints(ear), triangles, dim);
                    earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);
                    // as a last resort, try splitting the remaining polygon into two
                }
                else if (pass === 2) {
                    splitEarcut(ear, triangles, dim, minX, minY, invSize);
                }
                break;
            }
        }
    }; // END earcutLinked
    // check whether a polygon node forms a valid ear with adjacent nodes
    const isEar = (ear) => {
        const a = ear.prev;
        const b = ear;
        const c = ear.next;
        if (area(a, b, c) >= 0)
            return false; // reflex, can't be an ear
        // now make sure we don't have other points inside the potential ear
        var p = ear.next.next;
        while (p !== ear.prev) {
            if (pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
                area(p.prev, p, p.next) >= 0)
                return false;
            p = p.next;
        }
        return true;
    };
    const isEarHashed = (ear, minX, minY, invSize) => {
        var a = ear.prev;
        var b = ear;
        var c = ear.next;
        if (area(a, b, c) >= 0)
            return false; // reflex, can't be an ear
        // triangle bbox; min & max are calculated like this for speed
        // TODO: use Triangle.bounds
        var minTX = a.x < b.x ? (a.x < c.x ? a.x : c.x) : (b.x < c.x ? b.x : c.x), minTY = a.y < b.y ? (a.y < c.y ? a.y : c.y) : (b.y < c.y ? b.y : c.y), maxTX = a.x > b.x ? (a.x > c.x ? a.x : c.x) : (b.x > c.x ? b.x : c.x), maxTY = a.y > b.y ? (a.y > c.y ? a.y : c.y) : (b.y > c.y ? b.y : c.y);
        // z-order range for the current triangle bbox;
        var minZ = zOrder(minTX, minTY, minX, minY, invSize), maxZ = zOrder(maxTX, maxTY, minX, minY, invSize);
        var p = ear.prevZ, n = ear.nextZ;
        // look for points inside the triangle in both directions
        while (p && p.z >= minZ && n && n.z <= maxZ) {
            if (p !== ear.prev && p !== ear.next &&
                // TODO: use Triangle.utils.pointIsInTriangle
                pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
                area(p.prev, p, p.next) >= 0)
                return false;
            p = p.prevZ;
            if (n !== ear.prev && n !== ear.next &&
                // TODO: use Triangle.utils.pointIsInTriangle
                pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, n.x, n.y) &&
                area(n.prev, n, n.next) >= 0)
                return false;
            n = n.nextZ;
        }
        // look for remaining points in decreasing z-order
        while (p && p.z >= minZ) {
            if (p !== ear.prev && p !== ear.next &&
                // TODO: use Triangle.utils.pointIsInTriangle
                pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
                area(p.prev, p, p.next) >= 0)
                return false;
            p = p.prevZ;
        }
        // look for remaining points in increasing z-order
        while (n && n.z <= maxZ) {
            if (n !== ear.prev && n !== ear.next &&
                // TODO: use Triangle.utils.pointIsInTriangle
                pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, n.x, n.y) &&
                area(n.prev, n, n.next) >= 0)
                return false;
            n = n.nextZ;
        }
        return true;
    };
    // go through all polygon nodes and cure small local self-intersections
    const cureLocalIntersections = (start, triangles, dim) => {
        let p = start;
        do {
            let a = p.prev;
            let b = p.next.next;
            if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
                triangles.push(a.i / dim);
                triangles.push(p.i / dim);
                triangles.push(b.i / dim);
                // remove two nodes involved
                removeNode(p);
                removeNode(p.next);
                p = start = b;
            }
            p = p.next;
        } while (p !== start);
        return filterPoints(p);
    };
    // try splitting polygon into two and triangulate them independently
    const splitEarcut = (start, triangles, dim, minX, minY, invSize) => {
        // look for a valid diagonal that divides the polygon into two
        let a = start;
        do {
            let b = a.next.next;
            while (b !== a.prev) {
                if (a.i !== b.i && isValidDiagonal(a, b)) {
                    // split the polygon in two by the diagonal
                    var c = splitPolygon(a, b);
                    // filter colinear points around the cuts
                    a = filterPoints(a, a.next);
                    c = filterPoints(c, c.next);
                    // run earcut on each half
                    earcutLinked(a, triangles, dim, minX, minY, invSize);
                    earcutLinked(c, triangles, dim, minX, minY, invSize);
                    return;
                }
                b = b.next;
            }
            a = a.next;
        } while (a !== start);
    };
    // link every hole into the outer loop, producing a single-ring polygon without holes
    const eliminateHoles = (data, holeIndices, outerNode, dim) => {
        const queue = [];
        let i;
        const len = holeIndices.length;
        let start;
        let end;
        let list;
        for (i = 0; i < len; i++) {
            start = holeIndices[i] * dim;
            end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
            list = linkedList(data, start, end, dim, false);
            if (list === list.next)
                list.steiner = true;
            queue.push(getLeftmost(list));
        }
        queue.sort(compareX);
        // process holes from left to right
        for (i = 0; i < queue.length; i++) {
            eliminateHole(queue[i], outerNode);
            outerNode = filterPoints(outerNode, outerNode.next);
        }
        return outerNode;
    };
    const compareX = (a, b) => {
        return a.x - b.x;
    };
    // find a bridge between vertices that connects hole with an outer ring and and link it
    const eliminateHole = (hole, outerNode) => {
        var bridge = findHoleBridge(hole, outerNode);
        if (!bridge) {
            return outerNode;
        }
        var bridgeReverse = splitPolygon(bridge, hole);
        // filter collinear points around the cuts
        var filteredBridge = filterPoints(bridge, bridge.next);
        filterPoints(bridgeReverse, bridgeReverse.next);
        // Check if input node was removed by the filtering
        return outerNode === bridge ? filteredBridge : outerNode;
        // }
    };
    // David Eberly's algorithm for finding a bridge between hole and outer polygon
    const findHoleBridge = (hole, outerNode) => {
        let p = outerNode;
        let hx = hole.x;
        let hy = hole.y;
        let qx = -Infinity;
        let m;
        // find a segment intersected by a ray from the hole's leftmost point to the left;
        // segment's endpoint with lesser x will be potential connection point
        do {
            if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
                var x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
                if (x <= hx && x > qx) {
                    qx = x;
                    if (x === hx) {
                        if (hy === p.y)
                            return p;
                        if (hy === p.next.y)
                            return p.next;
                    }
                    m = p.x < p.next.x ? p : p.next;
                }
            }
            p = p.next;
        } while (p !== outerNode);
        if (!m) {
            return null;
        }
        if (hx === qx) {
            return m; // hole touches outer segment; pick leftmost endpoint
        }
        // look for points inside the triangle of hole point, segment intersection and endpoint;
        // if there are no points found, we have a valid connection;
        // otherwise choose the point of the minimum angle with the ray as connection point
        let stop = m;
        let mx = m.x;
        let my = m.y;
        let tanMin = Infinity;
        let tan;
        p = m;
        do {
            if (hx >= p.x && p.x >= mx && hx !== p.x &&
                pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
                tan = Math.abs(hy - p.y) / (hx - p.x); // tangential
                if (locallyInside(p, hole) &&
                    (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
                    m = p;
                    tanMin = tan;
                }
            }
            p = p.next;
        } while (p !== stop);
        return m;
    };
    // whether sector in vertex m contains sector in vertex p in the same coordinates
    const sectorContainsSector = (m, p) => {
        return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
    };
    // interlink polygon nodes in z-order
    const indexCurve = (start, minX, minY, invSize) => {
        var p = start;
        do {
            if (p.z === null)
                p.z = zOrder(p.x, p.y, minX, minY, invSize);
            p.prevZ = p.prev;
            p.nextZ = p.next;
            p = p.next;
        } while (p !== start);
        p.prevZ.nextZ = null;
        p.prevZ = null;
        sortLinked(p);
    };
    // Simon Tatham's linked list merge sort algorithm
    // http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
    const sortLinked = (list) => {
        let i;
        let p;
        let q;
        let e;
        let tail;
        let numMerges;
        let pSize;
        let qSize;
        let inSize = 1;
        do {
            p = list;
            list = null;
            tail = null;
            numMerges = 0;
            while (p) {
                numMerges++;
                q = p;
                pSize = 0;
                for (i = 0; i < inSize; i++) {
                    pSize++;
                    q = q.nextZ;
                    if (!q)
                        break;
                }
                qSize = inSize;
                while (pSize > 0 || (qSize > 0 && q)) {
                    if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) {
                        e = p;
                        p = p.nextZ;
                        pSize--;
                    }
                    else {
                        e = q;
                        q = q.nextZ;
                        qSize--;
                    }
                    if (tail)
                        tail.nextZ = e;
                    else
                        list = e;
                    e.prevZ = tail;
                    tail = e;
                }
                p = q;
            }
            tail.nextZ = null;
            inSize *= 2;
        } while (numMerges > 1);
        return list;
    };
    // z-order of a point given coords and inverse of the longer side of data bbox
    const zOrder = (x, y, minX, minY, invSize) => {
        // coords are transformed into non-negative 15-bit integer range
        x = 32767 * (x - minX) * invSize;
        y = 32767 * (y - minY) * invSize;
        x = (x | (x << 8)) & 0x00FF00FF;
        x = (x | (x << 4)) & 0x0F0F0F0F;
        x = (x | (x << 2)) & 0x33333333;
        x = (x | (x << 1)) & 0x55555555;
        y = (y | (y << 8)) & 0x00FF00FF;
        y = (y | (y << 4)) & 0x0F0F0F0F;
        y = (y | (y << 2)) & 0x33333333;
        y = (y | (y << 1)) & 0x55555555;
        return x | (y << 1);
    };
    // find the leftmost node of a polygon ring
    const getLeftmost = (start) => {
        let p = start;
        let leftmost = start;
        do {
            if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) {
                leftmost = p;
            }
            p = p.next;
        } while (p !== start);
        return leftmost;
    };
    // check if a point lies within a convex triangle
    // TODO: use Triangle.containsPoint
    const pointInTriangle = (ax, ay, bx, by, cx, cy, px, py) => {
        return (cx - px) * (ay - py) - (ax - px) * (cy - py) >= 0 &&
            (ax - px) * (by - py) - (bx - px) * (ay - py) >= 0 &&
            (bx - px) * (cy - py) - (cx - px) * (by - py) >= 0;
    };
    // check if a diagonal between two polygon nodes is valid (lies in polygon interior)
    const isValidDiagonal = (a, b) => {
        return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) && // dones't intersect other edges
            (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && // locally visible
                (area(a.prev, a, b.prev) != 0 || area(a, b.prev, b)) != 0 || // does not create opposite-facing sectors
                equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0); // special zero-length case
    };
    // signed area of a triangle
    const area = (p, q, r) => {
        return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    };
    // check if two points are equal
    // TODO: as member function of vertex
    const equals = (p1, p2) => {
        return p1.x === p2.x && p1.y === p2.y;
    };
    // check if two segments intersect
    // TODO: use Line.intersects
    const intersects = (p1, q1, p2, q2) => {
        var o1 = sign(area(p1, q1, p2));
        var o2 = sign(area(p1, q1, q2));
        var o3 = sign(area(p2, q2, p1));
        var o4 = sign(area(p2, q2, q1));
        if (o1 !== o2 && o3 !== o4)
            return true; // general case
        if (o1 === 0 && onSegment(p1, p2, q1))
            return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
        if (o2 === 0 && onSegment(p1, q2, q1))
            return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
        if (o3 === 0 && onSegment(p2, p1, q2))
            return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
        if (o4 === 0 && onSegment(p2, q1, q2))
            return true; // p2, q2 and q1 are collinear and q1 lies on p2q2
        return false;
    };
    // for collinear points p, q, r, check if point q lies on segment pr
    const onSegment = (p, q, r) => {
        return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
    };
    const sign = (num) => {
        return num > 0 ? 1 : num < 0 ? -1 : 0;
    };
    // check if a polygon diagonal intersects any polygon segments
    const intersectsPolygon = (a, b) => {
        let p = a;
        do {
            if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersects(p, p.next, a, b)) {
                return true;
            }
            p = p.next;
        } while (p !== a);
        return false;
    };
    // check if a polygon diagonal is locally inside the polygon
    const locallyInside = (a, b) => {
        return area(a.prev, a, a.next) < 0 ?
            area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 :
            area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
    };
    // check if the middle point of a polygon diagonal is inside the polygon
    const middleInside = (a, b) => {
        let p = a;
        let inside = false;
        const px = (a.x + b.x) / 2;
        const py = (a.y + b.y) / 2;
        // TODO: call Polygon.contains here?
        do {
            if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y &&
                (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x))
                inside = !inside;
            p = p.next;
        } while (p !== a);
        return inside;
    };
    // link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
    // if one belongs to the outer ring and another to a hole, it merges it into a single ring
    const splitPolygon = (a, b) => {
        const a2 = new Node(a.i, a.x, a.y);
        const b2 = new Node(b.i, b.x, b.y);
        const an = a.next;
        const bp = b.prev;
        a.next = b;
        b.prev = a;
        a2.next = an;
        an.prev = a2;
        b2.next = a2;
        a2.prev = b2;
        bp.next = b2;
        b2.prev = bp;
        return b2;
    };
    // create a node and optionally link it with previous one (in a circular doubly linked list)
    const insertNode = (i, x, y, last) => {
        var p = new Node(i, x, y);
        if (!last) {
            p.prev = p;
            p.next = p;
        }
        else {
            p.next = last.next;
            p.prev = last;
            last.next.prev = p;
            last.next = p;
        }
        return p;
    };
    const removeNode = (p) => {
        p.next.prev = p.prev;
        p.prev.next = p.next;
        if (p.prevZ)
            p.prevZ.nextZ = p.nextZ;
        if (p.nextZ)
            p.nextZ.prevZ = p.prevZ;
    };
    const signedArea = (data, start, end, dim) => {
        var sum = 0;
        for (var i = start, j = end - dim; i < end; i += dim) {
            sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
            j = i;
        }
        return sum;
    };
    return earcut;
})();
//# sourceMappingURL=earcut.js.map