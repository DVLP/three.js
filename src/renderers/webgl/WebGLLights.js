/**
 * @author mrdoob / http://mrdoob.com/
 */

import { Color } from '../../math/Color.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Vector2 } from '../../math/Vector2.js';
import { Vector3 } from '../../math/Vector3.js';

function UniformsCache() {

	var lights = {};

	return {

		get: function ( light ) {

			if ( lights[ light.id ] !== undefined ) {

				return lights[ light.id ];

			}

			var uniforms;

			switch ( light.type ) {

				case 'DirectionalLight':
					uniforms = {
						direction: new Vector3(),
						color: new Color(),

						shadow: false,
						shadowBias: 0,
						shadowRadius: 1,
						shadowMapSize: new Vector2()
					};
					break;

				case 'SpotLight':
					uniforms = {
						position: new Vector3(),
						direction: new Vector3(),
						color: new Color(),
						distance: 0,
						coneCos: 0,
						penumbraCos: 0,
						decay: 0,

						shadow: false,
						shadowBias: 0,
						shadowRadius: 1,
						shadowMapSize: new Vector2()
					};
					break;

				case 'PointLight':
					uniforms = {
						position: new Vector3(),
						color: new Color(),
						distance: 0,
						decay: 0,

						shadow: false,
						shadowBias: 0,
						shadowRadius: 1,
						shadowMapSize: new Vector2(),
						shadowCameraNear: 1,
						shadowCameraFar: 1000
					};
					break;

				case 'HemisphereLight':
					uniforms = {
						direction: new Vector3(),
						skyColor: new Color(),
						groundColor: new Color()
					};
					break;

				case 'RectAreaLight':
					uniforms = {
						color: new Color(),
						position: new Vector3(),
						halfWidth: new Vector3(),
						halfHeight: new Vector3()
						// TODO (abelnation): set RectAreaLight shadow uniforms
					};
					break;

			}

			lights[ light.id ] = uniforms;

			return uniforms;

		}

	};

}

function WebGLLights() {

	var cache = new UniformsCache();

	var state = {

		hash: '',

		ambient: [ 0, 0, 0 ],
		directional: [],
		directionalShadowMap: [],
		directionalShadowMatrix: [],
		spot: [],
		spotShadowMap: [],
		spotShadowMatrix: [],
		rectArea: [],
		point: [],
		pointShadowMap: [],
		pointShadowMatrix: [],
		hemi: []

	};

	var vector3 = new Vector3();
	var matrix4 = new Matrix4();
	var matrix42 = new Matrix4();

	var maxSpotLights = 2;
	// 1. We don't want lights hash to change - this would trigger needsUpdate on materials!
	// 2. We want to keep a pool of 6 lights to be reused when needed
	// 3. In case of adding more than 6 lights, only placeholder objects should be created
	function setupSpotlightsFromPool (lights, camera) {
		var spotLightsPool = [];
		var spotLength = 0;
		var viewMatrix = camera.matrixWorldInverse;

		// get all spotlights into an array
		for ( var l = 0, ll = lights.length; l < ll; l ++ ) {
			var light = lights[l];

			if(light.isSpotLight) {
				spotLightsPool.push(light);

				var distnace = vector3.setFromMatrixPosition(light.matrixWorld).distanceTo(camera.parent ? camera.parent.position : new Vector3(0, 0, 0));
				var inFrustum = (light.parent && light.parent.inFrustum) ? 1 : 3; // not being in frustum makes lights 5 times less important than those in
				if(!light.parent) {
					inFrustum = camera.sphereInFov(light.position.x, light.position.z, 5) ? 1 : 3;
				}

				light.priority = light.priority || 1;
				light.priorityDistanceFromCamera = distnace * light.priority * inFrustum;
				if(distnace > 40 && inFrustum > 1) {
					// if not in frustum and far completelty kill
					light.priorityDistanceFromCamera *= 100000;
				}
				// light turned off? bottom of priority
				if(light.intensity === 0) {
					light.priorityDistanceFromCamera *= 100000000;
				}
			}
		}

		// sort by importance
		spotLightsPool.sort(function (a, b) {
			return a.priorityDistanceFromCamera - b.priorityDistanceFromCamera;
		});
		for ( l = 0, ll = Math.min(spotLightsPool.length, maxSpotLights); l < ll; l++ ) {
			var light = spotLightsPool[l];
			var uniforms = cache.get( light );

			uniforms.position.setFromMatrixPosition( light.matrixWorld );
			uniforms.position.applyMatrix4( viewMatrix );

			uniforms.color.copy( light.color ).multiplyScalar( light.intensity );
			uniforms.distance = light.distance;

			uniforms.direction.setFromMatrixPosition( light.matrixWorld );
			vector3.setFromMatrixPosition( light.target.matrixWorld );
			uniforms.direction.sub( vector3 );
			uniforms.direction.transformDirection( viewMatrix );

			uniforms.coneCos = Math.cos( light.angle );
			uniforms.penumbraCos = Math.cos( light.angle * ( 1 - light.penumbra ) );
			uniforms.decay = ( light.distance === 0 ) ? 0.0 : light.decay;

			uniforms.shadow = light.castShadow;
			if ( light.castShadow ) {

				var shadow = light.shadow;

				uniforms.shadowBias = shadow.bias;
				uniforms.shadowRadius = shadow.radius;
				uniforms.shadowMapSize = shadow.mapSize;

			}

			var shadowMap = ( light.shadow && light.shadow.map ) ? light.shadow.map.texture : null;

			state.spotShadowMap[ spotLength ] = shadowMap;
			state.spotShadowMatrix[ spotLength ] = light.shadow.matrix;
			state.spot[ spotLength++ ] = uniforms;

		}
		return spotLength;

	}

	function setup( lights, shadows, camera ) {

		var r = 0, g = 0, b = 0;

		var directionalLength = 0;
		var pointLength = 0;
		var spotLength = setupSpotlightsFromPool(lights, camera);
		var rectAreaLength = 0;
		var hemiLength = 0;

		var viewMatrix = camera.matrixWorldInverse;

		for ( var i = 0, l = lights.length; i < l; i ++ ) {

			var light = lights[ i ];

			var color = light.color;
			var intensity = light.intensity;
			var distance = light.distance;

			var shadowMap = ( light.shadow && light.shadow.map ) ? light.shadow.map.texture : null;

			if ( light.isAmbientLight ) {

				r += color.r * intensity;
				g += color.g * intensity;
				b += color.b * intensity;

			} else if ( light.isDirectionalLight ) {

				var uniforms = cache.get( light );

				uniforms.color.copy( light.color ).multiplyScalar( light.intensity );
				uniforms.direction.setFromMatrixPosition( light.matrixWorld );
				vector3.setFromMatrixPosition( light.target.matrixWorld );
				uniforms.direction.sub( vector3 );
				uniforms.direction.transformDirection( viewMatrix );

				uniforms.shadow = light.castShadow;

				if ( light.castShadow ) {

					var shadow = light.shadow;

					uniforms.shadowBias = shadow.bias;
					uniforms.shadowRadius = shadow.radius;
					uniforms.shadowMapSize = shadow.mapSize;

				}

				state.directionalShadowMap[ directionalLength ] = shadowMap;
				state.directionalShadowMatrix[ directionalLength ] = light.shadow.matrix;
				state.directional[ directionalLength ] = uniforms;

				directionalLength ++;

			} else if ( light.isSpotLight ) {

				// var uniforms = cache.get( light );

				// uniforms.position.setFromMatrixPosition( light.matrixWorld );
				// uniforms.position.applyMatrix4( viewMatrix );

				// uniforms.color.copy( color ).multiplyScalar( intensity );
				// uniforms.distance = distance;

				// uniforms.direction.setFromMatrixPosition( light.matrixWorld );
				// vector3.setFromMatrixPosition( light.target.matrixWorld );
				// uniforms.direction.sub( vector3 );
				// uniforms.direction.transformDirection( viewMatrix );

				// uniforms.coneCos = Math.cos( light.angle );
				// uniforms.penumbraCos = Math.cos( light.angle * ( 1 - light.penumbra ) );
				// uniforms.decay = ( light.distance === 0 ) ? 0.0 : light.decay;

				// uniforms.shadow = light.castShadow;

				// if ( light.castShadow ) {

				// 	var shadow = light.shadow;

				// 	uniforms.shadowBias = shadow.bias;
				// 	uniforms.shadowRadius = shadow.radius;
				// 	uniforms.shadowMapSize = shadow.mapSize;

				// }

				// state.spotShadowMap[ spotLength ] = shadowMap;
				// state.spotShadowMatrix[ spotLength ] = light.shadow.matrix;
				// state.spot[ spotLength ] = uniforms;

				// spotLength ++;

			} else if ( light.isRectAreaLight ) {

				var uniforms = cache.get( light );

				// (a) intensity is the total visible light emitted
				//uniforms.color.copy( color ).multiplyScalar( intensity / ( light.width * light.height * Math.PI ) );

				// (b) intensity is the brightness of the light
				uniforms.color.copy( color ).multiplyScalar( intensity );

				uniforms.position.setFromMatrixPosition( light.matrixWorld );
				uniforms.position.applyMatrix4( viewMatrix );

				// extract local rotation of light to derive width/height half vectors
				matrix42.identity();
				matrix4.copy( light.matrixWorld );
				matrix4.premultiply( viewMatrix );
				matrix42.extractRotation( matrix4 );

				uniforms.halfWidth.set( light.width * 0.5, 0.0, 0.0 );
				uniforms.halfHeight.set( 0.0, light.height * 0.5, 0.0 );

				uniforms.halfWidth.applyMatrix4( matrix42 );
				uniforms.halfHeight.applyMatrix4( matrix42 );

				// TODO (abelnation): RectAreaLight distance?
				// uniforms.distance = distance;

				state.rectArea[ rectAreaLength ] = uniforms;

				rectAreaLength ++;

			} else if ( light.isPointLight ) {

				var uniforms = cache.get( light );

				uniforms.position.setFromMatrixPosition( light.matrixWorld );
				uniforms.position.applyMatrix4( viewMatrix );

				uniforms.color.copy( light.color ).multiplyScalar( light.intensity );
				uniforms.distance = light.distance;
				uniforms.decay = ( light.distance === 0 ) ? 0.0 : light.decay;

				uniforms.shadow = light.castShadow;

				if ( light.castShadow ) {

					var shadow = light.shadow;

					uniforms.shadowBias = shadow.bias;
					uniforms.shadowRadius = shadow.radius;
					uniforms.shadowMapSize = shadow.mapSize;
					uniforms.shadowCameraNear = shadow.camera.near;
					uniforms.shadowCameraFar = shadow.camera.far;

				}

				state.pointShadowMap[ pointLength ] = shadowMap;
				state.pointShadowMatrix[ pointLength ] = light.shadow.matrix;
				state.point[ pointLength ] = uniforms;

				pointLength ++;

			} else if ( light.isHemisphereLight ) {

				var uniforms = cache.get( light );

				uniforms.direction.setFromMatrixPosition( light.matrixWorld );
				uniforms.direction.transformDirection( viewMatrix );
				uniforms.direction.normalize();

				uniforms.skyColor.copy( light.color ).multiplyScalar( intensity );
				uniforms.groundColor.copy( light.groundColor ).multiplyScalar( intensity );

				state.hemi[ hemiLength ] = uniforms;

				hemiLength ++;

			}

		}

		state.ambient[ 0 ] = r;
		state.ambient[ 1 ] = g;
		state.ambient[ 2 ] = b;

		state.directional.length = directionalLength;
		state.spot.length = spotLength;
		state.rectArea.length = rectAreaLength;
		state.point.length = pointLength;
		state.hemi.length = hemiLength;

		// TODO (sam-g-steel) why aren't we using join
		state.hash = directionalLength + ',' + pointLength + ',' + spotLength + ',' + rectAreaLength + ',' + hemiLength + ',' + shadows.length;

	}

	return {
		setup: setup,
		state: state
	};

}


export { WebGLLights };
