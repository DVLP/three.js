import { Mesh } from '../../objects/Mesh';
import { MeshBasicMaterial } from '../../materials/MeshBasicMaterial';
import { BoxGeometry } from '../../geometries/BoxGeometry';
import { Box3 } from '../../math/Box3';

// this bounding box helper is not iterating through child elements
// a helper to show the world-axis-aligned bounding box for an object

export const BoundingBoxHelperNoChildren = function(object, hex) {

  var color = (hex !== undefined) ? hex : 0x888888;

  this.object = object;

  this.box = new Box3();

  Mesh.call(this, new BoxGeometry(1, 1, 1), new MeshBasicMaterial({
    color: color,
    wireframe: true
  }));

};

BoundingBoxHelperNoChildren.prototype = Object.create(Mesh.prototype);
BoundingBoxHelperNoChildren.prototype.constructor = BoundingBoxHelperNoChildren;

BoundingBoxHelperNoChildren.prototype.update = function() {

  this.box = this.object.geometry.boundingBox;

  this.box.setFromCenterAndSize(this.position, this.scale);

};
