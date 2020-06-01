import { Vector3 } from '../math/Vector3.js';
import { Vector2 } from '../math/Vector2.js';
import { Sphere } from '../math/Sphere.js';
import { Ray } from '../math/Ray.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Object3D } from '../core/Object3D.js';
import { Triangle } from '../math/Triangle.js';
import { Face3 } from '../core/Face3.js';
import { DoubleSide, BackSide } from '../constants.js';
import { MeshBasicMaterial } from '../materials/MeshBasicMaterial.js';
import { BufferGeometry } from '../core/BufferGeometry.js';

/**
 * @author mrdoob / http://mrdoob.com/
 * @author alteredq / http://alteredqualia.com/
 * @author mikael emtinger / http://gomo.se/
 * @author jonobr1 / http://jonobr1.com/
 */

var _inverseMatrix = new Matrix4();
var _ray = new Ray();
var _sphere = new Sphere();

var _vA = new Vector3();
var _vB = new Vector3();
var _vC = new Vector3();

var _tempA = new Vector3();
var _tempB = new Vector3();
var _tempC = new Vector3();

var _morphA = new Vector3();
var _morphB = new Vector3();
var _morphC = new Vector3();

var _uvA = new Vector2();
var _uvB = new Vector2();
var _uvC = new Vector2();

var _intersectionPoint = new Vector3();
var _intersectionPointWorld = new Vector3();

function Mesh( geometry, material ) {

	Object3D.call( this );

	this.type = 'Mesh';

	this.geometry = geometry !== undefined ? geometry : new BufferGeometry();
	this.material = material !== undefined ? material : new MeshBasicMaterial();
	this.lod = [];
	this.updateMorphTargets();

}

Mesh.prototype = Object.assign( Object.create( Object3D.prototype ), {

	constructor: Mesh,

	isMesh: true,

	copy: function ( source ) {

		Object3D.prototype.copy.call( this, source );
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

				console.error( 'THREE.Mesh.updateMorphTargets() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.' );

			}

		}

	},

	raycast: function ( raycaster, intersects ) {

		var geometry = this.geometry;
		var material = this.material;
		var matrixWorld = this.matrixWorld;

		if ( material === undefined ) return;

		// Checking boundingSphere distance to ray

		if ( geometry.boundingSphere === null ) geometry.computeBoundingSphere();

		_sphere.copy( geometry.boundingSphere );
		_sphere.applyMatrix4( matrixWorld );

		if ( raycaster.ray.intersectsSphere( _sphere ) === false ) return;

		//

		_inverseMatrix.getInverse( matrixWorld );
		_ray.copy( raycaster.ray ).applyMatrix4( _inverseMatrix );

		// Check boundingBox before continuing

		if ( geometry.boundingBox !== null ) {

			if ( _ray.intersectsBox( geometry.boundingBox ) === false ) return;

		}

		var intersection;

		if ( geometry.isBufferGeometry ) {

			var a, b, c;
			var index = geometry.index;
			var position = geometry.attributes.position;
			var morphPosition = geometry.morphAttributes.position;
			var morphTargetsRelative = geometry.morphTargetsRelative;
			var uv = geometry.attributes.uv;
			var uv2 = geometry.attributes.uv2;
			var groups = geometry.groups;
			var drawRange = geometry.drawRange;
			var i, j, il, jl;
			var group, groupMaterial;
			var start, end;

			if ( index !== null ) {

				// indexed buffer geometry

				if ( Array.isArray( material ) ) {

					for ( i = 0, il = groups.length; i < il; i ++ ) {

						group = groups[ i ];
						groupMaterial = material[ group.materialIndex ];

						start = Math.max( group.start, drawRange.start );
						end = Math.min( ( group.start + group.count ), ( drawRange.start + drawRange.count ) );

						for ( j = start, jl = end; j < jl; j += 3 ) {

							a = index.getX( j );
							b = index.getX( j + 1 );
							c = index.getX( j + 2 );

							intersection = checkBufferGeometryIntersection( this, groupMaterial, raycaster, _ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c );

							if ( intersection ) {

								intersection.faceIndex = Math.floor( j / 3 ); // triangle number in indexed buffer semantics
								intersection.face.materialIndex = group.materialIndex;
								intersects.push( intersection );

							}

						}

					}

				} else {

					start = Math.max( 0, drawRange.start );
					end = Math.min( index.count, ( drawRange.start + drawRange.count ) );

					for ( i = start, il = end; i < il; i += 3 ) {

						a = index.getX( i );
						b = index.getX( i + 1 );
						c = index.getX( i + 2 );

						intersection = checkBufferGeometryIntersection( this, material, raycaster, _ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c );

						if ( intersection ) {

							intersection.faceIndex = Math.floor( i / 3 ); // triangle number in indexed buffer semantics
							intersects.push( intersection );

						}

					}

				}

			} else if ( position !== undefined ) {

				// non-indexed buffer geometry

				if ( Array.isArray( material ) ) {

					for ( i = 0, il = groups.length; i < il; i ++ ) {

						group = groups[ i ];
						groupMaterial = material[ group.materialIndex ];

						start = Math.max( group.start, drawRange.start );
						end = Math.min( ( group.start + group.count ), ( drawRange.start + drawRange.count ) );

						for ( j = start, jl = end; j < jl; j += 3 ) {

							a = j;
							b = j + 1;
							c = j + 2;

							intersection = checkBufferGeometryIntersection( this, groupMaterial, raycaster, _ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c );

							if ( intersection ) {

								intersection.faceIndex = Math.floor( j / 3 ); // triangle number in non-indexed buffer semantics
								intersection.face.materialIndex = group.materialIndex;
								intersects.push( intersection );

							}

						}

					}

				} else {

					start = Math.max( 0, drawRange.start );
					end = Math.min( position.count, ( drawRange.start + drawRange.count ) );

					for ( i = start, il = end; i < il; i += 3 ) {

						a = i;
						b = i + 1;
						c = i + 2;

						intersection = checkBufferGeometryIntersection( this, material, raycaster, _ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c );

						if ( intersection ) {

							intersection.faceIndex = Math.floor( i / 3 ); // triangle number in non-indexed buffer semantics
							intersects.push( intersection );

						}

					}

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

				intersection = checkIntersection( this, faceMaterial, raycaster, _ray, fvA, fvB, fvC, _intersectionPoint );

				if ( intersection ) {

					if ( uvs && uvs[ f ] ) {

						var uvs_f = uvs[ f ];
						_uvA.copy( uvs_f[ 0 ] );
						_uvB.copy( uvs_f[ 1 ] );
						_uvC.copy( uvs_f[ 2 ] );

						intersection.uv = Triangle.getUV( _intersectionPoint, fvA, fvB, fvC, _uvA, _uvB, _uvC, new Vector2() );

					}

					intersection.face = face;
					intersection.faceIndex = f;
					intersects.push( intersection );

				}

			}

		}

	},

	clone: function () {

		return new this.constructor( this.geometry, this.material ).copy( this );

	}

} );

function checkIntersection( object, material, raycaster, ray, pA, pB, pC, point ) {

	var intersect;

	if ( material.side === BackSide ) {

		intersect = ray.intersectTriangle( pC, pB, pA, true, point );

	} else {

		intersect = ray.intersectTriangle( pA, pB, pC, material.side !== DoubleSide, point );

	}

	if ( intersect === null ) return null;

	_intersectionPointWorld.copy( point );
	_intersectionPointWorld.applyMatrix4( object.matrixWorld );

	var distanceSq = raycaster.ray.origin.distanceToSquared( _intersectionPointWorld );

	if ( distanceSq < (raycaster.near * raycaster.near) || distanceSq > (raycaster.far * raycaster.far) ) return null;

	return {
		distanceSq: distanceSq,
		point: _intersectionPointWorld.clone(),
		object: object
	};

}

function checkBufferGeometryIntersection( object, material, raycaster, ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c ) {

	_vA.fromBufferAttribute( position, a );
	_vB.fromBufferAttribute( position, b );
	_vC.fromBufferAttribute( position, c );

	var morphInfluences = object.morphTargetInfluences;

	if ( material.morphTargets && morphPosition && morphInfluences ) {

		_morphA.set( 0, 0, 0 );
		_morphB.set( 0, 0, 0 );
		_morphC.set( 0, 0, 0 );

		for ( var i = 0, il = morphPosition.length; i < il; i ++ ) {

			var influence = morphInfluences[ i ];
			var morphAttribute = morphPosition[ i ];

			if ( influence === 0 ) continue;

			_tempA.fromBufferAttribute( morphAttribute, a );
			_tempB.fromBufferAttribute( morphAttribute, b );
			_tempC.fromBufferAttribute( morphAttribute, c );

			if ( morphTargetsRelative ) {

				_morphA.addScaledVector( _tempA, influence );
				_morphB.addScaledVector( _tempB, influence );
				_morphC.addScaledVector( _tempC, influence );

			} else {

				_morphA.addScaledVector( _tempA.sub( _vA ), influence );
				_morphB.addScaledVector( _tempB.sub( _vB ), influence );
				_morphC.addScaledVector( _tempC.sub( _vC ), influence );

			}

		}

		_vA.add( _morphA );
		_vB.add( _morphB );
		_vC.add( _morphC );

	}

	if ( object.isSkinnedMesh ) {

		object.boneTransform( a, _vA );
		object.boneTransform( b, _vB );
		object.boneTransform( c, _vC );

	}

	var intersection = checkIntersection( object, material, raycaster, ray, _vA, _vB, _vC, _intersectionPoint );

	if ( intersection ) {

		if ( uv ) {

			_uvA.fromBufferAttribute( uv, a );
			_uvB.fromBufferAttribute( uv, b );
			_uvC.fromBufferAttribute( uv, c );

			intersection.uv = Triangle.getUV( _intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2() );

		}

		if ( uv2 ) {

			_uvA.fromBufferAttribute( uv2, a );
			_uvB.fromBufferAttribute( uv2, b );
			_uvC.fromBufferAttribute( uv2, c );

			intersection.uv2 = Triangle.getUV( _intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2() );

		}

		var face = new Face3( a, b, c );
		Triangle.getNormal( _vA, _vB, _vC, face.normal );

		intersection.face = face;

	}

	return intersection;

}
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
			quaternion: rootEl.quaternion.toArray(),
			scale: rootEl.scale.toArray(),
			name: rootEl.name
		};
	}

	var sendData = {
		uuid: this.uuid,
		modelClass: this.modelClass,
		position: this.position.toArray(),
		quaternion: this.quaternion.toArray(),
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
		var maxDistSq = raycaster.far * raycaster.far;
		// Checking boundingSphere distance to ray

		if (geometry.boundingSphere === null) geometry.computeBoundingSphere(this.scale);

		// optimization to getWorldPosition is only faster if getWorldPosition is also optimized!
		var sphereDistSq = raycaster.ray.distanceSqToPoint( this.getWorldPosition( tempPoint ) ) - geometry.boundingSphere.radius * geometry.boundingSphere.radius;

		if ( sphereDistSq > 0 && sphereDistSq > maxDistSq ) {
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
		var boxDistSq = ray.origin.distanceToSquared( boxIntersect );

		if ( boxDistSq > maxDistSq && !geometry.boundingBox.containsPoint(ray.origin) ) {
			return;
		}

		boxIntersect.distanceSq = boxDistSq;

		return boxIntersect;
	};
})();

export { Mesh };
