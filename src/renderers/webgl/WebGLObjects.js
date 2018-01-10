/**
 * @author mrdoob / http://mrdoob.com/
 */

function WebGLObjects( geometries, infoRender ) {

	function makeMap( object ) {

		var map = new Map();
		for(var key in object) { object.hasOwnProperty(key) && map.set(key, object[key]); }
		return map;

	}

	var updateList = {};

	function update( object ) {

		var frame = infoRender.frame;

		var geometry = object.geometry;
		var buffergeometry = geometries.get( object, geometry );

		if( object.updated ) return object.geometry;

		object.updated = true;


		// Update once per frame

		if ( updateList[ buffergeometry.id ] !== frame ) {

			if ( geometry.isGeometry ) {

				buffergeometry.updateFromObject( object );

			}

			geometries.update( buffergeometry );

			updateList[ buffergeometry.id ] = frame;

		}

		return buffergeometry;

	}

	function dispose() {

		updateList = {};

	}

	return {

		update: update,
		dispose: dispose

	};

}


export { WebGLObjects };
