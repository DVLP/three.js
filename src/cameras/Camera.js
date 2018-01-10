/**
 * @author mrdoob / http://mrdoob.com/
 * @author mikael emtinger / http://gomo.se/
 * @author WestLangley / http://github.com/WestLangley
*/

import { Matrix4 } from '../math/Matrix4.js';
import { Quaternion } from '../math/Quaternion.js';
import { Object3D } from '../core/Object3D.js';
import { Vector3 } from '../math/Vector3.js';
import { Vector2 } from '../math/Vector2';

function Camera() {

	Object3D.call( this );

	this.type = 'Camera';

	this.matrixWorldInverse = new Matrix4();
	this.projectionMatrix = new Matrix4();
	this.triangle = [new Vector2(), new Vector2(), new Vector2()];
	this.worldPos = new Vector3();

}

Camera.prototype = Object.assign( Object.create( Object3D.prototype ), {

	constructor: Camera,

	isCamera: true,

	copy: function ( source, recursive ) {

		Object3D.prototype.copy.call( this, source, recursive );

		this.matrixWorldInverse.copy( source.matrixWorldInverse );
		this.projectionMatrix.copy( source.projectionMatrix );

		return this;

	},

	getWorldDirection: function () {

		var quaternion = new Quaternion();

		return function getWorldDirection( optionalTarget ) {

			var result = optionalTarget || new Vector3();

			this.getWorldQuaternion( quaternion );

			return result.set( 0, 0, - 1 ).applyQuaternion( quaternion );

		};

	}(),

	updateMatrixWorld: function ( force ) {

		Object3D.prototype.updateMatrixWorld.call( this, force );

		this.matrixWorldInverse.getInverse( this.matrixWorld );

	},

	clone: function () {

		return new this.constructor().copy( this );

	}

} );

Camera.prototype.sphereInFov = function(centrex, centrey, radius) {

  var triangle = this.triangle,
    v1x = triangle[0].x,
    v1y = triangle[0].y,
    v2x = triangle[1].x,
    v2y = triangle[1].y,
    v3x = triangle[2].x,
    v3y = triangle[2].y,
    len = 0;

  //
  // TEST 1: Vertex within circle
  //
  var c1x = centrex - v1x,
    c1y = centrey - v1y;

  var radiusSqr = radius * radius,
    c1sqr = c1x * c1x + c1y * c1y - radiusSqr;

  if (c1sqr <= 0) return true;

  var c2x = centrex - v2x,
    c2y = centrey - v2y,
    c2sqr = c2x * c2x + c2y * c2y - radiusSqr;

  if (c2sqr <= 0) return true;

  var c3x = centrex - v3x,
    c3y = centrey - v3y,
    c3sqr = c3x * c3x + c3y * c3y - radiusSqr;

  if (c3sqr <= 0) return true;

  //
  // TEST 2: Circle centre within triangle
  //

  //
  // Calculate edges
  //
  var e1x = v2x - v1x,
    e1y = v2y - v1y,

    e2x = v3x - v2x,
    e2y = v3y - v2y,

    e3x = v1x - v3x,
    e3y = v1y - v3y;

  // longer version
  //if ((((v2y - v1y) * (pX - v1x) - (v2x - v1x) * (py - v1y)) | ((v3y - v2y) * (pX - v2x) - (v3x - v2x) * (py - v2y)) | ((v1y - v3y) * (pX - v3x) - (v1x - v3x) * (py - v3y))) >== 0) return 'inside';


  // shorter version
  if (((e1y * c1x - e1x * c1y) | (e2y * c2x - e2x * c2y) | (e3y * c3x - e3x * c3y)) >= 0) return true;

  //    if(pointInTriangle(object.position.x, object.position.z, v1x, v1y, v2x, v2y, v3x, v3y)) return 'indeed';

  //
  // TEST 3: Circle intersects edge
  //
  var k = c1x * e1x + c1y * e1y;

  if (k > 0) {
    len = e1x * e1x + e1y * e1y; // squared len

    if (k < len) {
      if (c1sqr * len <= k * k) return true;
    }
  }

  // Second edge
  k = c2x * e2x + c2y * e2y;

  if (k > 0) {
    len = e2x * e2x + e2y * e2y;

    if (k < len) {
      if (c2sqr * len <= k * k) return true;
    }
  }

  // Third edge
  k = c3x * e3x + c3y * e3y;

  if (k > 0) {
    len = e3x * e3x + e3y * e3y;

    if (k < len) {
      if (c3sqr * len <= k * k) return true;
    }
  }

  // We're done, no intersection
  return false;

};

Camera.prototype.inFov = function(object) {

  var bSphere = object.geometry.boundingSphere || object.geometry.computeBoundingSphere(object.scale),
    centrex = object.position.x,
    centrey = object.position.z,
    radius = bSphere.radius;

  return this.sphereInFov(centrex, centrey, radius);

};

// instead of calculating if object's bounding sphere is between frustum planes, two 2d triangles can be calculated: vertical and horizontal
// if a sphere(circle) is in both these triangles then the object is in frustum
// triangle has to be updated after each frame
Camera.prototype.updateTriangle = function (azimuthalAngle, polarAngle, drawDistance) {
// 1 is default - looking straight + the bigger the steeper looking up or down the larger angle of view around
  var viewWidthMultiplier = 1 + Math.pow(Math.abs(polarAngle - Math.PI / 2), 3);
  const worldPos = this.worldPos = this.getWorldPosition();

  //var p1 = { x: worldPos.x, y: worldPos.z },
    //angleOfViewV = this.fov * Math.PI / 180,
    var angleOfView = Math.max(-Math.PI + 0.1, Math.min(Math.PI - 0.1, (this.fov * this.aspect) * Math.PI / 180 * viewWidthMultiplier)), // viewWidthFactor: when looking up or down the angle gets wider
    theta = -azimuthalAngle - Math.PI / 2,
    //phi = -this.orbitControls.getPolarAngle() - Math.PI / 2,
    angle1 = theta - angleOfView / 2,
    angle2 = theta + angleOfView / 2,
    // angle1V = phi - angleOfViewV / 2,
    // angle2V = phi + angleOfViewV / 2,
    distance = drawDistance / viewWidthMultiplier; // viewWidthFactor: but distance gets smaller

  // triangle vertical
  // p5 = {x: p1.x + Math.cos(angle1V) * distance, y: p1.y + Math.sin(angle1V) * distance},
  // p4 = {x: p1.x + Math.cos(angle2V) * distance, y: p1.y + Math.sin(angle2V) * distance};

  this.triangle[0].x = worldPos.x;
  this.triangle[0].y = worldPos.z;
  this.triangle[1].x = worldPos.x + Math.cos(angle2) * distance;
  this.triangle[1].y = worldPos.z + Math.sin(angle2) * distance;
  this.triangle[2].x = worldPos.x + Math.cos(angle1) * distance;
  this.triangle[2].y = worldPos.z + Math.sin(angle1) * distance;

  //this.triangleV = this.triangleV = [p1, p4, p5];

  // help in debugging where is triangle
  // if(!this.helperBox1) {
  //   this.helperBox1 = new Mesh(new BoxGeometry( 3, 3, 3 ), new MeshBasicMaterial( { color: 0xFF0000, wireframe: false } ) );
  //   this.helperBox2 = new Mesh(new BoxGeometry( 500, 500, 500 ), new MeshBasicMaterial( { color: 0xFF0000, wireframe: false } ) );
  //   this.helperBox3 = new Mesh(new BoxGeometry( 500, 500, 500 ), new MeshBasicMaterial( { color: 0xFF0000, wireframe: false } ) );

  //   this.helperBox1.frustumCulled = false;
  //   this.helperBox1.name = 'helperBox1';
  //   this.helperBox2.frustumCulled = false;
  //   this.helperBox2.name = 'helperBox2';
  //   this.helperBox3.frustumCulled = false;
  //   this.helperBox3.name = 'helperBox3';

  //   app.scene.get().add(this.helperBox1);
  //   app.scene.get().add(this.helperBox2);
  //   app.scene.get().add(this.helperBox3);
  // }

  // this.helperBox1.position.set(p1.x, -1, p1.y);
  // this.helperBox2.position.set(p4.x, p4.y, p1.y);
  // this.helperBox3.position.set(p5.x, p4.y, p1.y);
};

export { Camera };
