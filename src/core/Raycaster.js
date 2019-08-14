import { Ray } from '../math/Ray.js';

/**
 * @author mrdoob / http://mrdoob.com/
 * @author bhouston / http://clara.io/
 * @author stephomi / http://stephaneginier.com/
 */

function Raycaster( origin, direction, near, far ) {

	this.ray = new Ray( origin, direction );
	// direction is assumed to be normalized (for accurate distance calculations)

	this.near = near || 0;
	this.far = far || Infinity;

	this.params = {
		Mesh: {},
		Line: {},
		LOD: {},
		Points: { threshold: 1 },
		Sprite: {}
	};

	Object.defineProperties( this.params, {
		PointCloud: {
			get: function () {

				console.warn( 'THREE.Raycaster: params.PointCloud has been renamed to params.Points.' );
				return this.Points;

			}
		}
	} );

}

function ascSort( a, b ) {

	return a.distanceSq - b.distanceSq;

}

function intersectObject( object, raycaster, intersects, recursive ) {

	if ( object.visible === false ) return;

	object.raycast( raycaster, intersects );

	if ( recursive === true ) {

		var children = object.children;

		for ( var i = 0, l = children.length; i < l; i ++ ) {

			intersectObject( children[ i ], raycaster, intersects, true );

		}

	}

}

Object.assign( Raycaster.prototype, {

	linePrecision: 1,

	set: function ( origin, direction ) {

		// direction is assumed to be normalized (for accurate distance calculations)

		this.ray.set( origin, direction );

	},

	setFromCamera: function ( coords, camera ) {

		if ( ( camera && camera.isPerspectiveCamera ) ) {

			this.ray.origin.setFromMatrixPosition( camera.matrixWorld );
			this.ray.direction.set( coords.x, coords.y, 0.5 ).unproject( camera ).sub( this.ray.origin ).normalize();

		} else if ( ( camera && camera.isOrthographicCamera ) ) {

			this.ray.origin.set( coords.x, coords.y, ( camera.near + camera.far ) / ( camera.near - camera.far ) ).unproject( camera ); // set origin in plane of camera
			this.ray.direction.set( 0, 0, - 1 ).transformDirection( camera.matrixWorld );

		} else {

			console.error( 'THREE.Raycaster: Unsupported camera type.' );

		}

	},

	intersectObject: function ( object, recursive, optionalTarget ) {

		var intersects = optionalTarget || [];

		intersectObject( object, this, intersects, recursive );

		intersects.sort( ascSort );

		return intersects;

	},

	intersectObjects: function ( objects, recursive, optionalTarget ) {

		var intersects = optionalTarget || [];

		if ( Array.isArray( objects ) === false ) {

			console.warn( 'THREE.Raycaster.intersectObjects: objects is not an Array.' );
			return intersects;

		}

		for ( var i = 0, l = objects.length; i < l; i ++ ) {

			intersectObject( objects[ i ], this, intersects, recursive );

		}

		intersects.sort( ascSort );

		return intersects;

	}

} );


var intersectInvisibleObject = function(object, raycaster, intersects, recursive) {

  object.raycast(raycaster, intersects);

  if (recursive === true) {

    console.warn('Do not use for recursion! Returning.');
    return;

  }

};

Raycaster.prototype.intersectInvisibleObjects = function(objects, recursive) {

  var intersects = [];

  if (Array.isArray(objects) === false) {

    console.warn('THREE.Raycaster.intersectObjects: objects is not an Array.');
    return intersects;

  }

  for (var i = 0, l = objects.length; i < l; i++) {

    intersectInvisibleObject(objects[i], this, intersects, recursive);

  }

  intersects.sort(ascSort);

  return intersects;

};

Raycaster.prototype.intersectBBoxes = function(objects, recursive) {

  var intersects = [];
  var intersect = null;

  for (var i = 0, l = objects.length; i < l; i++) {

    var obj = objects[i];

    if ((intersect = obj.raycastBBoxOnly(this))) {
      intersect.object = obj;
      intersects.push(intersect);
    }

  }

  intersects.sort(ascSort);

  return intersects;

};

Raycaster.prototype.intersectRemote = function ( data, callback, scene, objCache ) {

  var results = [];

  this.ray.origin.fromArray(data.raycaster.origin);
  this.ray.direction.fromArray(data.raycaster.direction);

  this.near = data.raycaster.near || this.near;
  this.far = data.raycaster.far || this.far;

  for (var i = 0, j = data.items.length; i < j; ++i) {
    var item = data.items[i],
      intersects = [],
      rootObject = scene;

    if (item.root) {
      rootObject = scene.getObjectByProperty('name', item.root.name);
      rootObject.allTransformsFromArrays(item.root);
    }

    var obj = objCache[item.name];

    if (!obj) {

      if (item.name === 'terrainMesh' || item.name.includes('tiles_cluster')) {

        obj = objCache[item.name] = item;

      } else {
        // find element belonging to it's parent i.e. car window, but not player inside car
        obj = objCache[item.name] = rootObject.getObjectByProperty('name', item.name);

        if (!obj || rootObject === obj) {

          console.warn('No object with name: ', item.name, ' found inside: ', rootObject.name);
          continue;

        }

      }

    }

    if (item.name !== 'terrainMesh' && !item.name.includes('tiles_cluster')) {

      obj.allTransformsFromArrays(item);

    }

		if ( item.type === 'actor' ) {

			const bones = item.bones;

			if ( bones ) {

				const skeleton = obj.skeleton;
				if ( ! skeleton ) {

					console.warn( 'Item was provided bones, but it does not have a skeleton' );
					continue;

				}

				// obj.updateBones(obj, bones);
				const hips = obj.bones[ 'Bone.Hips' ];
				Object.keys( bones ).forEach( key => {

					if ( bones[ key ].position ) obj.bones[ key ].position.fromArray( bones[ key ].position );
					obj.bones[ key ].quaternion.fromArray( bones[ key ].quaternion );
					// obj.bones[ key ].updateMatrix();
					// Or once for the whole mesh with children?
					// obj.bones[ key ].updateMatrixWorldNoChildren(true);

				} );

				obj.updateMatrixWorld( true );
				obj.geometry.expensiveCalculateVertices( obj );
				obj.geometry.computeBoundingBox( true );
				obj.geometry.computeBoundingSphere( true );

				// obj.bones[ 'Bone.Hips' ].position.set(0, 0, 0);
				// obj.bones[ 'Bone.Hips' ].updateMatrix();
				// obj.bones[ 'Bone.Hips' ].updateMatrixWorldNoChildren( true );
				// obj.bones[ 'Bone.Hips' ].updateMatrixWorld( true );

			}

		}

    if (data.bboxOnly) {

      // TODO: This was bbox version and should be separate from full intersection version
      var intersect = obj.raycastBBoxOnly(this);
      intersect && intersects.push(intersect);

    } else {

      if (item.name === 'window1') {
        //debugger;
      }
      obj.raycast(this, intersects);

    }

    intersects.length && this.prepareAnswer(intersects, results, item.uuid);

  }

  results.sort(function(a, b) {

    return a.distanceSq - b.distanceSq;

  });

  if (typeof callback !== 'undefined') {

    callback(results);

  }

  return results;

};

Raycaster.prototype.prepareAnswer = function(intersects, results, uuid) {

  for (var i = 0, j = intersects.length; i < j; ++i) {

    var intersect = intersects[i];

    if (intersect.isVector3) { // Vector3 intersect is for bboxonly intersection type
      results.push({
        bboxOnly: true,
        uuid: uuid,
        point: intersect,
      });
    } else {
      results.push({
        bboxOnly: false,
        uuid: uuid,
        name: intersect.object.name,
        distanceSq: intersect.distanceSq !== undefined ? intersect.distanceSq : this.ray.origin.distanceToSquared( intersect.point ), // workaround for accelerated raycast
        point: intersect.point,
        face: intersect.face,
        faceIndex: intersect.faceIndex,
        uv: intersect.uv && intersect.uv,
      });
    }

  }

};

export { Raycaster };
