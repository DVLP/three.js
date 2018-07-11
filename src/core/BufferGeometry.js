import { Vector3 } from '../math/Vector3.js';
import { Vector4 } from '../math/Vector4.js';
import { Box3 } from '../math/Box3.js';
import { EventDispatcher } from './EventDispatcher.js';
import { BufferAttribute, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from './BufferAttribute.js';
import { Sphere } from '../math/Sphere.js';
import { DirectGeometry } from './DirectGeometry.js';
import { Object3D } from './Object3D.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Matrix3 } from '../math/Matrix3.js';
import { _Math } from '../math/Math.js';
import { arrayMax } from '../utils.js';

function makeMap( object ) {

	var map = new Map();
	for(var key in object) { object.hasOwnProperty(key) && map.set(key, object[key]); }
	return map;

}

/**
 * @author alteredq / http://alteredqualia.com/
 * @author mrdoob / http://mrdoob.com/
 */

var bufferGeometryId = 1; // BufferGeometry uses odd numbers as Id

function BufferGeometry() {

	Object.defineProperty( this, 'id', { value: bufferGeometryId += 2 } );

	this.uuid = _Math.generateUUID();

	this.name = '';
	this.type = 'BufferGeometry';

	this.index = null;
	this.attributes = {};
	this.attributesMap = null;

	this.morphAttributes = {};
	this.morphAttributesMap = null;

	this.groups = [];

	this.boundingBox = null;
	this.boundingSphere = null;

	this.drawRange = { start: 0, count: Infinity };

	this.realPositionAttribute = null;

}

BufferGeometry.prototype = Object.assign( Object.create( EventDispatcher.prototype ), {

	constructor: BufferGeometry,

	isBufferGeometry: true,

	getIndex: function () {

		return this.index;

	},

	setIndex: function ( index ) {

		if ( Array.isArray( index ) ) {

			this.index = new ( arrayMax( index ) > 65535 ? Uint32BufferAttribute : Uint16BufferAttribute )( index, 1 );

		} else {

			this.index = index;

		}

	},

	addAttribute: function ( name, attribute ) {

		if ( ! ( attribute && attribute.isBufferAttribute ) && ! ( attribute && attribute.isInterleavedBufferAttribute ) ) {

			console.warn( 'THREE.BufferGeometry: .addAttribute() now expects ( name, attribute ).' );

			this.addAttribute( name, new BufferAttribute( arguments[ 1 ], arguments[ 2 ] ) );

			return;

		}

		if ( name === 'index' ) {

			console.warn( 'THREE.BufferGeometry.addAttribute: Use .setIndex() for index attribute.' );
			this.setIndex( attribute );

			return;

		}

		this.attributes[ name ] = attribute;

		return this;

	},

	getAttribute: function ( name ) {

		return this.attributes[ name ];

	},

	removeAttribute: function ( name ) {

		delete this.attributes[ name ];

		return this;

	},

	addGroup: function ( start, count, materialIndex ) {

		this.groups.push( {

			start: start,
			count: count,
			materialIndex: materialIndex !== undefined ? materialIndex : 0

		} );

	},

	clearGroups: function () {

		this.groups = [];

	},

	setDrawRange: function ( start, count ) {

		this.drawRange.start = start;
		this.drawRange.count = count;

	},

	applyMatrix: function ( matrix ) {

		var position = this.attributes.position;

		if ( position !== undefined ) {

			matrix.applyToBufferAttribute( position );
			position.needsUpdate = true;

		}

		var normal = this.attributes.normal;

		if ( normal !== undefined ) {

			var normalMatrix = new Matrix3().getNormalMatrix( matrix );

			normalMatrix.applyToBufferAttribute( normal );
			normal.needsUpdate = true;

		}

		if ( this.boundingBox !== null ) {

			this.computeBoundingBox();

		}

		if ( this.boundingSphere !== null ) {

			this.computeBoundingSphere();

		}

		return this;

	},

	rotateX: function () {

		// rotate geometry around world x-axis

		var m1 = new Matrix4();

		return function rotateX( angle ) {

			m1.makeRotationX( angle );

			this.applyMatrix( m1 );

			return this;

		};

	}(),

	rotateY: function () {

		// rotate geometry around world y-axis

		var m1 = new Matrix4();

		return function rotateY( angle ) {

			m1.makeRotationY( angle );

			this.applyMatrix( m1 );

			return this;

		};

	}(),

	rotateZ: function () {

		// rotate geometry around world z-axis

		var m1 = new Matrix4();

		return function rotateZ( angle ) {

			m1.makeRotationZ( angle );

			this.applyMatrix( m1 );

			return this;

		};

	}(),

	translate: function () {

		// translate geometry

		var m1 = new Matrix4();

		return function translate( x, y, z ) {

			m1.makeTranslation( x, y, z );

			this.applyMatrix( m1 );

			return this;

		};

	}(),

	scale: function () {

		// scale geometry

		var m1 = new Matrix4();

		return function scale( x, y, z ) {

			m1.makeScale( x, y, z );

			this.applyMatrix( m1 );

			return this;

		};

	}(),

	lookAt: function () {

		var obj = new Object3D();

		return function lookAt( vector ) {

			obj.lookAt( vector );

			obj.updateMatrix();

			this.applyMatrix( obj.matrix );

		};

	}(),

	center: function () {

		var offset = new Vector3();

		return function center() {

			this.computeBoundingBox();

			this.boundingBox.getCenter( offset ).negate();

			this.translate( offset.x, offset.y, offset.z );

			return this;

		};

	}(),

	setFromObject: function ( object ) {

		// console.log( 'THREE.BufferGeometry.setFromObject(). Converting', object, this );

		var geometry = object.geometry;

		if ( object.isPoints || object.isLine ) {

			var positions = new Float32BufferAttribute( geometry.vertices.length * 3, 3 );
			var colors = new Float32BufferAttribute( geometry.colors.length * 3, 3 );

			this.addAttribute( 'position', positions.copyVector3sArray( geometry.vertices ) );
			this.addAttribute( 'color', colors.copyColorsArray( geometry.colors ) );

			if ( geometry.lineDistances && geometry.lineDistances.length === geometry.vertices.length ) {

				var lineDistances = new Float32BufferAttribute( geometry.lineDistances.length, 1 );

				this.addAttribute( 'lineDistance', lineDistances.copyArray( geometry.lineDistances ) );

			}

			if ( geometry.boundingSphere !== null ) {

				this.boundingSphere = geometry.boundingSphere.clone();

			}

			if ( geometry.boundingBox !== null ) {

				this.boundingBox = geometry.boundingBox.clone();

			}

		} else if ( object.isMesh ) {

			if ( geometry && geometry.isGeometry ) {

				this.fromGeometry( geometry );

			}

		}

		return this;

	},

	setFromPoints: function ( points ) {

		var position = [];

		for ( var i = 0, l = points.length; i < l; i ++ ) {

			var point = points[ i ];
			position.push( point.x, point.y, point.z || 0 );

		}

		this.addAttribute( 'position', new Float32BufferAttribute( position, 3 ) );

		return this;

	},

	updateFromObject: function ( object ) {

		var geometry = object.geometry;

		if ( object.isMesh ) {

			var direct = geometry.__directGeometry;

			if ( geometry.elementsNeedUpdate === true ) {

				direct = undefined;
				geometry.elementsNeedUpdate = false;

			}

			if ( direct === undefined ) {

				return this.fromGeometry( geometry );

			}

			direct.verticesNeedUpdate = geometry.verticesNeedUpdate;
			direct.normalsNeedUpdate = geometry.normalsNeedUpdate;
			direct.colorsNeedUpdate = geometry.colorsNeedUpdate;
			direct.uvsNeedUpdate = geometry.uvsNeedUpdate;
			direct.groupsNeedUpdate = geometry.groupsNeedUpdate;

			geometry.verticesNeedUpdate = false;
			geometry.normalsNeedUpdate = false;
			geometry.colorsNeedUpdate = false;
			geometry.uvsNeedUpdate = false;
			geometry.groupsNeedUpdate = false;

			geometry = direct;

		}

		var attribute;

		if ( geometry.verticesNeedUpdate === true ) {

			attribute = this.attributes.position;

			if ( attribute !== undefined ) {

				attribute.copyVector3sArray( geometry.vertices );
				attribute.needsUpdate = true;

			}

			geometry.verticesNeedUpdate = false;

		}

		if ( geometry.normalsNeedUpdate === true ) {

			attribute = this.attributes.normal;

			if ( attribute !== undefined ) {

				attribute.copyVector3sArray( geometry.normals );
				attribute.needsUpdate = true;

			}

			geometry.normalsNeedUpdate = false;

		}

		if ( geometry.colorsNeedUpdate === true ) {

			attribute = this.attributes.color;

			if ( attribute !== undefined ) {

				attribute.copyColorsArray( geometry.colors );
				attribute.needsUpdate = true;

			}

			geometry.colorsNeedUpdate = false;

		}

		if ( geometry.uvsNeedUpdate ) {

			attribute = this.attributes.uv;

			if ( attribute !== undefined ) {

				attribute.copyVector2sArray( geometry.uvs );
				attribute.needsUpdate = true;

			}

			geometry.uvsNeedUpdate = false;

		}

		if ( geometry.lineDistancesNeedUpdate ) {

			attribute = this.attributes.lineDistance;

			if ( attribute !== undefined ) {

				attribute.copyArray( geometry.lineDistances );
				attribute.needsUpdate = true;

			}

			geometry.lineDistancesNeedUpdate = false;

		}

		if ( geometry.groupsNeedUpdate ) {

			geometry.computeGroups( object.geometry );
			this.groups = geometry.groups;

			geometry.groupsNeedUpdate = false;

		}

		return this;

	},

	fromGeometry: function ( geometry ) {

		geometry.__directGeometry = new DirectGeometry().fromGeometry( geometry );

		return this.fromDirectGeometry( geometry.__directGeometry );

	},

	fromDirectGeometry: function ( geometry ) {

		var positions = new Float32Array( geometry.vertices.length * 3 );
		this.addAttribute( 'position', new BufferAttribute( positions, 3 ).copyVector3sArray( geometry.vertices ) );

		if ( geometry.normals.length > 0 ) {

			var normals = new Float32Array( geometry.normals.length * 3 );
			this.addAttribute( 'normal', new BufferAttribute( normals, 3 ).copyVector3sArray( geometry.normals ) );

		}

		if ( geometry.colors.length > 0 ) {

			var colors = new Float32Array( geometry.colors.length * 3 );
			this.addAttribute( 'color', new BufferAttribute( colors, 3 ).copyColorsArray( geometry.colors ) );

		}

		if ( geometry.uvs.length > 0 ) {

			var uvs = new Float32Array( geometry.uvs.length * 2 );
			this.addAttribute( 'uv', new BufferAttribute( uvs, 2 ).copyVector2sArray( geometry.uvs ) );

		}

		if ( geometry.uvs2.length > 0 ) {

			var uvs2 = new Float32Array( geometry.uvs2.length * 2 );
			this.addAttribute( 'uv2', new BufferAttribute( uvs2, 2 ).copyVector2sArray( geometry.uvs2 ) );

		}

		// groups

		this.groups = geometry.groups;

		// morphs

		if( !geometry.morphTargetsMap ) {
			geometry.morphTargetsMap = makeMap( geometry.morphTargets );
		}

		geometry.morphTargetsMap.forEach(function (morphTargets, name) {
			var array = [];

			for ( var i = 0, l = morphTargets.length; i < l; i ++ ) {

				var morphTarget = morphTargets[ i ];

				var attribute = new Float32BufferAttribute( morphTarget.length * 3, 3 );

				array.push( attribute.copyVector3sArray( morphTarget ) );

			}

			this.morphAttributes[ name ] = array;
		});

		// skinning

		if ( geometry.skinIndices.length > 0 ) {

			var skinIndices = new Float32BufferAttribute( geometry.skinIndices.length * 4, 4 );
			this.addAttribute( 'skinIndex', skinIndices.copyVector4sArray( geometry.skinIndices ) );

		}

		if ( geometry.skinWeights.length > 0 ) {

			var skinWeights = new Float32BufferAttribute( geometry.skinWeights.length * 4, 4 );
			this.addAttribute( 'skinWeight', skinWeights.copyVector4sArray( geometry.skinWeights ) );

		}

		//

		if ( geometry.boundingSphere !== null ) {

			this.boundingSphere = geometry.boundingSphere.clone();

		}

		if ( geometry.boundingBox !== null ) {

			this.boundingBox = geometry.boundingBox.clone();

		}

		return this;

	},

	computeBoundingBox: function ( explicitExpensiveMode ) {

		if ( this.boundingBox === null ) {

			this.boundingBox = new Box3();

		}

		var position = this.attributes.position;

		if ( position !== undefined ) {

			if ( ! explicitExpensiveMode ) {

				this.boundingBox.setFromBufferAttribute( position );

			} else {

				this.boundingBox.setFromBufferAttribute( this.realPositionAttribute );

			}


		} else {

			this.boundingBox.makeEmpty();

		}

		if ( isNaN( this.boundingBox.min.x ) || isNaN( this.boundingBox.min.y ) || isNaN( this.boundingBox.min.z ) ) {

			console.error( 'THREE.BufferGeometry.computeBoundingBox: Computed min/max have NaN values. The "position" attribute is likely to have NaN values.', this );

		}

	},

	computeBoundingSphere: function () {

		var box = new Box3();
		var vector = new Vector3();

		return function computeBoundingSphere( scale, explicitExpensiveMode ) {

			if ( typeof scale === 'boolean' ) {

				explicitExpensiveMode = scale;
				scale = undefined;

			}

			if ( this.boundingSphere === null ) {

				this.boundingSphere = new Sphere();

			}

			var position = this.attributes.position;

			if ( position ) {

				var center = this.boundingSphere.center;

				if ( ! explicitExpensiveMode ) {

					box.setFromBufferAttribute( position );

				} else {

					// Do NOT recalculate bounding box

					if ( ! this.boundingBox ) {

						this.computeBoundingBox( true );

					}

					box.copy( this.boundingBox );

				}

				box.getCenter( center );

				// hoping to find a boundingSphere with a radius smaller than the
				// boundingSphere of the boundingBox: sqrt(3) smaller in the best case

				var maxRadiusSq = 0;

				var attribute = ! explicitExpensiveMode ? position : this.realPositionAttribute;

				for ( var i = 0, il = attribute.count; i < il; i ++ ) {

					vector.x = attribute.getX( i );
					vector.y = attribute.getY( i );
					vector.z = attribute.getZ( i );
					maxRadiusSq = Math.max( maxRadiusSq, center.distanceToSquared( vector ) );

				}

				if(scale && scale.x) {
					this.boundingSphere.radius = Math.sqrt(maxRadiusSq) * Math.max(Math.max(Math.abs(scale.x), Math.abs(scale.y)), Math.abs(scale.z));
				} else {
					this.boundingSphere.radius = Math.sqrt(maxRadiusSq);
				}


				if ( isNaN( this.boundingSphere.radius ) ) {

					console.error( 'THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.', this );

				}

			}

			return this.boundingSphere;

		};

	}(),

	computeFaceNormals: function () {

		// backwards compatibility

	},

	computeVertexNormals: function () {

		var index = this.index;
		var attributes = this.attributes;
		var groups = this.groups;

		if ( attributes.position ) {

			var positions = attributes.position.array;

			if ( attributes.normal === undefined ) {

				this.addAttribute( 'normal', new BufferAttribute( new Float32Array( positions.length ), 3 ) );

			} else {

				// reset existing normals to zero

				var array = attributes.normal.array;

				for ( var i = 0, il = array.length; i < il; i ++ ) {

					array[ i ] = 0;

				}

			}

			var normals = attributes.normal.array;

			var vA, vB, vC;
			var pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
			var cb = new Vector3(), ab = new Vector3();

			// indexed elements

			if ( index ) {

				var indices = index.array;

				if ( groups.length === 0 ) {

					this.addGroup( 0, indices.length );

				}

				for ( var j = 0, jl = groups.length; j < jl; ++ j ) {

					var group = groups[ j ];

					var start = group.start;
					var count = group.count;

					for ( var i = start, il = start + count; i < il; i += 3 ) {

						vA = indices[ i + 0 ] * 3;
						vB = indices[ i + 1 ] * 3;
						vC = indices[ i + 2 ] * 3;

						pA.fromArray( positions, vA );
						pB.fromArray( positions, vB );
						pC.fromArray( positions, vC );

						cb.subVectors( pC, pB );
						ab.subVectors( pA, pB );
						cb.cross( ab );

						normals[ vA ] += cb.x;
						normals[ vA + 1 ] += cb.y;
						normals[ vA + 2 ] += cb.z;

						normals[ vB ] += cb.x;
						normals[ vB + 1 ] += cb.y;
						normals[ vB + 2 ] += cb.z;

						normals[ vC ] += cb.x;
						normals[ vC + 1 ] += cb.y;
						normals[ vC + 2 ] += cb.z;

					}

				}

			} else {

				// non-indexed elements (unconnected triangle soup)

				for ( var i = 0, il = positions.length; i < il; i += 9 ) {

					pA.fromArray( positions, i );
					pB.fromArray( positions, i + 3 );
					pC.fromArray( positions, i + 6 );

					cb.subVectors( pC, pB );
					ab.subVectors( pA, pB );
					cb.cross( ab );

					normals[ i ] = cb.x;
					normals[ i + 1 ] = cb.y;
					normals[ i + 2 ] = cb.z;

					normals[ i + 3 ] = cb.x;
					normals[ i + 4 ] = cb.y;
					normals[ i + 5 ] = cb.z;

					normals[ i + 6 ] = cb.x;
					normals[ i + 7 ] = cb.y;
					normals[ i + 8 ] = cb.z;

				}

			}

			this.normalizeNormals();

			attributes.normal.needsUpdate = true;

		}

	},

	merge: function ( geometry, offset ) {

		if ( ! ( geometry && geometry.isBufferGeometry ) ) {

			console.error( 'THREE.BufferGeometry.merge(): geometry not an instance of THREE.BufferGeometry.', geometry );
			return;

		}

		if ( offset === undefined ) {

			offset = 0;

			console.warn(
				'THREE.BufferGeometry.merge(): Overwriting original geometry, starting at offset=0. '
				+ 'Use BufferGeometryUtils.mergeBufferGeometries() for lossless merge.'
			);

		}

		var attributes = this.attributes;

		var orgCount = this.attributes.position.count;

		var newIndex = [];//new Float32Array( this.index.count * 2 );

		var indicesByVertex = [];

		this.index.array.forEach( ( el, ind ) => {

			if ( indicesByVertex[ el ] === undefined ) {

				indicesByVertex[ el ] = [ ind ];

			} else {

				indicesByVertex[ el ].push( ind );

			}

		} );

		var addonIndicesByVertex = [];

		geometry.index.array.forEach( ( el, ind ) => {

			if ( addonIndicesByVertex[ el ] === undefined ) {

				addonIndicesByVertex[ el ] = [ ind ];

			} else {

				addonIndicesByVertex[ el ].push( ind );

			}

		} );

		for ( var key in attributes ) {

			if ( geometry.attributes[ key ] === undefined ) continue;

			var attribute1 = attributes[ key ];
			var attributeArray1 = attribute1.array;

			var attribute2 = geometry.attributes[ key ];
			var attributeArray2 = attribute2.array;

			var newArray = new Float32Array( attributeArray1.length + attributeArray2.length );

			var offsetActual = attribute1.count * attribute1.itemSize * offset;

			for ( var k = 0; k < attributeArray1.length; k ++ ) {

				newArray[ k ] = attributeArray1[ k ];

			}

			for ( var i = 0, j = offsetActual; i < attributeArray2.length; i ++, j ++ ) {

				newArray[ j ] = attributeArray2[ i ];

			}

			// this.removeAttribute( key );
			// this.addAttribute( key, new BufferAttribute( newArray, attribute1.itemSize ) );

			attributes[ key ].array = newArray;
			attributes[ key ].count = newArray.length / attribute1.itemSize;
			attributes[ key ].needsUpdate = true;

		}

		// rebuild index
		this.groups.forEach( ( group, groupIndex ) => {

			const groupStart = group.start;
			const groupCount = group.count;
			var addonGroup = geometry.groups.find( el2 => el2.materialIndex === group.materialIndex );
			var addonStart = addonGroup.start;
			var addonCount = addonGroup.count;

			var mergedGroupStart = groupStart + addonStart;
			var mergedGroupCount = groupCount + addonCount;

			// traverse old group
			for ( var u = 0; u < groupCount; u ++ ) {

				var v = this.index.array[ groupStart + u ];

				var vtf = indicesByVertex[ v ].length;
				for ( var o = 0; o < vtf; o ++ ) {

					var indiceIndex = indicesByVertex[ v ][ o ];
					var relativeToStartIndex = indiceIndex - groupStart;
					newIndex[ mergedGroupStart + relativeToStartIndex ] = v;

					// only worked for identical copies
					// newIndex[ indiceIndex + start + groupCount ] = v + orgCount;

				}

			}

			// traverse addon group
			for ( var u = 0; u < addonCount; u ++ ) {

				var v = geometry.index.array[ addonStart + u ];

				var vtf = addonIndicesByVertex[ v ].length;
				for ( var o = 0; o < vtf; o ++ ) {

					var indiceIndex = addonIndicesByVertex[ v ][ o ];
					var relativeToStartIndex = indiceIndex - addonStart;
					newIndex[ mergedGroupStart + groupCount + relativeToStartIndex ] = v + orgCount;

				}

			}

		} );

		var oldGroups = this.groups;
		var mergedInGroups = geometry.groups;

		this.clearGroups();

		oldGroups.forEach( el => {

			var mergedInGroup = mergedInGroups.find( el2 => el2.materialIndex === el.materialIndex );

			this.addGroup( el.start + mergedInGroup.start, el.count + mergedInGroup.count, el.materialIndex );

		} );

		this.setIndex( newIndex );

		return this;

	},

	normalizeNormals: function () {

		var vector = new Vector3();

		return function normalizeNormals() {

			var normals = this.attributes.normal;

			for ( var i = 0, il = normals.count; i < il; i ++ ) {

				vector.x = normals.getX( i );
				vector.y = normals.getY( i );
				vector.z = normals.getZ( i );

				vector.normalize();

				normals.setXYZ( i, vector.x, vector.y, vector.z );

			}

		};

	}(),

	toIndexed: function () {

		let prec = 0;
		let list = [];
		let vertices = {};

		function store( x, y, z, v ) {

			const id = Math.floor( x * prec ) + '_' + Math.floor( y * prec ) + '_' + Math.floor( z * prec );

			if ( vertices[ id ] === undefined ) {

				vertices[ id ] = list.length;


				list.push( v );

			}

			return vertices[ id ];

		}

  	function indexBufferGeometry( src, dst ) {

			const position = src.attributes.position.array;

			const faceCount = ( position.length / 3 ) / 3;


			const type = faceCount * 3 > 65536 ? Uint32Array : Uint16Array;

			const indexArray = new type( faceCount * 3 );

			for ( let i = 0, l = faceCount; i < l; i ++ ) {

				const offset = i * 9;

				indexArray[ i * 3 ] = store( position[ offset ], position[ offset + 1 ], position[ offset + 2 ], i * 3 );
				indexArray[ i * 3 + 1 ] = store( position[ offset + 3 ], position[ offset + 4 ], position[ offset + 5 ], i * 3 + 1 );
				indexArray[ i * 3 + 2 ] = store( position[ offset + 6 ], position[ offset + 7 ], position[ offset + 8 ], i * 3 + 2 );

			}

		  dst.index = new BufferAttribute( indexArray, 1 );

		  const count = list.length;

			for ( let key in src.attributes ) {

				const src_attribute = src.attributes[ key ];
				const dst_attribute = new BufferAttribute( new src_attribute.array.constructor( count * src_attribute.itemSize ), src_attribute.itemSize );

				const dst_array = dst_attribute.array;
				const src_array = src_attribute.array;

				switch ( src_attribute.itemSize ) {

					case 1:

						for ( let i = 0, l = list.length; i < l; i ++ ) {

						  dst_array[ i ] = src_array[ list[ i ] ];

						}

						break;
					case 2:

						for ( let i = 0, l = list.length; i < l; i ++ ) {

							  const index = list[ i ] * 2;

							  const offset = i * 2;

							  dst_array[ offset ] = src_array[ index ];
							  dst_array[ offset + 1 ] = src_array[ index + 1 ];

						}

						break;
					case 3:

						for ( let i = 0, l = list.length; i < l; i ++ ) {

							  const index = list[ i ] * 3;

							  const offset = i * 3;

							  dst_array[ offset ] = src_array[ index ];
							  dst_array[ offset + 1 ] = src_array[ index + 1 ];
							  dst_array[ offset + 2 ] = src_array[ index + 2 ];

						}

						break;
					case 4:

						for ( let i = 0, l = list.length; i < l; i ++ ) {

							  const index = list[ i ] * 4;

							  const offset = i * 4;

							  dst_array[ offset ] = src_array[ index ];
							  dst_array[ offset + 1 ] = src_array[ index + 1 ];
							  dst_array[ offset + 2 ] = src_array[ index + 2 ];
							  dst_array[ offset + 3 ] = src_array[ index + 3 ];

						}

						break;

				}

				dst.attributes[ key ] = dst_attribute;

			}


		  dst.computeBoundingSphere();

		  dst.computeBoundingBox();

		  src.groups.forEach( group => {

		  	dst.addGroup( group.start / 3, group.count / 3, group.materialIndex );

		  } );

		  // Release data

		  vertices = {};
		  list = [];

  	}

		return function ( precision ) {

			prec = Math.pow( 10, precision || 6 );

			const geometry = new BufferGeometry();

			indexBufferGeometry( this, geometry );

			return geometry;

		};

	}(),

	toNonIndexed: function () {

		if ( this.index === null ) {

			console.warn( 'THREE.BufferGeometry.toNonIndexed(): Geometry is already non-indexed.' );
			return this;

		}

		var geometry2 = new BufferGeometry();

		var indices = this.index.array;
		var attributes = this.attributes;

		for ( var name in attributes ) {

			var attribute = attributes[ name ];

			var array = attribute.array;
			var itemSize = attribute.itemSize;

			var array2 = new array.constructor( indices.length * itemSize );

			var index = 0, index2 = 0;

			for ( var i = 0, l = indices.length; i < l; i ++ ) {

				index = indices[ i ] * itemSize;

				for ( var j = 0; j < itemSize; j ++ ) {

					array2[ index2 ++ ] = array[ index ++ ];

				}

			}

			geometry2.addAttribute( name, new BufferAttribute( array2, itemSize ) );

		}

		var groups = this.groups;

		for ( var i = 0, l = groups.length; i < l; i ++ ) {

			var group = groups[ i ];
			geometry2.addGroup( group.start, group.count, group.materialIndex );

		}

		return geometry2;

	},

	toJSON: function () {

		var data = {
			metadata: {
				version: 4.5,
				type: 'BufferGeometry',
				generator: 'BufferGeometry.toJSON'
			}
		};

		// standard BufferGeometry serialization

		data.uuid = this.uuid;
		data.type = this.type;
		if ( this.name !== '' ) data.name = this.name;

		if ( this.parameters !== undefined ) {

			var parameters = this.parameters;

			for ( var key in parameters ) {

				if ( parameters[ key ] !== undefined ) data[ key ] = parameters[ key ];

			}

			return data;

		}

		data.data = { attributes: {} };

		var index = this.index;

		if ( index !== null ) {

			var array = Array.prototype.slice.call( index.array );

			data.data.index = {
				type: index.array.constructor.name,
				array: array
			};

		}

		var attributes = this.attributes;

		for ( var key in attributes ) {

			var attribute = attributes[ key ];

			var array = Array.prototype.slice.call( attribute.array );

			data.data.attributes[ key ] = {
				itemSize: attribute.itemSize,
				type: attribute.array.constructor.name,
				array: array,
				normalized: attribute.normalized
			};

		}

		var groups = this.groups;

		if ( groups.length > 0 ) {

			data.data.groups = JSON.parse( JSON.stringify( groups ) );

		}

		var boundingSphere = this.boundingSphere;

		if ( boundingSphere !== null ) {

			data.data.boundingSphere = {
				center: boundingSphere.center.toArray(),
				radius: boundingSphere.radius
			};

		}

		return data;

	},

	clone: function () {

		/*
		 // Handle primitives

		 var parameters = this.parameters;

		 if ( parameters !== undefined ) {

		 var values = [];

		 for ( var key in parameters ) {

		 values.push( parameters[ key ] );

		 }

		 var geometry = Object.create( this.constructor.prototype );
		 this.constructor.apply( geometry, values );
		 return geometry;

		 }

		 return new this.constructor().copy( this );
		 */

		return new BufferGeometry().copy( this );

	},

	copy: function ( source ) {

		var name, i, l;

		// reset

		this.index = null;
		this.attributes = {};
		this.morphAttributes = {};
		this.groups = [];
		this.boundingBox = null;
		this.boundingSphere = null;

		// name

		this.name = source.name;

		// index

		var index = source.index;

		if ( index !== null ) {

			this.setIndex( index.clone() );

		}

		// attributes

		var attributes = source.attributes;

		for ( name in attributes ) {

			var attribute = attributes[ name ];
			this.addAttribute( name, attribute.clone() );

		}

		// morph attributes

		var morphAttributes = source.morphAttributes;

		for ( name in morphAttributes ) {

			var array = [];
			var morphAttribute = morphAttributes[ name ]; // morphAttribute: array of Float32BufferAttributes

			for ( i = 0, l = morphAttribute.length; i < l; i ++ ) {

				array.push( morphAttribute[ i ].clone() );

			}

			this.morphAttributes[ name ] = array;

		}

		// groups

		var groups = source.groups;

		for ( i = 0, l = groups.length; i < l; i ++ ) {

			var group = groups[ i ];
			this.addGroup( group.start, group.count, group.materialIndex );

		}

		// bounding box

		var boundingBox = source.boundingBox;

		if ( boundingBox !== null ) {

			this.boundingBox = boundingBox.clone();

		}

		// bounding sphere

		var boundingSphere = source.boundingSphere;

		if ( boundingSphere !== null ) {

			this.boundingSphere = boundingSphere.clone();

		}

		// draw range

		this.drawRange.start = source.drawRange.start;
		this.drawRange.count = source.drawRange.count;

		return this;

	},

	dispose: function () {

		this.dispatchEvent( { type: 'dispose' } );

	},

	expensiveCalculateVertices: ( function () {

		var i, l;
		var properties = [ 'x', 'y', 'z', 'w' ];
		var temp2 = new Vector3(), skinIndex = new Vector4(), skinWeights = new Vector4();
		var temp = new Vector3(), tempMatrix = new Matrix4(), properties = [ 'x', 'y', 'z', 'w' ];
		var result = new Vector3();

		return function expensiveCalculateVertices( meshRef ) {

			const position = this.attributes.position;

			if ( this.realPositionAttribute === null ) {

				this.realPositionAttribute = position.clone();

			}

			for ( i = 0, l = this.index.count; i < l; i ++ ) {

				var idx = this.index.getX( i );
				var index4 = idx << 2;
				var typedOffset = idx * position.itemSize;

				skinIndex.fromArray( this.attributes.skinIndex.array, index4 );
				skinWeights.fromArray( this.attributes.skinWeight.array, index4 );
				temp.fromArray( position.array, typedOffset );
				temp.applyMatrix4( meshRef.bindMatrix );
				result.set( 0, 0, 0 );

				for ( var j = 0; j < 4; j ++ ) {

					var prop = properties[ j ];

					var skinWeight = skinWeights[ prop ];
					var boneIndex = skinIndex[ prop ];

					if ( skinWeight != 0 ) {

						tempMatrix.multiplyMatrices( meshRef.skeleton.bones[ boneIndex ].matrixWorld, meshRef.skeleton.boneInverses[ boneIndex ] );
						result.add( temp2.copy( temp ).applyMatrix4( tempMatrix ).multiplyScalar( skinWeight ) );

					}

				}

				result.applyMatrix4( meshRef.bindMatrixInverse );

				this.realPositionAttribute.setX( idx, result.x );
				this.realPositionAttribute.setY( idx, result.y );
				this.realPositionAttribute.setZ( idx, result.z );

			}

		};

	} )(),

} );


export { BufferGeometry };
