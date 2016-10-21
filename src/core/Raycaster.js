import { Ray } from '../math/Ray';

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

	return a.distance - b.distance;

}

function descSort(a, b) {

  return a.distance - b.distance;

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

//

Raycaster.prototype = {

	constructor: Raycaster,

	linePrecision: 1,

	set: function ( origin, direction ) {

		// direction is assumed to be normalized (for accurate distance calculations)

		this.ray.set( origin, direction );

	},

	setFromCamera: function ( coords, camera ) {

		if ( (camera && camera.isPerspectiveCamera) ) {

			this.ray.origin.setFromMatrixPosition( camera.matrixWorld );
			this.ray.direction.set( coords.x, coords.y, 0.5 ).unproject( camera ).sub( this.ray.origin ).normalize();

		} else if ( (camera && camera.isOrthographicCamera) ) {

			this.ray.origin.set( coords.x, coords.y, ( camera.near + camera.far ) / ( camera.near - camera.far ) ).unproject( camera ); // set origin in plane of camera
			this.ray.direction.set( 0, 0, - 1 ).transformDirection( camera.matrixWorld );

		} else {

			console.error( 'THREE.Raycaster: Unsupported camera type.' );

		}

	},

	intersectObject: function ( object, recursive ) {

		var intersects = [];

		intersectObject( object, this, intersects, recursive );

		intersects.sort( ascSort );

		return intersects;

	},

	intersectObjects: function ( objects, recursive ) {

		var intersects = [];

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

};


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

  intersects.sort(descSort);

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

  intersects.sort(descSort);

  return intersects;

};

Raycaster.prototype.intersectRemote = function(data, callback, scene) {

  var results = [];
  var objCache = {};

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

      if (item.name === 'terrainMesh') {

        obj = objCache[item.name] = item;

      } else {

        obj = objCache[item.name] = rootObject.getObjectByProperty('name', item.name);

        if (!obj || rootObject === obj) {

          console.warn('No object with name: ', item.name, ' found');

        }

      }

    }

    if (item.name !== 'terrainMesh') {

      obj.allTransformsFromArrays(item);

    }

    if (data.bboxOnly) {

      // TODO: This was bbox version and should be separate from full intersection version
      intersects = obj.raycastBBoxOnly(this);

    } else {

      if (item.name === 'window1') {
        //debugger;
      }
      obj.raycast(this, intersects);

    }

    intersects && this.prepareAnswer(intersects, results, item.uuid);

  }

  if (typeof callback !== 'undefined') {

    callback(results);

  }

  results.sort(function(a, b) {

    return a.distance - b.distance;

  });

  return results;

};

Raycaster.prototype.prepareAnswer = function(intersects, results, uuid) {

  // if returned value is function this is a bboxonly result
  if (typeof intersects.length === 'function') {

    results.push({
      bboxOnly: true,
      uuid: uuid,
      point: intersects
    });

    return;
  }

  for (var i = 0, j = intersects.length; i < j; ++i) {

    var intersect = intersects[i];

    results.push({
      bboxOnly: false,
      uuid: uuid,
      name: intersect.object.name,
      distance: intersect.distance,
      point: intersect.point.clone(),
      face: intersect.face.clone(),
      faceIndex: intersect.faceIndex,
      uv: intersect.uv && intersect.uv.clone()
    });

  }

};

export { Raycaster };
