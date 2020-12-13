/**
 * @author mrdoob / http://mrdoob.com/
 * @author mikael emtinger / http://gomo.se/
 * @author WestLangley / http://github.com/WestLangley
*/

import { Matrix4 } from '../math/Matrix4.js';
import { Object3D } from '../core/Object3D.js';
import { Vector3 } from '../math/Vector3.js';
import { Vector2 } from '../math/Vector2';

function Camera() {

	Object3D.call( this );

	this.type = 'Camera';

	this.matrixWorldInverse = new Matrix4();

	this.projectionMatrix = new Matrix4();
	this.projectionMatrixInverse = new Matrix4();

	this.triangle = [new Vector2(), new Vector2(), new Vector2()];
	this.worldPos = new Vector3();
	this.drawDistanceSq = 10000;

}

Camera.prototype = Object.assign( Object.create( Object3D.prototype ), {

	constructor: Camera,

	isCamera: true,

	copy: function ( source, recursive ) {

		Object3D.prototype.copy.call( this, source, recursive );

		this.matrixWorldInverse.copy( source.matrixWorldInverse );

		this.projectionMatrix.copy( source.projectionMatrix );
		this.projectionMatrixInverse.copy( source.projectionMatrixInverse );

		return this;

	},

	getWorldDirection: function ( target ) {

		if ( target === undefined ) {

			console.warn( 'THREE.Camera: .getWorldDirection() target is now required' );
			target = new Vector3();

		}

		this.updateMatrixWorld( true );

		var e = this.matrixWorld.elements;

		return target.set( - e[ 8 ], - e[ 9 ], - e[ 10 ] ).normalize();

	},

	updateMatrixWorld: function ( force ) {

		Object3D.prototype.updateMatrixWorld.call( this, force );

		this.matrixWorldInverse.getInverse( this.matrixWorld );

	},

	updateWorldMatrix: function ( updateParents, updateChildren ) {

		Object3D.prototype.updateWorldMatrix.call( this, updateParents, updateChildren );

		this.matrixWorldInverse.getInverse( this.matrixWorld );

	},

	clone: function () {

		return new this.constructor().copy( this );

	}

} );

Camera.prototype.circleInFov = function(centrex, centrey, radius) {
    // angle1 = triangle[0].angle1,
    // angle2 = triangle[0].angle2,
    // v1x = triangle[0].x,
    // v1y = triangle[0].y,
    // v2x = triangle[1].x,
    // v2y = triangle[1].y,
    // v3x = triangle[2].x,
    // v3y = triangle[2].y;

  var edge1 = this.triangle[1];
  var edge2 = this.triangle[2];

  if(!this.checkIfCircleOnInnerSideOfLine(edge1.vxdelta, edge1.v1xvydelta, edge1.vydelta, edge1.v1yvxdelta, edge1.ppnAngleCos, edge1.ppnAngleSin, centrex, centrey, radius)) {
    return false;
  }
  if(this.checkIfCircleOnInnerSideOfLine(edge2.vxdelta, edge2.v1xvydelta, edge2.vydelta, edge2.v1yvxdelta, edge2.ppnAngleCos, edge2.ppnAngleSin, centrex, centrey, radius)) {
    return false;
  }
  return true;
};

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
  // TEST 1: Vertex within circle - very low probability, waste of time?
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
  if (!this.fastFrustumRejection) {
    return true;
  }

  if (!object.maxScale) {
    object.maxScale = Math.max(object.scale.x, object.scale.y, object.scale.z);
  }
  var bSphere = object.bsphere || object.geometry.boundingSphere || object.geometry.computeBoundingSphere(),
    centrex = object.position.x,
    centrey = object.position.z,
    radius = bSphere.radius * object.maxScale;

  const deltax = this.worldPos.x - centrex;
  const deltaz = this.worldPos.z - centrey;
  const distance2dSq = deltax * deltax + deltaz * deltaz;

  // why two this.far and this.drawDistance?
  // this.far is also for GPU
  // this.drawDistance is only for CPU
  const diameter = radius * 2;

  if (distance2dSq > (this.far * this.far + diameter * diameter * 2)) return false;
  if (distance2dSq < (this.near * this.near - diameter * diameter * 2)) return false;
  // if (distance2dSq > this.drawDistanceSq) return false;

  // draw distance tiers close to far culling (camera far(gradual slicing) / cutoff (not pushed to renderer))
    // debris - 50m / 55m
    // cars - 150m / 160m
    // buildings - 250m / 300m

  // TEMP: radius should not need to be doubled
  return this.circleInFov(centrex, centrey, radius * 2);

};

// instead of calculating if object's bounding sphere is between frustum planes, two 2d triangles can be calculated: vertical and horizontal
// if a sphere(circle) is in both these triangles then the object is in frustum
// triangle has to be updated after each frame
Camera.prototype.updateTriangle = function (azimuthalAngle, polarAngle, drawDistance) {
  this.drawDistanceSq = drawDistance * drawDistance;
// 1 is default - looking straight + the bigger the steeper looking up or down the larger angle of view around
  var viewWidthMultiplier = 1 + Math.pow(Math.abs(polarAngle - Math.PI / 2), 3);
  var worldPos = this.worldPos.setFromMatrixPosition(this.matrixWorld);

    //var p1 = { x: worldPos.x, y: worldPos.z },
    //angleOfViewV = this.fov * Math.PI / 180,
    var angle = this.getEffectiveFOV() * Math.max(1, this.aspect) * 1.1;
    var angleOfView = Math.max(-Math.PI + 0.1, Math.min(Math.PI - 0.1, angle * Math.PI / 180 * viewWidthMultiplier)), // viewWidthFactor: when looking up or down the angle gets wider
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

  this.triangle[0].angle1 = angle1;
  this.triangle[0].angle2 = angle2;
  this.triangle[0].x = worldPos.x;
  this.triangle[0].y = worldPos.z;
  this.triangle[1].x = worldPos.x + Math.cos(angle2) * distance;
  this.triangle[1].y = worldPos.z + Math.sin(angle2) * distance;
  this.triangle[2].x = worldPos.x + Math.cos(angle1) * distance;
  this.triangle[2].y = worldPos.z + Math.sin(angle1) * distance;


  // chaced values for computations
  this.triangle[1].vxdelta = this.triangle[1].x - this.triangle[0].x;
  this.triangle[1].vydelta = this.triangle[1].y - this.triangle[0].y;
  this.triangle[1].v1xvydelta = this.triangle[0].x * this.triangle[1].vydelta;
  this.triangle[1].v1yvxdelta = this.triangle[0].y * this.triangle[1].vxdelta;
  this.triangle[1].ppnAngleCos = Math.cos(angle1 + 0.5);
  this.triangle[1].ppnAngleSin = Math.sin(angle1 + 0.5);

  this.triangle[2].vxdelta = this.triangle[2].x - this.triangle[0].x;
  this.triangle[2].vydelta = this.triangle[2].y - this.triangle[0].y;
  this.triangle[2].v1xvydelta = this.triangle[0].x * this.triangle[2].vydelta;
  this.triangle[2].v1yvxdelta = this.triangle[0].y * this.triangle[2].vxdelta;
  this.triangle[2].ppnAngleCos = Math.cos(angle2 - 0.5);
  this.triangle[2].ppnAngleSin = Math.sin(angle2 - 0.5);

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

// check on which side of line the point is - full version
Camera.prototype.checkIfCircleOnInnerSideOfLineUNCUT = function (v1x, v1y, v2x, v2y, angle, ccentreX, ccentreY, cradius, inverse) {
  if (typeof inverse === 'undefined') inverse = 1;
  var perpendicularAngle = angle + (0.5 * inverse);
  // 1. find the furthest point from all triangle boundary lines
  // 1.a left triangle arm, +0.5 for perpendicular angle to the line
  var farPtX = ccentreX + cradius * Math.cos(perpendicularAngle); // TODO: CACHE Math.cos(perpendicularAngle) in updateTriangle as ppAngleCos
  var farPtY = ccentreY + cradius * Math.sin(perpendicularAngle); // TODO: CACHE Math.sin(perpendicularAngle) in updateTriangle as ppAngleSin

  // 2. check on which side of line the point is
  var d = (farPtX - v1x) * (v2y - v1y) - (farPtY - v1y) * (v2x - v1x); // TODO: CACHE in updateTriangle like - farPtX * vYd - v1xvYd - farPtY * vXD - v1yvXD

  return d > 0 ? true : false;
}

// just like above but some calculations are cached and only calculated once per frame rather than for each object again and agagin
Camera.prototype.checkIfCircleOnInnerSideOfLine = function (vxdelta, v1xvydelta, vydelta, v1yvxdelta, ppnAngleCos, ppnAngleSin, ccentreX, ccentreY, cradius) {
  // 1. find the furthest point from all triangle boundary lines
  // 1.a left triangle arm, +0.5 for perpendicular angle to the line
  var farPtX = ccentreX + cradius * ppnAngleCos;
  var farPtY = ccentreY + cradius * ppnAngleSin;

  // 2. check on which side of line the point is
  var d = (farPtX * vydelta - v1xvydelta) - (farPtY * vxdelta - v1yvxdelta);

  return d > 0 ? true : false;
}

// Camera.prototype.checkIfCircleInTriangle = function(first_argument) {
//   // given left edge
//   var eg1 = {
//       x: 5,
//       y: 0,
//       x2: 0,
//       y2: 5,
//       angle: 0.25
//   }
//   // given circle
//   var circle = {
//       x: 2,
//       y: 2,
//       r: 0.9,
//   };

//   // left edge

//   // 1. find the furthest point from all triangle boundary lines
//   // 1.a left triangle arm, +0.5 for perpendicular angle to the line
//   var farPtA = {
//       x: circle.x + circle.r * Math.cos(eg1.angle + 0.5),
//       y: circle.y + circle.r * Math.sin(eg1.angle + 0.5),
//   }

//   // 2. check on which side of line the point is
//   var d = (farPtA.x - eg1.x) * (eg1.y2 - eg1.y) - (farPtA.y - eg1.y) * (eg1.x2 - eg1.x);
//   if(d > 0) {
//     console.log('furthest circle point is still on right side of the line')
//   }

//   var furthestPointB = {
//     x: circle.x + circle.r * Math.cos(angle2 - 0.5),
//     y: circle.y + circle.r * Math.sin(angle2 - 0.5),
//   }
// };

export { Camera };
