import { Vector3 } from '../math/Vector3.js';
import { Vector2 } from '../math/Vector2.js';
import { Sphere } from '../math/Sphere.js';
import { Ray } from '../math/Ray.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Object3D } from '../core/Object3D.js';
import { Triangle } from '../math/Triangle.js';
import { Face3 } from '../core/Face3.js';
import { DoubleSide, BackSide, TrianglesDrawMode } from '../constants.js';
import { MeshBasicMaterial } from '../materials/MeshBasicMaterial.js';
import { BufferGeometry } from '../core/BufferGeometry.js';

/**
 * @author mrdoob / http://mrdoob.com/
 * @author alteredq / http://alteredqualia.com/
 * @author mikael emtinger / http://gomo.se/
 * @author jonobr1 / http://jonobr1.com/
 */

function Mesh( geometry, material ) {

	Object3D.call( this );

	this.type = 'Mesh';

	this.geometry = geometry !== undefined ? geometry : new BufferGeometry();
	this.material = material !== undefined ? material : new MeshBasicMaterial( { color: Math.random() * 0xffffff } );

	this.drawMode = TrianglesDrawMode;
	this.lod = [];

	this.updateMorphTargets();

}

Mesh.prototype = Object.assign( Object.create( Object3D.prototype ), {

	constructor: Mesh,

	isMesh: true,

	setDrawMode: function ( value ) {

		this.drawMode = value;

	},

	copy: function ( source ) {

		Object3D.prototype.copy.call( this, source );

		this.drawMode = source.drawMode;
		this.lod = source.lod;

		if ( source.morphTargetInfluences !== undefined ) {

			this.morphTargetInfluences = source.morphTargetInfluences.slice();

		}

		if ( source.morphTargetDictionary !== undefined ) {

			this.morphTargetDictionary = Object.assign( {}, source.morphTargetDictionary );

		}

		return this;

	},

	updateMorphTargets: function () {

		var geometry = this.geometry;
		var m, ml, name;

		if ( geometry.isBufferGeometry ) {

			var morphAttributes = geometry.morphAttributes;
			var keys = Object.keys( morphAttributes );

			if ( keys.length > 0 ) {

				var morphAttribute = morphAttributes[ keys[ 0 ] ];

				if ( morphAttribute !== undefined ) {

					this.morphTargetInfluences = [];
					this.morphTargetDictionary = {};

					for ( m = 0, ml = morphAttribute.length; m < ml; m ++ ) {

						name = morphAttribute[ m ].name || String( m );

						this.morphTargetInfluences.push( 0 );
						this.morphTargetDictionary[ name ] = m;

					}

				}

			}

		} else {

			var morphTargets = geometry.morphTargets;

			if ( morphTargets !== undefined && morphTargets.length > 0 ) {

				this.morphTargetInfluences = [];
				this.morphTargetDictionary = {};

				for ( m = 0, ml = morphTargets.length; m < ml; m ++ ) {

					name = morphTargets[ m ].name || String( m );

					this.morphTargetInfluences.push( 0 );
					this.morphTargetDictionary[ name ] = m;

				}

			}

		}

	},

	raycast: ( function () {

		var inverseMatrix = new Matrix4();
		var ray = new Ray();
		var sphere = new Sphere();

		var vA = new Vector3();
		var vB = new Vector3();
		var vC = new Vector3();

		var tempA = new Vector3();
		var tempB = new Vector3();
		var tempC = new Vector3();

		var uvA = new Vector2();
		var uvB = new Vector2();
		var uvC = new Vector2();

		var target = new Vector3();

		var barycoord = new Vector3();

		var intersectionPoint = new Vector3();
		var intersectionPointWorld = new Vector3();

		function uvIntersection( point, p1, p2, p3, uv1, uv2, uv3 ) {

			Triangle.getBarycoord( point, p1, p2, p3, barycoord );

			uv1.multiplyScalar( barycoord.x );
			uv2.multiplyScalar( barycoord.y );
			uv3.multiplyScalar( barycoord.z );

			uv1.add( uv2 ).add( uv3 );

			return uv1.clone();

		}

		function checkIntersection( object, material, raycaster, ray, pA, pB, pC, point ) {

			var intersect;

			if ( material.side === BackSide ) {

				intersect = ray.intersectTriangle( pC, pB, pA, true, point );

			} else {

				intersect = ray.intersectTriangle( pA, pB, pC, false, point );

			}

			if ( intersect === null ) return null;

			intersectionPointWorld.copy( point );
			intersectionPointWorld.applyMatrix4( object.matrixWorld );

			var distance = raycaster.ray.origin.distanceTo( intersectionPointWorld );

			if ( distance < raycaster.near || distance > raycaster.far ) return null;

			return {
				distance: distance,
				point: intersectionPointWorld.clone(),
				object: object
			};

		}

		function checkBufferGeometryIntersection( object, raycaster, ray, position, uv, a, b, c ) {

			vA.fromBufferAttribute( position, a );
			vB.fromBufferAttribute( position, b );
			vC.fromBufferAttribute( position, c );

			var intersection = checkIntersection( object, object.material, raycaster, ray, vA, vB, vC, intersectionPoint );

			if ( intersection ) {

				if ( uv ) {

					uvA.fromBufferAttribute( uv, a );
					uvB.fromBufferAttribute( uv, b );
					uvC.fromBufferAttribute( uv, c );

					intersection.uv = uvIntersection( intersectionPoint, vA, vB, vC, uvA, uvB, uvC );

				}

				var face = new Face3( a, b, c );
				Triangle.getNormal( vA, vB, vC, face.normal );

				intersection.face = face;

				intersection.faceIndex = a;

			}

			return intersection;

		}

		return function raycast( raycaster, intersects ) {

			var geometry = this.geometry;
			var material = this.material;

			if ( material === undefined ) return;

			// Checking boundingSphere distance to ray

			if ( geometry.boundingSphere === null ) geometry.computeBoundingSphere(this.scale);


			if ( raycaster.ray.distanceToPoint( this.getWorldPosition(tempA).add( geometry.boundingSphere.center ) ) > raycaster.far + geometry.boundingSphere.radius ) {
				return;
			}

			//

			inverseMatrix.getInverse( this.matrixWorld );
			ray.copy( raycaster.ray ).applyMatrix4( inverseMatrix );

			// Check boundingBox before continuing

			if ( geometry.boundingBox === null ) {
				geometry.computeBoundingBox();
			}

			var boxIntersects = ray.intersectBox( geometry.boundingBox, target );
			if ( boxIntersects === null ) {
				return;
			}

			var boxDist = ray.origin.distanceTo( boxIntersects );

			// this one is tricky because if you're next to irregular shape the distance from bbox
			// the distance to the bounding box can be increasing the closer you get to the actual shape
			if ( boxDist > raycaster.far && !geometry.boundingBox.containsPoint(ray.origin) ) {
				return;
			}

			var intersection;

			if ( geometry.isBufferGeometry ) {

				var a, b, c;
				var index = geometry.index;
				var position = geometry.attributes.position;
				var uv = geometry.attributes.uv;
				var i, l;

				if ( index !== null ) {

					// indexed buffer geometry

					for ( i = 0, l = index.count; i < l; i += 3 ) {

						a = index.getX( i );
						b = index.getX( i + 1 );
						c = index.getX( i + 2 );

						intersection = checkBufferGeometryIntersection( this, raycaster, ray, position, uv, a, b, c );

						if ( intersection ) {

							intersection.faceIndex = Math.floor( i / 3 ); // triangle number in indices buffer semantics
							intersects.push( intersection );

						}

					}

				} else if ( position !== undefined ) {

					// non-indexed buffer geometry

					for ( i = 0, l = position.count; i < l; i += 3 ) {

						a = i;
						b = i + 1;
						c = i + 2;

						intersection = checkBufferGeometryIntersection( this, raycaster, ray, position, uv, a, b, c );

						if ( intersection ) intersects.push( intersection );

					}

				}

			} else if ( geometry.isGeometry ) {

				var fvA, fvB, fvC;
				var isMultiMaterial = Array.isArray( material );

				var vertices = geometry.vertices;
				var faces = geometry.faces;
				var uvs;

				var faceVertexUvs = geometry.faceVertexUvs[ 0 ];
				if ( faceVertexUvs.length > 0 ) uvs = faceVertexUvs;

				for ( var f = 0, fl = faces.length; f < fl; f ++ ) {

					var face = faces[ f ];
					var faceMaterial = isMultiMaterial ? material[ face.materialIndex ] : material;

					if ( faceMaterial === undefined ) continue;

					fvA = vertices[ face.a ];
					fvB = vertices[ face.b ];
					fvC = vertices[ face.c ];

					if ( faceMaterial.morphTargets === true ) {

						var morphTargets = geometry.morphTargets;
						var morphInfluences = this.morphTargetInfluences;

						vA.set( 0, 0, 0 );
						vB.set( 0, 0, 0 );
						vC.set( 0, 0, 0 );

						for ( var t = 0, tl = morphTargets.length; t < tl; t ++ ) {

							var influence = morphInfluences[ t ];

							if ( influence === 0 ) continue;

							var targets = morphTargets[ t ].vertices;

							vA.addScaledVector( tempA.subVectors( targets[ face.a ], fvA ), influence );
							vB.addScaledVector( tempB.subVectors( targets[ face.b ], fvB ), influence );
							vC.addScaledVector( tempC.subVectors( targets[ face.c ], fvC ), influence );

						}

						vA.add( fvA );
						vB.add( fvB );
						vC.add( fvC );

						fvA = vA;
						fvB = vB;
						fvC = vC;

					}

					intersection = checkIntersection( this, faceMaterial, raycaster, ray, fvA, fvB, fvC, intersectionPoint );

					if ( intersection ) {

						if ( uvs && uvs[ f ] ) {

							var uvs_f = uvs[ f ];
							uvA.copy( uvs_f[ 0 ] );
							uvB.copy( uvs_f[ 1 ] );
							uvC.copy( uvs_f[ 2 ] );

							intersection.uv = uvIntersection( intersectionPoint, fvA, fvB, fvC, uvA, uvB, uvC );

						}

						intersection.face = face;
						intersection.faceIndex = f;
						intersects.push( intersection );

					}

				}

			}

		};

	}() ),

	clone: function () {

		return new this.constructor( this.geometry, this.material ).copy( this );

	}

} );



// copy position, rotation and scale from source object
Mesh.prototype.copyAllTransforms = function(source) {

	this.position.copy(source.position);
	this.rotation.copy(source.rotation);
	this.scale.copy(source.scale);
	this.updateMatrix();
	this.updateMatrixWorldNoChildren();

};

Mesh.prototype.getScene = function() {

	if (this.isRoot()) {
		return this.parent;
	} else {
		return this.getRoot().parent;
	}

};


Mesh.prototype.prepareForSend = function() {

	var root = null;

	if (!this.isRoot()) {
		var rootEl = this.getRoot();

		root = {
			position: rootEl.position.toArray(),
			rotation: rootEl.rotation.toArray(),
			scale: rootEl.scale.toArray(),
			name: rootEl.name
		};
	}

	var sendData = {
		uuid: this.uuid,
		modelClass: this.modelClass,
		position: this.position.toArray(),
		rotation: this.rotation.toArray(),
		scale: this.scale.toArray(),
		name: this.name
	};

	if (root) {
		sendData.root = root;
	}

	return sendData;

};

// quick check before proper raycasting
Mesh.prototype.raycastSphereOnly = (function() {

	var sphere = new Sphere();

	return function(raycaster, intersects) {

		var geometry = this.geometry;

		// Checking boundingSphere distance to ray

		if (geometry.boundingSphere === null) geometry.computeBoundingSphere(this.scale);

		sphere.copy(geometry.boundingSphere);
		sphere.applyMatrix4(this.matrixWorld);

		return raycaster.ray.intersectsSphere(sphere);

	};
})();

Mesh.prototype.raycastBBoxOnly = (function() {
	var ray = new Ray();
	var inverseMatrix = new Matrix4();
	var tempPoint = new Vector3();

	return function raycastBBoxOnly(raycaster, predefinedTarget) {
		var target = predefinedTarget || new Vector3();
		var geometry = this.geometry;
		var maxDist = raycaster.far;
		// Checking boundingSphere distance to ray

		if (geometry.boundingSphere === null) geometry.computeBoundingSphere(this.scale);

		// optimization to getWorldPosition is only faster if getWorldPosition is also optimized!
		var sphereDist = raycaster.ray.distanceToPoint( this.getWorldPosition( tempPoint ) ) - geometry.boundingSphere.radius;

		if ( sphereDist > 0 && sphereDist > maxDist ) {
			return;
		}

		// Check boundingBox before continuing
		inverseMatrix.getInverse( this.matrixWorld );
		ray.copy( raycaster.ray ).applyMatrix4( inverseMatrix );

		if ( geometry.boundingBox === null ) {
			geometry.computeBoundingBox();
		}
		var boxIntersect = ray.intersectBox( geometry.boundingBox, target );
		if (boxIntersect === null) {
			return;
		}
		var boxDist = ray.origin.distanceTo( boxIntersect );

		if ( boxDist > maxDist && !geometry.boundingBox.containsPoint(ray.origin) ) {
			return;
		}

		boxIntersect.distance = boxDist;

		return boxIntersect;
	};
})();

export { Mesh };
