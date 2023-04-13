/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * <img style="padding:30px; height:160px;" src="media://images/kdtree3d.png"/>
 *
 * # xeokit 2D Collision and Search
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqVUstuwjAQ_JVoTyBFCILJ6wZFvVSoB3pq04OxF0ib2NR2qlKUf6-TICUIWjV7sT07s7O29wRMcoQYWEa1XqZ0p2ieCMdGjTgPy8fNGzKjnxSic2pSVawZCmxyL6-ObEhtOhUalemQBp19RR_GzqdMeatgGVI1uIDLm53cq0KbIl9bOtt3W7rs9Z13Ti1p26hbQNd1BsO_LOfzxeLar5cvpZtNP9MVVR8F4rXvPx7nbk_FDnU_bXXLPsLuj_7GBBdyVDlNuR2ympSA2WOOCcR2y3FLi8wkkIjSUmlh5PooGMRGFehCceDU4HksId7STFsUeWqkWp0Ht1pcOFAB8Qm-IPb88WgyCUjoe7NoSoIpceFo4emIRIEfkohMwjCIQq904VtKW3Y8Cj2fEN-LSBCSGZlFdb3nOlk1Uv4AguP0dg?type=png)](https://mermaid.live/edit#pako:eNqVUstuwjAQ_JVoTyBFCILJ6wZFvVSoB3pq04OxF0ib2NR2qlKUf6-TICUIWjV7sT07s7O29wRMcoQYWEa1XqZ0p2ieCMdGjTgPy8fNGzKjnxSic2pSVawZCmxyL6-ObEhtOhUalemQBp19RR_GzqdMeatgGVI1uIDLm53cq0KbIl9bOtt3W7rs9Z13Ti1p26hbQNd1BsO_LOfzxeLar5cvpZtNP9MVVR8F4rXvPx7nbk_FDnU_bXXLPsLuj_7GBBdyVDlNuR2ympSA2WOOCcR2y3FLi8wkkIjSUmlh5PooGMRGFehCceDU4HksId7STFsUeWqkWp0Ht1pcOFAB8Qm-IPb88WgyCUjoe7NoSoIpceFo4emIRIEfkohMwjCIQq904VtKW3Y8Cj2fEN-LSBCSGZlFdb3nOlk1Uv4AguP0dg)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/collision
 * ````
 *
 * ## Dependencies
 *
 * * {@link "@xeokit/scene"}
 * * {@link "@xeokit/core/components"}
 * * {@link "@xeokit/math/math"}
 * * {@link "@xeokit/math/boundaries"}
 *
 * ## Usage
 *
 * ````javascript
 *
 * ````
 *
 * @module @xeokit/collision/kdtree2d
 */
export * from "./KdTree2D";
export * from "./createKdTree2DFromSceneObjectVerts";
export * from "./searchKdTree2DForNearestNeighbor";
export {KdVertex2D} from "./KdVertex2D";
