import { Mesh } from './Mesh.js';
import { Vector3 } from '../math/Vector3.js';
import { Vector4 } from '../math/Vector4.js';
import { Skeleton } from './Skeleton.js';
import { Bone } from './Bone.js';
import { Matrix4 } from '../math/Matrix4.js';

/**
 * @author mikael emtinger / http://gomo.se/
 * @author alteredq / http://alteredqualia.com/
 * @author ikerr / http://verold.com
 */

function SkinnedMesh( geometry, material ) {

	Mesh.call( this, geometry, material );

	this.type = 'SkinnedMesh';

	this.bindMode = 'attached';
	this.bindMatrix = new Matrix4();
	this.bindMatrixInverse = new Matrix4();

	// DO NOT USE or it causes bones duplication in older meshes, use initBones from Utils if required
	// if (geometry.bones) {
	// 	var bones = this.initBones();
	// 	var skeleton = new Skeleton( bones );

	// 	this.bind( skeleton, this.matrixWorld );

	// 	this.normalizeSkinWeights();
	// }

}

SkinnedMesh.prototype = Object.assign( Object.create( Mesh.prototype ), {

	constructor: SkinnedMesh,

	isSkinnedMesh: true,

	initBones: function () {

		var bones = [], bone, gbone;
		var i, il;

		if ( this.geometry && this.geometry.bones !== undefined ) {

			// first, create array of 'Bone' objects from geometry data

			for ( i = 0, il = this.geometry.bones.length; i < il; i ++ ) {

				gbone = this.geometry.bones[ i ];

				// create new 'Bone' object

				bone = new Bone();
				bones.push( bone );

				// apply values

				bone.name = gbone.name;
				bone.position.fromArray( gbone.pos );
				bone.quaternion.fromArray( gbone.rotq );
				if ( gbone.scl !== undefined ) bone.scale.fromArray( gbone.scl );

			}

			// second, create bone hierarchy

			for ( i = 0, il = this.geometry.bones.length; i < il; i ++ ) {

				gbone = this.geometry.bones[ i ];

				if ( ( gbone.parent !== - 1 ) && ( gbone.parent !== null ) && ( bones[ gbone.parent ] !== undefined ) ) {

					// subsequent bones in the hierarchy

					bones[ gbone.parent ].add( bones[ i ] );

				} else {

					// topmost bone, immediate child of the skinned mesh

					this.add( bones[ i ] );

				}

			}

		}

		// now the bones are part of the scene graph and children of the skinned mesh.
		// let's update the corresponding matrices

		this.updateMatrixWorld( true );

		return bones;

	},

	bind: function ( skeleton, bindMatrix ) {

		this.skeleton = skeleton;

		if ( bindMatrix === undefined ) {

			this.updateMatrixWorld( true );

			this.skeleton.calculateInverses();

			bindMatrix = this.matrixWorld;

		}

		this.bindMatrix.copy( bindMatrix );
		this.bindMatrixInverse.getInverse( bindMatrix );

	},

	pose: function () {

		this.skeleton.pose();

	},

	normalizeSkinWeights: function () {

		const vector = new Vector4();

		const skinWeight = this.geometry.attributes.skinWeight;

		for ( let i = 0, l = skinWeight.count; i < l; i ++ ) {

			vector.x = skinWeight.getX( i );
			vector.y = skinWeight.getY( i );
			vector.z = skinWeight.getZ( i );
			vector.w = skinWeight.getW( i );

			const scale = 1.0 / vector.manhattanLength();

			if ( scale !== Infinity ) {

				vector.multiplyScalar( scale );

			} else {

				vector.set( 1, 0, 0, 0 ); // do something reasonable

			}

			skinWeight.setXYZW( i, vector.x, vector.y, vector.z, vector.w );

		}

	},

	updateMatrixWorld: function ( force ) {

		Mesh.prototype.updateMatrixWorld.call( this, force );

		if ( this.bindMode === 'attached' ) {

			this.bindMatrixInverse.getInverse( this.matrixWorld );

		} else if ( this.bindMode === 'detached' ) {

			this.bindMatrixInverse.getInverse( this.bindMatrix );

		} else {

			console.warn( 'THREE.SkinnedMesh: Unrecognized bindMode: ' + this.bindMode );

		}

	},

	clone: function () {

		return new this.constructor( this.geometry, this.material ).copy( this );

	},

	boneTransform: ( function () {

		var basePosition = new Vector3();

		var skinIndex = new Vector4();
		var skinWeight = new Vector4();

		var vector = new Vector3();
		var matrix = new Matrix4();

		return function ( index, target ) {

			var skeleton = this.skeleton;
			var geometry = this.geometry;

			skinIndex.fromBufferAttribute( geometry.attributes.skinIndex, index );
			skinWeight.fromBufferAttribute( geometry.attributes.skinWeight, index );

			basePosition.fromBufferAttribute( geometry.attributes.position, index ).applyMatrix4( this.bindMatrix );

			target.set( 0, 0, 0 );

			for ( var i = 0; i < 4; i ++ ) {

				var weight = skinWeight.getComponent( i );

				if ( weight !== 0 ) {

					var boneIndex = skinIndex.getComponent( i );

					matrix.multiplyMatrices( skeleton.bones[ boneIndex ].matrixWorld, skeleton.boneInverses[ boneIndex ] );

					target.addScaledVector( vector.copy( basePosition ).applyMatrix4( matrix ), weight );

				}

			}

			return target.applyMatrix4( this.bindMatrixInverse );

		};

	}() ),

	raycast: function raycast( raycaster, intersects ) {

		if ( this.geometry.realPositionAttribute === null ) {

			this.geometry.expensiveUpdateVertices( this );

		}

		var tmpPosition = this.geometry.attributes.position.array;
		this.geometry.attributes.position.array = this.geometry.realPositionAttribute.array;
		Mesh.prototype.raycast.call( this, raycaster, intersects );
		this.geometry.attributes.position.array = tmpPosition;

	}

} );


export { SkinnedMesh };
