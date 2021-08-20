'use strict';

import ShaderProgram from './ShaderProgram.js';

var mainModule = (function () {

  let DBG_INFO = {
    updateTime: 0.,
    frameTime: 0.
  };

  let FOV = 60 * Math.PI / 180;
  let ZNEAR = .1;
  let ZFAR = 10000.;
  const DEFAULT_RES = 256;
  const TRANSLATION_SPEED = .025;
  let translationIncrease = 1.;
  const ROTATION_SPEED = .007;
  const WEATHER_MAP_SIZE = new Float32Array([256, 256]);
  const CLOUD_SHADOW_MAP_SIZE = new Float32Array([512, 512]);
  const CLOUD_SHADOW_MAP_VOLUME_SIZE = new Float32Array([32, 32, 32]);
  const CLOUD_DETAILS_VOLUME_SIZE = new Float32Array([64, 64, 64]);
  const SKY_VOLUME_SIZE = new Float32Array([32, 32, 32]);
  const SKY_OPTICAL_DEPTH_LUT_SIZE = new Float32Array([256, 64]);
  const SKY_VIEW_LUT_SIZE = new Float32Array([256, 144]);
  let PRESSED_KEYS = [];
  let MOUSE_MOVEMENTS = new Float32Array(96);
  let LAST_MOUSE_MOVEMENT_IDX = 0;
  let KEYS = {
    F5: 116,
    F12: 123,
    F11: 122,
    ALT: 18,
    SPACEBAR: 32,
    SHIFT: 16,
    ENTER: 13,
    LEFT: 37,
    RIGHT: 39,
    UP: 38,
    DOWN: 40,
    Q: 81,
    E: 69,
    W: 87,
    S: 83,
    A: 65,
    D: 68,
    R: 82,
    F: 70,
    EQUALS: 187,
    MINUS: 189,
    NINE: 57,
    ZERO: 48
  };
  let NO_PREVENT_DEFAULT_KEYS = new Uint8Array([KEYS.F5, KEYS.F12, KEYS.F11]);

  // for reference and ratios
  const REarth = 6371;
  const REarthAtmosphere = 6400;
  const RCloud0Earth = 6372.;
  const RCloud1Earth = 6374.;

  let DEFAULT_CFG = {
    _RPlanet: 123.,
    _R1: 223,
    _RCloud0: 126.89,
    _RCloud1: 129.9,
    _cloudBaseDensityStart: .08,
    _cloudTopDensityStart: .25,
    _cloudTopDensityEnd: 1.,
    _RSun: 123 * 1.,
    _cloudDensityMul: 14.,
    _skyScatteringMul: 1.6,
    _skyAbsorptionMul: 1.6,
    _mieScattering: new Float32Array([.003996, .003996, .003996]),
    _mieAbsorbtion: new Float32Array([.000444, .000444, .000444]),
    _rayleighScattering: new Float32Array([.005802, .013558, .033100]),
    _rayleighScatteringScale: 8.,
    _mieScatteringScale: 1.2,
    _cloudScattering: new Float32Array([1., 1., 1.]),
    _lightPos: new Float32Array([0., 123 * 100., 123 * 100.]),
    _lightMagnitude: 10,
    _lightColor: new Float32Array([1., 1., 1.]),
    _cloudPhaseG0: -.2,
    _cloudPhaseG1: .9,
    _skyMarchSamples: 50.,
    _crepuscularRaysMarchSamples: 22.,
    _cloudScattOctaves: 7,
    _skyScattOctaves: 7,
    _cloudMarchSamples: 18.,
    _cloudMarchMaxStepSize: .3399,
    _cloudShadowSamples: 10.,
    _weatherTexScale: .01,
    _windMagnitude: 0.,
    _cloudTexScale: .38,
    _erosionTexScale: 1.,
    _erosionThreshold: .31,
    _temporalAlpha: .1,
    _mouseSensivity: .002
  };

  let DEFAULT_CFG2 = {
    _RPlanet: 123.,
    _R1: 128.5,
    _RCloud0: 125.5,
    _RCloud1: 127.5,
    _cloudBaseDensityStart: .08,
    _cloudTopDensityStart: 0.25,
    _cloudTopDensityEnd: 1.,
    _RSun: 123. * 1.,
    _cloudDensityMul: 100.,
    _skyScatteringMul: 1.6,
    _skyAbsorptionMul: 1.6,
    _rayleighScattering: new Float32Array([.005802, .013558, .033100]),
    _cloudScattering: new Float32Array([1., 1., 1.]),
    _lightPos: new Float32Array([0., 123. * 100., 123 * 100.]),
    _lightMagnitude: 10,
    _lightColor: new Float32Array([1., 1., 1.]),
    _cloudPhaseG0: -.2,
    _cloudPhaseG1: .9,
    _skyMarchSamples: 30.,
    _cloudScattOctaves: 7,
    _skyScattOctaves: 7,
    _cloudMarchSamples: 27.,
    _weatherTexScale: .02,
    _cloudTexScale: 1.,
    _erosionTexScale: 1.,
    _erosionThreshold: .19,
    _temporalAlpha: .1,
    _mouseSensivity: .002
  };

  class MainModule {
    constructor () {
      this._cnv = undefined;
      this._gl = undefined;
      this._dt = 0;

      this._showDbgInfo = false;
      this._hideUIOnBlur = false;
      this._bilateralBlurSigma = 3.5;
      this._bilateralBlurBSigma = 2.0;
      this._marchCrepuscularRays = true;
      this._localShadowsVisibleDistScale = .25;
      this._globalShadowsVisibleDistScale = 1.;

      this._miePhaseG = .8;
      this._resolutionScale = 1.;
      this._cloudShadowMapSamples = 30.;
      this._skyShadowMapSamples = 50;
      this._shouldRecalcCloudShadowMap = true;
      this._shouldRecalcSkyShadowMap = true;
      this._animateSun = false;
      this._sampleCloudNoise = true;
      this._checkCollisionWithPlanet = true;
      this._timeModded = 0.;
      this._prevTime = 0;
      this._RPlanet = 123.;
      this._R1 = 223;//128.5;
      this._RCloud0 = 126.89;//125.2;
      this._RCloud1 = 129.9;//126.6;
      this._cloudBaseDensityStart = .08;
      this._cloudTopDensityStart = .25;
      this._cloudTopDensityEnd = 1.;
      this._RSun = this._RPlanet * 1.;
      this._cloudDensityMul = 14.;
      this._skyScatteringMul = 1.6;
      this._skyAbsorptionMul = 1.6;
      this._mieScattering = new Float32Array([.003996, .003996, .003996]);
      this._mieAbsorbtion = new Float32Array([.000444, .000444, .000444]);
      this._rayleighScattering = new Float32Array([.005802, .013558, .033100]);
      this._rayleighScatteringScale = 8.;
      this._mieScatteringScale = 1.2;
      this._rayleighScatteringMagnitude = vec3.len(this._rayleighScattering);
      this._mieScatteringMagnitude = vec3.len(this._mieScattering);
      this._mieAbsorbtionMagnitude = vec3.len(this._mieAbsorbtion);
      this._cloudScattering = new Float32Array([1., 1., 1.]);
      this._lightPos = new Float32Array([0., this._RPlanet * 100., this._RPlanet * 100.]);
      this._lightMagnitude = 10;
      this._lightColor = new Float32Array([1., 1., 1.]);
      this._cloudPhaseG0 = -.2;
      this._cloudPhaseG1 = .9;
      this._skyMarchSamples = 50.;
      this._crepuscularRaysMarchSamples = 22.;
      this._cloudScattOctaves = 7;
      this._skyScattOctaves = 7;
      this._cloudMarchSamples = 18.;
      this._cloudMarchMaxStepSize = .3399;
      this._cloudShadowSamples = 10.;
      this._weatherTexScale = .01;
      this._windMagnitude = 0.;
      this._cloudTexScale = .38;//1.;
      this._erosionTexScale = 1.;
      this._erosionThreshold = .31;//.38;
      this._temporalAlpha = .1;
      this._mouseSensivity = .002;
      this._viewMat = undefined;
      this._prevViewMat = undefined;
      this._prevViewMatInv = undefined;
      this._projMat = undefined;
      this._drawMode = undefined;
      this._windowSize = new Float32Array([0, 0]);
      this._mouse = new Float32Array([0, 0]);

      this._bufferVertices = undefined;
      this._bufferIndices = undefined;
      this._bufferTextureCoords = undefined;

      this._currentProgram = undefined;
      this._programs = {};
      this._binded = {};
      this._bindMethods([
        this.mainLoop,
        this._handleResize,
        this._handleMouse,
        this._handleMouseWheel,
        this._handleKeydown,
        this._handleKeyup,
        this._handleMousedown,
        this._handleMouseup,
        this._setupFinalRenderProgram,
        this._setupRender2DTexProgram,
        this._setupBlurProgram,
        this._setupDenoiseProgram,
        this._setupRenderAtmosphereProgram,
        this._setupRenderSkyVolumeProgram,
        this._setupRenderSkyShadowMapProgram,
        this._setupRenderCloudShadowMapsProgram,
        this._setupRenderCloudShadowMapVolumeProgram,
        this._setupRenderSkyViewLUTProgram,
        this._setupRenderWeatherMapProgram
      ]);
    }

    init () {
      this._cnv = document.querySelector('canvas');
      this._gl = this._cnv.getContext('webgl2');
      this._cnv.width = document.documentElement.clientWidth;
      this._cnv.height = document.documentElement.clientHeight;
      this._windowSize[0] = this._cnv.width;
      this._windowSize[1] = this._cnv.height;
      window.addEventListener('resize', this._binded._handleResize);
      window.addEventListener('mousemove', this._binded._handleMouse);
      window.addEventListener('wheel', this._binded._handleMouseWheel);
      window.addEventListener('keydown', this._binded._handleKeydown);
      window.addEventListener('keyup', this._binded._handleKeyup);
      window.addEventListener('mousedown', this._binded._handleMousedown);
      window.addEventListener('mouseup', this._binded._handleMouseup);
      document.addEventListener('pointerlockchange', (e) => {
      });
      document.addEventListener('pointerlockerror', (e) => {
      });
      this._cnv.addEventListener('click', () => {
        this._cnv.requestPointerLock();
      });
      this._setupGL();
      this._addUI();
      // this._readMieScatteringData('./miescatt_cloud.txt').then(scattData => {
      //   this._mieScatteringCloudTexture = this._createMieScatteringTexture(scattData);
      // });

      // this._readMieScatteringData('./miescatt_air.txt').then(scattData => {
      //   this._mieScatteringAirTexture = this._createMieScatteringTexture(scattData);
      // });

      this._programs.finalRender = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fs.frag',
        gl: this._gl,
        setup: this._binded._setupFinalRenderProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uTex',
          'uT',
          'uTModded',
          'uDT',
          'uWindowSize',
          'uMouse',
          'uDoRenderUVs',
          // 'uCustomUV',
          'uDoCustomUVRender',
          'uTex3D',
          'uRender3DTex'
        ]
      });

      this._programs.render2DTex = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './render2DTex.frag',
        gl: this._gl,
        setup: this._binded._setupRender2DTexProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uTex',
          'uT',
          'uTModded',
          'uDT',
          'uWindowSize',
          'uMouse'
        ]
      });

      this._programs.blurTex = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './blurTex.frag',
        gl: this._gl,
        setup: this._binded._setupBlurProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uTex',
          'uWindowSize',
          'uTexSize',
          'uSigma',
          'uBSigma'
        ]
      });

      this._programs.denoise = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './denoise.frag',
        gl: this._gl,
        setup: this._binded._setupDenoiseProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uTex',
          'uWindowSize',
          'uTexSize'
        ]
      });

      this._programs.renderSkyVolume = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './renderSkyVolume.frag',
        gl: this._gl,
        setup: this._binded._setupRenderSkyVolumeProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uT',
          'uTModded',
          'uDT',
          'uLightPos',
          'uLightColor',
          'uLightMagnitude',
          'uR1',
          'uRSun',
          'uRPlanet',
          'uRCloud0',
          'uRCloud1',
          'uSkyRayleighScatteringMul',
          'uSkyAbsorptionMul',
          'uSkyRayleighScattering',
          'uRayleighScaleDiv',
          'uMieScaleDiv',
          'uMieScattering',
          'uMieAbsorbtion',
          'uMiePhaseG',
          'uSkyMarchSamples',
          'uWindowSize',
          'uViewMat',
          'uMouse',
          'uRenderLayer',
          'uLastLayer',
          'uSkyOpticalDepthToSun',
          'uSkyScattOctaves'
        ]
      });

      this._programs.renderSkyViewLUT = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './renderSkyViewLUT.frag',
        gl: this._gl,
        setup: this._binded._setupRenderSkyViewLUTProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uT',
          'uTModded',
          'uDT',
          'uLightPos',
          'uLightColor',
          'uLightMagnitude',
          'uR1',
          'uRPlanet',
          'uSkyRayleighScatteringMul',
          'uSkyAbsorptionMul',
          'uSkyRayleighScattering',
          'uRayleighScaleDiv',
          'uMieScaleDiv',
          'uMieScattering',
          'uMieAbsorbtion',
          'uMiePhaseG',
          'uSkyMarchSamples',
          'uWindowSize',
          'uSkyViewLUTSize',
          'uViewMat',
          'uMouse',
          'uSkyOpticalDepthToSun',
          'uSkyScattOctaves'
        ]
      });

      this._programs.renderSkyShadowMap = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './renderSkyShadowMap.frag',
        gl: this._gl,
        setup: this._binded._setupRenderSkyShadowMapProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uWindowSize',
          'uSampleCloudNoise',
          'uT',
          'uTModded',
          'uRCloud0',
          'uRCloud1',
          'uR1',
          'uRSun',
          'uRPlanet',
          'uLightPos',
          'uMarchSamples',
          'uSkyRayleighScatteringMul',
          'uSkyAbsorptionMul',
          'uSkyRayleighScattering',
          'uRayleighScaleDiv',
          'uMieScaleDiv',
          'uMieScattering',
          'uMieAbsorbtion',
          'uCloudScattering',
          'uCloudTexScale',
          'uErosionTexScale',
          'uErosionThreshold',
          'uCloudDensityMul',
          'uCloudTex',
          'uErosionTex',
          'uRenderLayer'
        ]
      });

      this._programs.renderCloudShadowMaps = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './renderCloudShadowMaps.frag',
        gl: this._gl,
        setup: this._binded._setupRenderCloudShadowMapsProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uWindowSize',
          'uSampleCloudNoise',
          'uT',
          'uTModded',
          'uRCloud0',
          'uRCloud1',
          'uCloudBaseDensityStart',
          'uCloudTopDensityStart',
          'uCloudTopDensityEnd',
          'uR1',
          'uRSun',
          'uRPlanet',
          'uLightPos',
          'uMarchSamples',
          'uCloudScattering',
          'uWeatherTexScale',
          'uWindMagnitude',
          'uCloudTexScale',
          'uErosionTexScale',
          'uErosionThreshold',
          'uCloudDensityMul',
          'uVisibleDist',
          'uLocalShadowMapVisDistScale',
          'uGlobalShadowMapVisDistScale',
          'uObserverViewMat',
          'uLocalShadowMapViewMat',
          'uGlobalShadowMapViewMat',
          'uCloudTex',
          'uErosionTex',
          'uWeatherTex'
        ]
      });

      // this._programs.renderCloudShadowMapVolume = new ShaderProgram({
      //   vertPath: './renderToTexture.vert',
      //   fragPath: './renderCloudShadowMapVolume.frag',
      //   gl: this._gl,
      //   setup: this._binded._setupRenderCloudShadowMapVolumeProgram,
      //   attrs: [
      //     'aPos',
      //     'aTexCoord'
      //   ],
      //   unifs: [
      //     'uWindowSize',
      //     'uSampleCloudNoise',
      //     'uT',
      //     'uTModded',
      //     'uRCloud0',
      //     'uRCloud1',
      //     'uCloudBaseDensityStart',
      //     'uCloudTopDensityStart',
      //     'uCloudTopDensityEnd',
      //     'uR1',
      //     'uRSun',
      //     'uRPlanet',
      //     'uLightPos',
      //     'uMarchSamples',
      //     'uCloudScattering',
      //     'uWeatherTexScale',
      //     'uWindMagnitude',
      //     'uCloudTexScale',
      //     'uErosionTexScale',
      //     'uErosionThreshold',
      //     'uCloudDensityMul',
      //     'uVisibleDist',
      //     'uLocalShadowMapVisDistScale',
      //     'uGlobalShadowMapVisDistScale',
      //     'uObserverViewMat',
      //     'uLocalShadowMapViewMat',
      //     'uGlobalShadowMapViewMat',
      //     'uCloudTex',
      //     'uErosionTex',
      //     'uWeatherTex',
      //     'uRenderLayer',
      //     'uLastLayer'
      //   ]
      // });

      this._programs.renderWeatherMap = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './renderWeatherMap.frag',
        gl: this._gl,
        setup: this._binded._setupRenderWeatherMapProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uWindowSize',
          'uSampleCloudNoise',
          'uT',
          'uTModded'
        ]
      });

      this._programs.renderAtmosphere = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './renderClouds.frag',
        gl: this._gl,
        setup: this._binded._setupRenderAtmosphereProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uT',
          'uSampleCloudNoise',
          'uCloudMarchMaxStepSize',
          'uTModded',
          'uDT',
          'uRCloud0',
          'uRCloud1',
          'uCloudBaseDensityStart',
          'uCloudTopDensityStart',
          'uCloudTopDensityEnd',
          'uR1',
          'uRPlanet',
          'uRSun',
          'uLightPos',
          'uLightMagnitude',
          'uLightColor',
          'uCloudSamples',
          'uCloudShadowSamples',
          'uSkyMarchSamples',
          'uCrepuscularRaysSamples',
          'uMieScattering',
          'uMieAbsorbtion',
          'uSkyRayleighScattering',
          'uSkyScattOctaves',
          'uCloudScattering',
          'uCloudScattOctaves',
          'uWindowSize',
          'uWeatherTexScale',
          'uWindMagnitude',
          'uCloudTexScale',
          'uErosionTexScale',
          'uErosionThreshold',
          'uTemporalAlpha',
          'uCloudPhaseG0',
          'uCloudPhaseG1',
          'uCloudDensityMul',
          'uSkyRayleighScatteringMul',
          'uSkyAbsorptionMul',
          'uVisibleDist',
          'uIsMoving',
          'uViewMat',
          'uPrevViewMat',
          'uProjPrevViewMatInv',
          'uLocalShadowMapProjViewMatInv',
          'uGlobalShadowMapProjViewMatInv',
          'uCloudTex',
          'uErosionTex',
          'uWeatherTex',
          'uSkyShadowMapTex',
          'uCloudShadowMapTex',
          'uLocalCloudShadowMapTex',
          'uCloudShadowMapVol',
          'uCrepuscularRaysBuffer',
          'uMieScattCloudTex',
          'uMieScattAirTex',
          'uPrevDepthBuffer',
          'uPrimaryCloudLayerBuffer',
          'uMilkyWay',
          'uMouse',
          'uSkyScatteringVol',
          'uSkyTransmittanceVol',
          'uSkyViewLUT',
          'uSkyViewLUTSize',
          'uMarchCrepuscularRays',
          'uPrimaryCloudLayerTransmittanceBuffer'
        ]
      });

      Promise.all([
        ...Object.values(this._programs).map(program => program.creationPromise)
      ]).then(programs => {
        this._doAssetsWork(() => {
          document.querySelector('.loading').style.display = 'none';
          this.mainLoop();
        });
      });
    }

    _bindMethods (methods = []) {
      let i;
      for (i = 0; i < methods.length; i++) {
        if (methods[i] === undefined) {
          console.error('ERR: undefined method at i, methods.length::', i, methods.length);
          continue;
        }
        this._binded[methods[i].name] = methods[i].bind(this);
      }
    }

    _handleResize () {
      this._cnv.width = document.documentElement.clientWidth;
      this._cnv.height = document.documentElement.clientHeight;
      this._windowSize[0] = this._cnv.width;
      this._windowSize[1] = this._cnv.height;
      if (this._gl && this._currentProgram) {
        this._gl.uniform2fv(this._currentProgram.unifs.uWindowSize, this._windowSize);
      }
      if (this._gl) {
        this._gl.viewport(0, 0, this._windowSize[0], this._windowSize[1]);
        this._updateProjectionMatrix();
        this._createResolutionDependentAssets();
      }
    }

    _handleMouse (e) {
      this._mouse[0] = e.clientX;
      this._mouse[1] = this._windowSize[1] - e.clientY;
      if (document.pointerLockElement === this._cnv) {
        if (LAST_MOUSE_MOVEMENT_IDX >= MOUSE_MOVEMENTS.length - 2) {
          return;
        }
        MOUSE_MOVEMENTS[LAST_MOUSE_MOVEMENT_IDX] = -e.movementX;
        MOUSE_MOVEMENTS[LAST_MOUSE_MOVEMENT_IDX + 1] = -e.movementY;
        LAST_MOUSE_MOVEMENT_IDX += 2;
      }
    }

    _handleMousedown (e) {
    }

    _handleMouseup (e) {
    }

    _handleMouseWheel (e) {
      if (e.wheelDelta > 0) {
        translationIncrease *= 1.1;
      } else {
        translationIncrease /= 1.1;
      }
    }

    _updateProjectionMatrix () {
      mat4.perspective(
        this._projMat,
        FOV,
        this._windowSize[0] / this._windowSize[1],
        ZNEAR,
        ZFAR
      );
    }

    _getLookAtMat (outMat, from, to) {
      let forward = new Float32Array([
        from[0] - to[0],
        from[1] - to[1],
        from[2] - to[2],
      ]);
      vec3.normalize(forward, forward);
      let helperVec = new Float32Array([0, 1, 0]);
      let right = new Float32Array([0, 0, 0]);
      let up = new Float32Array([0, 0, 0]);

      // helper is arbitrary, so if forward is collinear with it choose another one
      if (forward[1] === 1 || forward[1] === -1) {
        helperVec[1] = 0;
        helperVec[2] = -forward[1];
      }

      vec3.cross(right, helperVec, forward);
      vec3.normalize(right, right);
      vec3.cross(up, forward, right);
      vec3.normalize(up, up);
      outMat[0] = right[0];
      outMat[1] = right[1];
      outMat[2] = right[2];

      outMat[4] = up[0];
      outMat[5] = up[1];
      outMat[6] = up[2];

      outMat[8] = forward[0];
      outMat[9] = forward[1];
      outMat[10] = forward[2];

      outMat[12] = from[0];
      outMat[13] = from[1];
      outMat[14] = from[2];
      return outMat;
    }

    // - r0: ray origin
    // - rd: normalized ray direction
    // - s0: sphere center
    // - sR: sphere radius
    // - Returns distance from r0 to first intersecion with sphere,
    //   or -1.0 if no intersection.
    _raySphereIntersect (r0, rd, s0, sR, farthest) {
      let a = vec3.dot(rd, rd);
      let s0_r0 = vec3.create();
      vec3.sub(s0_r0, r0, s0);
      let b = 2.0 * vec3.dot(rd, s0_r0);
      let c = vec3.dot(s0_r0, s0_r0) - (sR * sR);
      let delta = b * b - 4.0*a*c;
      if (delta < 0.0 || a == 0.0) {
        return -1.0;
      }
      let sol0 = (-b - Math.sqrt(delta)) / (2.0*a);
      let sol1 = (-b + Math.sqrt(delta)) / (2.0*a);
      if (sol0 < 0.0 && sol1 < 0.0) {
        return -1.0;
      }
      if (sol0 < 0.0) {
        return Math.max(0.0, sol1);
      } else if (sol1 < 0.0) {
        return Math.max(0.0, sol0);
      }

      if (farthest) {
        return Math.max(0.0, Math.max(sol0, sol1));
      } else {
        return Math.max(0.0, Math.min(sol0, sol1));
      }
    }

    _handleKeydown (e) {
      // console.log(e.which);
      PRESSED_KEYS[e.which] = 1;
      if (NO_PREVENT_DEFAULT_KEYS.indexOf(e.which) === -1) {
        e.preventDefault();
      }
    }

    _handleKeyup (e) {
      PRESSED_KEYS[e.which] = 0;
    }

    _processMouse () {
      let i;
      let rotAxis = new Float32Array(3);
      let rotationMagnitude;
      let prevRotationMagnitude = .2;
      for (i = 0; i < LAST_MOUSE_MOVEMENT_IDX; i += 2) {
        rotAxis[0] = MOUSE_MOVEMENTS[i + 1];
        rotAxis[1] = MOUSE_MOVEMENTS[i];
        rotationMagnitude = this._mouseSensivity * Math.sqrt(Math.pow(MOUSE_MOVEMENTS[i], 2) + Math.pow(MOUSE_MOVEMENTS[i + 1], 2));
        if (rotationMagnitude/prevRotationMagnitude > 2.5) {
          rotationMagnitude = prevRotationMagnitude;
        }
        prevRotationMagnitude = rotationMagnitude;
        mat4.rotate(this._viewMat, this._viewMat, rotationMagnitude, rotAxis);
        MOUSE_MOVEMENTS[i] = 0.;
        MOUSE_MOVEMENTS[i + 1] = 0.;
      }
      LAST_MOUSE_MOVEMENT_IDX = 0;
    }

    _processKeys () {
      let rotAxis = new Uint8Array([0, 0, 0]);
      let rotSign = 1;
      let translationAxis = new Float32Array([0, 0, 0]);

      if (PRESSED_KEYS[KEYS.UP]) {
        rotAxis[0] = 1;
        rotSign = -1;
      } else if (PRESSED_KEYS[KEYS.DOWN]) {
        rotAxis[0] = 1;
      }

      if (PRESSED_KEYS[KEYS.LEFT]) {
        if (PRESSED_KEYS[KEYS.SHIFT]) {
          rotAxis[2] = 1;
        } else {
          rotAxis[1] = 1;
        }
      } else if (PRESSED_KEYS[KEYS.RIGHT]) {
        if (PRESSED_KEYS[KEYS.SHIFT]) {
          rotAxis[2] = 1;
        } else {
          rotAxis[1] = 1;
        }
        rotSign = -1;
      }

      if (PRESSED_KEYS[KEYS.W]) {
        translationAxis[2] = -TRANSLATION_SPEED;
      } else if (PRESSED_KEYS[KEYS.S]) {
        translationAxis[2] = TRANSLATION_SPEED;
      }

      if (PRESSED_KEYS[KEYS.A]) {
        translationAxis[0] = -TRANSLATION_SPEED;
      } else if (PRESSED_KEYS[KEYS.D]) {
        translationAxis[0] = TRANSLATION_SPEED;
      }

      if (PRESSED_KEYS[KEYS.Q]) {
        rotAxis[2] = 1;
      } else if (PRESSED_KEYS[KEYS.E]) {
        rotAxis[2] = 1;
        rotSign = -1;
      }

      if (PRESSED_KEYS[KEYS.R]) {
        translationAxis[1] = TRANSLATION_SPEED;
      } else if (PRESSED_KEYS[KEYS.F]) {
        translationAxis[1] = -TRANSLATION_SPEED;
      }

      translationAxis[0] *= translationIncrease;
      translationAxis[1] *= translationIncrease;
      translationAxis[2] *= translationIncrease;

      mat4.translate(
        this._viewMat,
        this._viewMat,
        translationAxis
      );

      mat4.rotate(
        this._viewMat,
        this._viewMat,
        Math.PI * ROTATION_SPEED * rotSign,
        rotAxis
      );
    }

    async _doAssetsWork (cb) {
      this._createResolutionDependentAssets();
      this._createResolutionIndependentAssets();
      await this._setupTextureAssets([
        {
          path: './noise_shape_packed64.png',
          target: this._gl.TEXTURE_3D,
          magFilter: this._gl.LINEAR,
          minFilter: this._gl.LINEAR,
          wrapS: this._gl.REPEAT,
          wrapT: this._gl.REPEAT,
          wrapR: this._gl.REPEAT,
          volumeSize: CLOUD_DETAILS_VOLUME_SIZE,
          internalFormat: this._gl.RGBA8,
          texelFormat: this._gl.RGBA,
          type: this._gl.UNSIGNED_BYTE,
          fieldName: '_cloudVolumeTexture'
        },
        {
          path: './noise_erosion_packed.png',
          target: this._gl.TEXTURE_3D,
          magFilter: this._gl.LINEAR,
          minFilter: this._gl.LINEAR,
          wrapS: this._gl.REPEAT,
          wrapT: this._gl.REPEAT,
          wrapR: this._gl.REPEAT,
          volumeSize: new Float32Array([32, 32, 32]),
          internalFormat: this._gl.RGBA8,
          texelFormat: this._gl.RGBA,
          type: this._gl.UNSIGNED_BYTE,
          fieldName: '_erosionVolumeTexture'
        },
        {
          path: './weather_turbulent.png',
          target: this._gl.TEXTURE_2D,
          magFilter: this._gl.LINEAR,
          minFilter: this._gl.LINEAR,
          wrapS: this._gl.REPEAT,
          wrapT: this._gl.REPEAT,
          internalFormat: this._gl.RGBA8,
          texelFormat: this._gl.RGBA,
          type: this._gl.UNSIGNED_BYTE,
          fieldName: '_weatherTexture'
        },
        {
          path: './milkyway.jpg',
          target: this._gl.TEXTURE_2D,
          magFilter: this._gl.LINEAR,
          minFilter: this._gl.LINEAR,
          wrapS: this._gl.REPEAT,
          wrapT: this._gl.REPEAT,
          internalFormat: this._gl.RGBA8,
          texelFormat: this._gl.RGBA,
          type: this._gl.UNSIGNED_BYTE,
          fieldName: '_milkywayTexture'
        }
      ], cb);
    }

    _setCurrentProgram (shaderProgram) {
      // if (this._currentProgram === shaderProgram) {
      //   return;
      // }
      this._currentProgram = shaderProgram;
      this._gl.useProgram(shaderProgram.glProgram);
      shaderProgram.setup(this._gl);
      this._gl.uniform1f(shaderProgram.unifs.uT, performance.now());
      this._gl.uniform1f(shaderProgram.unifs.uTModded, this._timeModded);
      this._gl.uniform1f(shaderProgram.unifs.uDT, this._dt * .001);
      this._gl.uniform2fv(shaderProgram.unifs.uMouse, this._mouse);
      this._gl.uniform2fv(shaderProgram.unifs.uWindowSize, this._windowSize);
    }

    _setupFinalRenderProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uTex, 0);
      gl.uniform1i(shaderProgram.unifs.uTex3D, 1);
    }

    _setupRender2DTexProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uTex, 0);
    }

    _setupBlurProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uTex, 0);
      gl.uniform1f(shaderProgram.unifs.uSigma, this._bilateralBlurSigma);
      gl.uniform1f(shaderProgram.unifs.uBSigma, this._bilateralBlurBSigma);
    }

    _setupDenoiseProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uTex, 0);
    }

    _setupRenderSkyVolumeProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1f(shaderProgram.unifs.uSkyMarchSamples, this._skyMarchSamples);
      gl.uniform3fv(shaderProgram.unifs.uLightPos, this._lightPos);
      gl.uniform3fv(shaderProgram.unifs.uLightColor, this._lightColor);
      gl.uniform1f(shaderProgram.unifs.uLightMagnitude, this._lightMagnitude);
      gl.uniform1f(shaderProgram.unifs.uR1, this._R1);
      gl.uniform1f(shaderProgram.unifs.uRSun, this._RSun);
      gl.uniform1f(shaderProgram.unifs.uRPlanet, this._RPlanet);
      gl.uniform1f(shaderProgram.unifs.uRCloud0, this._RCloud0);
      gl.uniform1f(shaderProgram.unifs.uRCloud1, this._RCloud1);
      gl.uniform1i(shaderProgram.unifs.uSkyScattOctaves, this._skyScattOctaves);
      gl.uniform1f(shaderProgram.unifs.uSkyRayleighScatteringMul, this._skyScatteringMul);
      gl.uniform1f(shaderProgram.unifs.uSkyAbsorptionMul, this._skyAbsorptionMul);
      gl.uniform3fv(shaderProgram.unifs.uSkyRayleighScattering, this._rayleighScattering);
      gl.uniform3fv(shaderProgram.unifs.uMieScattering, this._mieScattering);
      gl.uniform3fv(shaderProgram.unifs.uMieAbsorbtion, this._mieAbsorbtion);
      gl.uniform1f(shaderProgram.unifs.uMiePhaseG, this._miePhaseG);
      gl.uniform1f(shaderProgram.unifs.uRayleighScaleDiv, this._rayleighScatteringScale);
      gl.uniform1f(shaderProgram.unifs.uMieScaleDiv, this._mieScatteringScale);
      gl.uniform1f(shaderProgram.unifs.uLastLayer, SKY_VOLUME_SIZE[2] - 1.);
      gl.uniformMatrix4fv(shaderProgram.unifs.uViewMat, false, this._viewMat);

      gl.uniform1i(shaderProgram.unifs.uSkyOpticalDepthToSun, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._skyOpticalDepthTex);
    }

    _setupRenderSkyViewLUTProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1f(shaderProgram.unifs.uSkyMarchSamples, this._skyMarchSamples);
      gl.uniform3fv(shaderProgram.unifs.uLightPos, this._lightPos);
      gl.uniform3fv(shaderProgram.unifs.uLightColor, this._lightColor);
      gl.uniform1f(shaderProgram.unifs.uLightMagnitude, this._lightMagnitude);
      gl.uniform1f(shaderProgram.unifs.uR1, this._R1);
      gl.uniform1f(shaderProgram.unifs.uRPlanet, this._RPlanet);
      gl.uniform1i(shaderProgram.unifs.uSkyScattOctaves, this._skyScattOctaves);
      gl.uniform1f(shaderProgram.unifs.uSkyRayleighScatteringMul, this._skyScatteringMul);
      gl.uniform1f(shaderProgram.unifs.uSkyAbsorptionMul, this._skyAbsorptionMul);
      gl.uniform3fv(shaderProgram.unifs.uSkyRayleighScattering, this._rayleighScattering);
      gl.uniform3fv(shaderProgram.unifs.uMieScattering, this._mieScattering);
      gl.uniform3fv(shaderProgram.unifs.uMieAbsorbtion, this._mieAbsorbtion);
      gl.uniform1f(shaderProgram.unifs.uMiePhaseG, this._miePhaseG);
      gl.uniform1f(shaderProgram.unifs.uRayleighScaleDiv, this._rayleighScatteringScale);
      gl.uniform1f(shaderProgram.unifs.uMieScaleDiv, this._mieScatteringScale);
      gl.uniform2fv(shaderProgram.unifs.uSkyViewLUTSize, SKY_VIEW_LUT_SIZE);
      gl.uniformMatrix4fv(shaderProgram.unifs.uViewMat, false, this._viewMat);

      gl.uniform1i(shaderProgram.unifs.uSkyOpticalDepthToSun, 0);
      // gl.uniform1i(shaderProgram.unifs.uSkyViewLUTBuffer, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._skyOpticalDepthTex);
      // gl.activeTexture(gl.TEXTURE1);
      // gl.bindTexture(gl.TEXTURE_2D, this._skyViewLUTSwap);
    }

    _setupRenderSkyShadowMapProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);

      gl.uniform1f(shaderProgram.unifs.uCloudTexScale, this._cloudTexScale);
      gl.uniform1f(shaderProgram.unifs.uErosionTexScale, this._erosionTexScale);
      gl.uniform1f(shaderProgram.unifs.uErosionThreshold, this._erosionThreshold);
      gl.uniform1f(shaderProgram.unifs.uMarchSamples, this._skyShadowMapSamples);
      gl.uniform3fv(shaderProgram.unifs.uSkyRayleighScattering, this._rayleighScattering);
      gl.uniform3fv(shaderProgram.unifs.uCloudScattering, this._cloudScattering);
      gl.uniform3fv(shaderProgram.unifs.uLightPos, this._lightPos);
      gl.uniform1f(shaderProgram.unifs.uCloudDensityMul, this._cloudDensityMul);
      gl.uniform1f(shaderProgram.unifs.uSkyRayleighScatteringMul, this._skyScatteringMul);
      gl.uniform1f(shaderProgram.unifs.uSkyAbsorptionMul, this._skyAbsorptionMul);
      gl.uniform3fv(shaderProgram.unifs.uMieScattering, this._mieScattering);
      gl.uniform3fv(shaderProgram.unifs.uMieAbsorbtion, this._mieAbsorbtion);
      gl.uniform1f(shaderProgram.unifs.uRayleighScaleDiv, this._rayleighScatteringScale);
      gl.uniform1f(shaderProgram.unifs.uMieScaleDiv, this._mieScatteringScale);
      gl.uniform1f(shaderProgram.unifs.uRCloud0, this._RCloud0);
      gl.uniform1f(shaderProgram.unifs.uRCloud1, this._RCloud1);
      gl.uniform1f(shaderProgram.unifs.uR1, this._R1);
      gl.uniform1f(shaderProgram.unifs.uRSun, this._RSun);
      gl.uniform1f(shaderProgram.unifs.uRPlanet, this._RPlanet);
      gl.uniform1i(shaderProgram.unifs.uSampleCloudNoise, this._sampleCloudNoise);

      gl.uniform1i(shaderProgram.unifs.uCloudTex, 0);
      gl.uniform1i(shaderProgram.unifs.uErosionTex, 1);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, this._cloudVolumeTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this._erosionVolumeTexture);
    }

    _setupRenderCloudShadowMapsProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);

      gl.uniform1f(shaderProgram.unifs.uWeatherTexScale, this._weatherTexScale);
      gl.uniform1f(shaderProgram.unifs.uWindMagnitude, this._windMagnitude);
      gl.uniform1f(shaderProgram.unifs.uCloudTexScale, this._cloudTexScale);
      gl.uniform1f(shaderProgram.unifs.uErosionTexScale, this._erosionTexScale);
      gl.uniform1f(shaderProgram.unifs.uErosionThreshold, this._erosionThreshold);
      gl.uniform1f(shaderProgram.unifs.uMarchSamples, this._cloudShadowMapSamples);
      gl.uniform3fv(shaderProgram.unifs.uCloudScattering, this._cloudScattering);
      gl.uniform3fv(shaderProgram.unifs.uLightPos, this._lightPos);
      gl.uniform1f(shaderProgram.unifs.uCloudDensityMul, this._cloudDensityMul);
      gl.uniform1f(shaderProgram.unifs.uRCloud0, this._RCloud0);
      gl.uniform1f(shaderProgram.unifs.uRCloud1, this._RCloud1);
      gl.uniform1f(shaderProgram.unifs.uCloudBaseDensityStart, this._cloudBaseDensityStart);
      gl.uniform1f(shaderProgram.unifs.uCloudTopDensityStart, this._cloudTopDensityStart);
      gl.uniform1f(shaderProgram.unifs.uCloudTopDensityEnd, this._cloudTopDensityEnd);
      gl.uniform1f(shaderProgram.unifs.uRSun, this._RSun);
      gl.uniform1f(shaderProgram.unifs.uRPlanet, this._RPlanet);
      gl.uniformMatrix4fv(shaderProgram.unifs.uObserverViewMat, false, this._viewMat);
      gl.uniformMatrix4fv(shaderProgram.unifs.uLocalShadowMapViewMat, false, this._localCloudShadowMapViewMat);
      gl.uniformMatrix4fv(shaderProgram.unifs.uGlobalShadowMapViewMat, false, this._globalCloudShadowMapViewMat);
      gl.uniform1i(shaderProgram.unifs.uSampleCloudNoise, this._sampleCloudNoise);
      gl.uniform1f(shaderProgram.unifs.uVisibleDist, this._visibleDist);
      gl.uniform1f(shaderProgram.unifs.uLocalShadowMapVisDistScale, this._localShadowsVisibleDistScale);
      gl.uniform1f(shaderProgram.unifs.uGlobalShadowMapVisDistScale, this._globalShadowsVisibleDistScale);

      gl.uniform1i(shaderProgram.unifs.uCloudTex, 0);
      gl.uniform1i(shaderProgram.unifs.uErosionTex, 1);
      gl.uniform1i(shaderProgram.unifs.uWeatherTex, 2);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, this._cloudVolumeTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this._erosionVolumeTexture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this._weatherTexture);
    }

    _setupRenderCloudShadowMapVolumeProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);

      gl.uniform1f(shaderProgram.unifs.uWeatherTexScale, this._weatherTexScale);
      gl.uniform1f(shaderProgram.unifs.uWindMagnitude, this._windMagnitude);
      gl.uniform1f(shaderProgram.unifs.uCloudTexScale, this._cloudTexScale);
      gl.uniform1f(shaderProgram.unifs.uErosionTexScale, this._erosionTexScale);
      gl.uniform1f(shaderProgram.unifs.uErosionThreshold, this._erosionThreshold);
      gl.uniform1f(shaderProgram.unifs.uMarchSamples, this._cloudShadowMapSamples);
      gl.uniform3fv(shaderProgram.unifs.uCloudScattering, this._cloudScattering);
      gl.uniform3fv(shaderProgram.unifs.uLightPos, this._lightPos);
      gl.uniform1f(shaderProgram.unifs.uCloudDensityMul, this._cloudDensityMul);
      gl.uniform1f(shaderProgram.unifs.uRCloud0, this._RCloud0);
      gl.uniform1f(shaderProgram.unifs.uRCloud1, this._RCloud1);
      gl.uniform1f(shaderProgram.unifs.uCloudBaseDensityStart, this._cloudBaseDensityStart);
      gl.uniform1f(shaderProgram.unifs.uCloudTopDensityStart, this._cloudTopDensityStart);
      gl.uniform1f(shaderProgram.unifs.uCloudTopDensityEnd, this._cloudTopDensityEnd);
      gl.uniform1f(shaderProgram.unifs.uRSun, this._RSun);
      gl.uniform1f(shaderProgram.unifs.uRPlanet, this._RPlanet);
      gl.uniformMatrix4fv(shaderProgram.unifs.uObserverViewMat, false, this._viewMat);
      gl.uniformMatrix4fv(shaderProgram.unifs.uLocalShadowMapViewMat, false, this._localCloudShadowMapViewMat);
      gl.uniformMatrix4fv(shaderProgram.unifs.uGlobalShadowMapViewMat, false, this._globalCloudShadowMapViewMat);
      gl.uniform1i(shaderProgram.unifs.uSampleCloudNoise, this._sampleCloudNoise);
      gl.uniform1f(shaderProgram.unifs.uVisibleDist, this._visibleDist);
      gl.uniform1f(shaderProgram.unifs.uLocalShadowMapVisDistScale, this._localShadowsVisibleDistScale);
      gl.uniform1f(shaderProgram.unifs.uGlobalShadowMapVisDistScale, this._globalShadowsVisibleDistScale);
      gl.uniform1f(shaderProgram.unifs.uLastLayer, CLOUD_SHADOW_MAP_VOLUME_SIZE[2] - 1.);

      gl.uniform1i(shaderProgram.unifs.uCloudTex, 0);
      gl.uniform1i(shaderProgram.unifs.uErosionTex, 1);
      gl.uniform1i(shaderProgram.unifs.uWeatherTex, 2);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, this._cloudVolumeTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this._erosionVolumeTexture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this._weatherTexture);
    }

    _setupRenderWeatherMapProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
    }

    _setupRenderAtmosphereProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1f(shaderProgram.unifs.uWeatherTexScale, this._weatherTexScale);
      gl.uniform1f(shaderProgram.unifs.uWindMagnitude, this._windMagnitude);
      gl.uniform1f(shaderProgram.unifs.uCloudTexScale, this._cloudTexScale);
      gl.uniform1f(shaderProgram.unifs.uErosionTexScale, this._erosionTexScale);
      gl.uniform1f(shaderProgram.unifs.uErosionThreshold, this._erosionThreshold);
      gl.uniform1f(shaderProgram.unifs.uTemporalAlpha, this._temporalAlpha);
      gl.uniform1f(shaderProgram.unifs.uCloudSamples, this._cloudMarchSamples);
      gl.uniform1f(shaderProgram.unifs.uCloudMarchMaxStepSize, this._cloudMarchMaxStepSize);
      gl.uniform1f(shaderProgram.unifs.uCloudShadowSamples, this._cloudShadowSamples);
      gl.uniform1f(shaderProgram.unifs.uSkyMarchSamples, this._skyMarchSamples);
      gl.uniform1f(shaderProgram.unifs.uCrepuscularRaysSamples, this._crepuscularRaysMarchSamples);
      gl.uniform3fv(shaderProgram.unifs.uMieScattering, this._mieScattering);
      gl.uniform3fv(shaderProgram.unifs.uMieAbsorbtion, this._mieAbsorbtion);
      gl.uniform3fv(shaderProgram.unifs.uSkyRayleighScattering, this._rayleighScattering);
      gl.uniform3fv(shaderProgram.unifs.uCloudScattering, this._cloudScattering);
      gl.uniform1i(shaderProgram.unifs.uCloudScattOctaves, this._cloudScattOctaves);
      gl.uniform1i(shaderProgram.unifs.uSkyScattOctaves, this._skyScattOctaves);
      gl.uniform3fv(shaderProgram.unifs.uLightPos, this._lightPos);
      gl.uniform1f(shaderProgram.unifs.uLightMagnitude, this._lightMagnitude);
      gl.uniform3fv(shaderProgram.unifs.uLightColor, this._lightColor);
      gl.uniform2fv(shaderProgram.unifs.uSkyViewLUTSize, SKY_VIEW_LUT_SIZE);
      gl.uniform1f(shaderProgram.unifs.uVisibleDist, this._visibleDist);
      gl.uniformMatrix4fv(shaderProgram.unifs.uViewMat, false, this._viewMat);
      gl.uniformMatrix4fv(shaderProgram.unifs.uPrevViewMat, false, this._prevViewMat);
      gl.uniformMatrix4fv(shaderProgram.unifs.uProjPrevViewMatInv, false, this._projPrevViewMatInv);
      gl.uniformMatrix4fv(shaderProgram.unifs.uLocalShadowMapProjViewMatInv, false, this._localCloudShadowMapProjViewMatInv);
      gl.uniformMatrix4fv(shaderProgram.unifs.uGlobalShadowMapProjViewMatInv, false, this._globalCloudShadowMapProjViewMatInv);

      gl.uniform1f(shaderProgram.unifs.uCloudPhaseG0, this._cloudPhaseG0);
      gl.uniform1f(shaderProgram.unifs.uCloudPhaseG1, this._cloudPhaseG1);
      gl.uniform1f(shaderProgram.unifs.uCloudDensityMul, this._cloudDensityMul);
      gl.uniform1f(shaderProgram.unifs.uSkyRayleighScatteringMul, this._skyScatteringMul);
      gl.uniform1f(shaderProgram.unifs.uSkyAbsorptionMul, this._skyAbsorptionMul);
      gl.uniform1f(shaderProgram.unifs.uRCloud0, this._RCloud0);
      gl.uniform1f(shaderProgram.unifs.uRCloud1, this._RCloud1);
      gl.uniform1f(shaderProgram.unifs.uCloudBaseDensityStart, this._cloudBaseDensityStart);
      gl.uniform1f(shaderProgram.unifs.uCloudTopDensityStart, this._cloudTopDensityStart);
      gl.uniform1f(shaderProgram.unifs.uCloudTopDensityEnd, this._cloudTopDensityEnd);
      gl.uniform1f(shaderProgram.unifs.uR1, this._R1);
      gl.uniform1f(shaderProgram.unifs.uRSun, this._RSun);
      gl.uniform1f(shaderProgram.unifs.uRPlanet, this._RPlanet);
      gl.uniform1i(shaderProgram.unifs.uIsMoving, this._isMoving);
      gl.uniform1i(shaderProgram.unifs.uSampleCloudNoise, this._sampleCloudNoise);
      gl.uniform1i(shaderProgram.unifs.uMarchCrepuscularRays, this._marchCrepuscularRays);

      gl.uniform1i(shaderProgram.unifs.uCloudTex, 0);
      gl.uniform1i(shaderProgram.unifs.uErosionTex, 1);
      gl.uniform1i(shaderProgram.unifs.uWeatherTex, 2);
      gl.uniform1i(shaderProgram.unifs.uCrepuscularRaysBuffer, 3);
      gl.uniform1i(shaderProgram.unifs.uMilkyWay, 4);
      gl.uniform1i(shaderProgram.unifs.uMieScattCloudTex, 5);
      gl.uniform1i(shaderProgram.unifs.uPrimaryCloudLayerBuffer, 6);
      gl.uniform1i(shaderProgram.unifs.uLocalCloudShadowMapTex, 7);
      gl.uniform1i(shaderProgram.unifs.uCloudShadowMapTex, 8);
      gl.uniform1i(shaderProgram.unifs.uSkyShadowMapTex, 9);
      gl.uniform1i(shaderProgram.unifs.uSkyScatteringVol, 10);
      gl.uniform1i(shaderProgram.unifs.uSkyTransmittanceVol, 11);
      gl.uniform1i(shaderProgram.unifs.uSkyViewLUT, 12);
      gl.uniform1i(shaderProgram.unifs.uPrimaryCloudLayerTransmittanceBuffer, 13);
      // gl.uniform1i(shaderProgram.unifs.uCloudShadowMapVol, 14);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, this._cloudVolumeTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this._erosionVolumeTexture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this._weatherTexture);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this._crepuscularRaysBufferSwap);
      // gl.activeTexture(gl.TEXTURE4);
      // gl.bindTexture(gl.TEXTURE_2D, this._milkywayTexture);
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, this._mieScatteringCloudTexture);
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, this._primaryCloudLayerBufferSwap);
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, this._localCloudShadowMap);
      gl.activeTexture(gl.TEXTURE8);
      gl.bindTexture(gl.TEXTURE_2D, this._globalCloudShadowMap);
      gl.activeTexture(gl.TEXTURE9);
      gl.bindTexture(gl.TEXTURE_2D, this._skyOpticalDepthTex);
      gl.activeTexture(gl.TEXTURE10);
      gl.bindTexture(gl.TEXTURE_3D, this._skyScatteringVolume);
      gl.activeTexture(gl.TEXTURE11);
      gl.bindTexture(gl.TEXTURE_3D, this._skyTransmittanceVolume);
      gl.activeTexture(gl.TEXTURE12);
      gl.bindTexture(gl.TEXTURE_2D, this._skyViewLUTSwap);
      gl.activeTexture(gl.TEXTURE13);
      gl.bindTexture(gl.TEXTURE_2D, this._primaryCloudLayerTransmittanceBufferSwap);
      // gl.activeTexture(gl.TEXTURE14);
      // gl.bindTexture(gl.TEXTURE_3D, this._cloudShadowMapVol);
    }

    _setDefaultBlendState () {
      this._gl.disable(this._gl.BLEND);
      this._gl.blendFuncSeparate(
        this._gl.ONE,
        this._gl.ZERO,
        this._gl.ONE,
        this._gl.ZERO
      );
      this._gl.blendEquationSeparate(
        this._gl.FUNC_ADD,
        this._gl.FUNC_ADD
      );
    }

    _setPreMultBlendState () {
      this._gl.enable(this._gl.BLEND);
      this._gl.blendFuncSeparate(
        this._gl.ONE,
        this._gl.ONE_MINUS_SRC_ALPHA,
        this._gl.ZERO,
        this._gl.ONE_MINUS_SRC_ALPHA
      );
      this._gl.blendEquationSeparate(
        this._gl.FUNC_ADD,
        this._gl.FUNC_ADD
      );
    }

    _setPreMultAlphaBlendState () {
      this._gl.enable(this._gl.BLEND);
      this._gl.blendFuncSeparate(
        this._gl.ONE,
        this._gl.ONE_MINUS_SRC_ALPHA,
        this._gl.ZERO,
        this._gl.ONE
      );
      this._gl.blendEquationSeparate(
        this._gl.FUNC_ADD,
        this._gl.FUNC_ADD
      );
    }

    _setupGL () {
      this._gl.getExtension('EXT_color_buffer_float');
      this._gl.getExtension('EXT_color_buffer_half_float');
      this._gl.getExtension('EXT_float_blend');
      this._gl.getExtension('OES_texture_float_linear');
      this._webglDebugInfo = this._gl.getExtension('WEBGL_debug_renderer_info');
      DBG_INFO.GPU_VENDOR = this._gl.getParameter(this._webglDebugInfo.UNMASKED_VENDOR_WEBGL);
      DBG_INFO.GPU_RENDERER = this._gl.getParameter(this._webglDebugInfo.UNMASKED_RENDERER_WEBGL);
      if (DBG_INFO.GPU_RENDERER.match(/\bgeforce|radeon|arc\b/gi) === null) {
        alert('Make sure your browser is running using high performance GPU, otherwise you might experience low framerate issues or even see nothing but black screen here.');
      }
      // this._anisotropyEXT = this._gl.getExtension('EXT_texture_filter_anisotropic');
      this._gl.clearColor(0, 0, 0, 1);
      this._gl.clearDepth(1.0);
      this._gl.enable(this._gl.DEPTH_TEST);
      // this._gl.disable(this._gl.DEPTH_TEST);
      this._gl.depthFunc(this._gl.LEQUAL);
      this._gl.enable(this._gl.CULL_FACE);
      this._drawMode = this._gl.TRIANGLES;
      this._viewMat = mat4.create();
      this._prevViewMat = mat4.create();
      this._prevViewMatInv = mat4.create();
      this._projPrevViewMatInv = mat4.create();
      this._projMat = mat4.create();
      this._globalCloudShadowMapViewMat = mat4.create();
      this._globalCloudShadowMapViewMatInv = mat4.create();
      this._globalCloudShadowMapProjMat = mat4.create();
      this._globalCloudShadowMapProjViewMatInv = mat4.create();
      this._localCloudShadowMapViewMat = mat4.create();
      this._localCloudShadowMapViewMatInv = mat4.create();
      this._localCloudShadowMapProjMat = mat4.create();
      this._localCloudShadowMapProjViewMatInv = mat4.create();
      this._skyShadowMapProjMat = mat4.create();

      this._skyOpticalDepthFramebuffer = this._gl.createFramebuffer();
      this._skyViewLUTFramebuffer = this._gl.createFramebuffer();
      this._cloudShadowmapFramebuffer = this._gl.createFramebuffer();
      this._cloudShadowMapVolFramebuffer = this._gl.createFramebuffer();
      this._skyVolumeFramebuffer = this._gl.createFramebuffer();
      this._atmosphereFramebuffer = this._gl.createFramebuffer();
      this._weatherMapFramebuffer = this._gl.createFramebuffer();
      this._framebuffer = this._gl.createFramebuffer();

      this._testViewMat = mat4.create();
      mat4.translate(this._testViewMat, this._testViewMat, [0, -this._RCloud0 + .2, 0.]);
      // mat4.rotate(this._testViewMat, this._testViewMat, -Math.PI * .5, [0, 1, 0]);

      mat4.translate(
        this._viewMat,
        this._viewMat,
        [0., this._RCloud0 + .2, 0.]
      );

      this._updateProjectionMatrix();


      mat4.ortho(
        this._skyShadowMapProjMat,
        -this._R1,
        this._R1,
        -this._R1,
        this._R1,
        -this._R1,
        this._R1
      );

      this._setupDataArrays();
      this._updateShadowMapMatrices();
    }

    _setupDataArrays () {
      this._bufferVertices = new Float32Array([
        -1.0, -1.0, 0.,
        1.0, -1.0, 0.,
        1.0, 1.0, 0.,
        -1.0, 1.0, 0.
      ]);
      this._bufferIndices = new Uint32Array([
        0, 1, 2,
        0, 2, 3
      ]);
      this._bufferTextureCoords = new Float32Array([
        0., 0.,
        1.0, 0.,
        1.0, 1.0,
        0., 1.0
      ]);

      this._bufferVerticesBuf = this._gl.createBuffer();
      this._bufferIndicesBuf = this._gl.createBuffer();
      this._bufferTextureCoordBuf = this._gl.createBuffer();

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._bufferVerticesBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._bufferVertices, this._gl.STATIC_DRAW);

      this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._bufferIndicesBuf);
      this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, this._bufferIndices, this._gl.STATIC_DRAW);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._bufferTextureCoordBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._bufferTextureCoords, this._gl.STATIC_DRAW);
    }

    async _setupTextureAssets (texDescriptions = [], cb) {
      if (texDescriptions.length === 0) {
        cb();
        return;
      }
      let a = texDescriptions.length;
      let i;
      for (i = 0; i < texDescriptions.length; i++) {
        let texDescription = texDescriptions[i];
        let img = new Image();
        if (texDescription.target === this._gl.TEXTURE_2D) {
          img.onload = () => {
            let LOD = 0;
            let border = 0;
            let tex = this._gl.createTexture();
            this._gl.bindTexture(this._gl.TEXTURE_2D, tex);
            this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, texDescription.magFilter);
            this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, texDescription.minFilter);
            this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, texDescription.wrapS);
            this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, texDescription.wrapT);
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, true);
            this._gl.texImage2D(
              this._gl.TEXTURE_2D,
              LOD,
              texDescription.internalFormat,
              img.width,
              img.height,
              border,
              texDescription.texelFormat,
              texDescription.type,
              img
            );
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, false);
            this[texDescription.fieldName] = tex;
            a--;
            if (a === 0) {
              cb();
            }
          };
        } else if (texDescription.target === this._gl.TEXTURE_3D) {
          img.onload = () => {
            // webgl currently can't create 3d tex from image directly
            // using trick with drawing to 2d canvas to extract img bytes
            let cnv = document.createElement('canvas');
            cnv.width = img.width;
            cnv.height = img.height;
            let ctx = cnv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            let imgData = ctx.getImageData(0, 0, img.width, img.height);

            let LOD = 0;
            let border = 0;
            let tex = this._gl.createTexture();
            this._gl.bindTexture(this._gl.TEXTURE_3D, tex);
            this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_MAG_FILTER, texDescription.magFilter);
            this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_MIN_FILTER, texDescription.minFilter);
            this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_S, texDescription.wrapS);
            this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_T, texDescription.wrapT);
            this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_R, texDescription.wrapR);
            this._gl.texImage3D(
              this._gl.TEXTURE_3D,
              LOD,
              texDescription.internalFormat,
              texDescription.volumeSize[0],
              texDescription.volumeSize[1],
              texDescription.volumeSize[2],
              border,
              texDescription.texelFormat,
              texDescription.type,
              imgData.data
            );
            this[texDescription.fieldName] = tex;
            a--;
            if (a === 0) {
              cb();
            }
          };
        }
        img.src = texDescription.path;
      }
    }

    _createResolutionDependentAssets () {
      let LOD = 0;
      let internalFormat = this._gl.RGBA16F;
      let border = 0;
      let texelFormat = this._gl.RGBA;

      this._gl.deleteTexture(this._backBuffer);
      this._backBuffer = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._backBuffer);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        this._windowSize[0] * this._resolutionScale,
        this._windowSize[1] * this._resolutionScale,
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._crepuscularRaysBuffer);
      this._crepuscularRaysBuffer = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._crepuscularRaysBuffer);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        this._windowSize[0] * this._resolutionScale,
        this._windowSize[1] * this._resolutionScale,
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._crepuscularRaysBufferSwap);
      this._crepuscularRaysBufferSwap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._crepuscularRaysBufferSwap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        this._windowSize[0] * this._resolutionScale,
        this._windowSize[1] * this._resolutionScale,
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._primaryCloudLayerBuffer);
      this._primaryCloudLayerBuffer = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._primaryCloudLayerBuffer);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        this._windowSize[0] * this._resolutionScale,
        this._windowSize[1] * this._resolutionScale,
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._primaryCloudLayerBufferSwap);
      this._primaryCloudLayerBufferSwap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._primaryCloudLayerBufferSwap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        this._windowSize[0] * this._resolutionScale,
        this._windowSize[1] * this._resolutionScale,
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._primaryCloudLayerTransmittanceBuffer);
      this._primaryCloudLayerTransmittanceBuffer = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._primaryCloudLayerTransmittanceBuffer);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        this._windowSize[0] * this._resolutionScale,
        this._windowSize[1] * this._resolutionScale,
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._primaryCloudLayerTransmittanceBufferSwap);
      this._primaryCloudLayerTransmittanceBufferSwap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._primaryCloudLayerTransmittanceBufferSwap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        this._windowSize[0] * this._resolutionScale,
        this._windowSize[1] * this._resolutionScale,
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );
    }

    _createResolutionIndependentAssets () {
      let LOD = 0;
      let internalFormat = this._gl.RGBA16F;
      let border = 0;
      let texelFormat = this._gl.RGBA;

      this._gl.deleteTexture(this._weatherMap);
      this._weatherMap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._weatherMap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.REPEAT);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.REPEAT);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        this._gl.R16F,
        WEATHER_MAP_SIZE[0],
        WEATHER_MAP_SIZE[1],
        border,
        this._gl.RED,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._globalCloudShadowMap);
      this._globalCloudShadowMap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._globalCloudShadowMap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        CLOUD_SHADOW_MAP_SIZE[0],
        CLOUD_SHADOW_MAP_SIZE[1],
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._globalCloudShadowMapSwap);
      this._globalCloudShadowMapSwap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._globalCloudShadowMapSwap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        CLOUD_SHADOW_MAP_SIZE[0],
        CLOUD_SHADOW_MAP_SIZE[1],
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._localCloudShadowMap);
      this._localCloudShadowMap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._localCloudShadowMap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        CLOUD_SHADOW_MAP_SIZE[0],
        CLOUD_SHADOW_MAP_SIZE[1],
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._localCloudShadowMapSwap);
      this._localCloudShadowMapSwap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._localCloudShadowMapSwap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        CLOUD_SHADOW_MAP_SIZE[0],
        CLOUD_SHADOW_MAP_SIZE[1],
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      // this._gl.deleteTexture(this._cloudShadowMapVol);
      // this._cloudShadowMapVol = this._gl.createTexture();
      // this._gl.bindTexture(this._gl.TEXTURE_3D, this._cloudShadowMapVol);
      // this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      // this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      // this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      // this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      // this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_R, this._gl.CLAMP_TO_EDGE);
      // this._gl.texImage3D(
      //   this._gl.TEXTURE_3D,
      //   0,
      //   internalFormat,
      //   CLOUD_SHADOW_MAP_VOLUME_SIZE[0],
      //   CLOUD_SHADOW_MAP_VOLUME_SIZE[1],
      //   CLOUD_SHADOW_MAP_VOLUME_SIZE[2],
      //   0,
      //   texelFormat,
      //   this._gl.FLOAT,
      //   null
      // );

      this._gl.deleteTexture(this._skyScatteringVolume);
      this._skyScatteringVolume = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_3D, this._skyScatteringVolume);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_R, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage3D(
        this._gl.TEXTURE_3D,
        0,
        internalFormat,
        SKY_VOLUME_SIZE[0],
        SKY_VOLUME_SIZE[1],
        SKY_VOLUME_SIZE[2],
        0,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._skyTransmittanceVolume);
      this._skyTransmittanceVolume = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_3D, this._skyTransmittanceVolume);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_3D, this._gl.TEXTURE_WRAP_R, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage3D(
        this._gl.TEXTURE_3D,
        0,
        internalFormat,
        SKY_VOLUME_SIZE[0],
        SKY_VOLUME_SIZE[1],
        SKY_VOLUME_SIZE[2],
        0,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._skyOpticalDepthTex);
      this._skyOpticalDepthTex = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._skyOpticalDepthTex);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        SKY_OPTICAL_DEPTH_LUT_SIZE[0],
        SKY_OPTICAL_DEPTH_LUT_SIZE[1],
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._skyViewLUT);
      this._skyViewLUT = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._skyViewLUT);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        SKY_VIEW_LUT_SIZE[0],
        SKY_VIEW_LUT_SIZE[1],
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._skyViewLUTSwap);
      this._skyViewLUTSwap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._skyViewLUTSwap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        SKY_VIEW_LUT_SIZE[0],
        SKY_VIEW_LUT_SIZE[1],
        border,
        texelFormat,
        this._gl.FLOAT,
        null
      );
    }

    _createMieScatteringTexture (scattData = []) {
      let LOD = 0;
      let internalFormat = this._gl.RGBA32F;
      let texelFormat = this._gl.RGBA;
      let border = 0;
      let texture;
      texture = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, texture);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.REPEAT);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.REPEAT);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        internalFormat,
        scattData.length / 4,
        1,
        border,
        texelFormat,
        this._gl.FLOAT,
        scattData
      );

      return texture;
    }

    _updateShadowMapMatrices () {
      let lightDir = vec3.normalize(vec3.create(), this._lightPos);
      let projectorOrigin = vec3.create();
      let observerPos = this._viewMat.slice(12, 15);
      projectorOrigin[0] = lightDir[0] * this._RCloud1;
      projectorOrigin[1] = lightDir[1] * this._RCloud1;
      projectorOrigin[2] = lightDir[2] * this._RCloud1;
      let observerRelativeToProjector = vec3.sub(vec3.create(), observerPos, projectorOrigin);
      let _lightDir = vec3.negate(vec3.create(), lightDir);
      let observerDot_LigtDir = vec3.dot(observerRelativeToProjector, _lightDir);
      let projectedObserverPos = vec3.create();
      projectedObserverPos[0] = observerRelativeToProjector[0] + lightDir[0] * observerDot_LigtDir;
      projectedObserverPos[1] = observerRelativeToProjector[1] + lightDir[1] * observerDot_LigtDir;
      projectedObserverPos[2] = observerRelativeToProjector[2] + lightDir[2] * observerDot_LigtDir;
      let projectedObserverDist = vec3.len(projectedObserverPos);
      let projectedObserverDir = vec3.normalize(vec3.create(), projectedObserverPos);
      let minDist = Math.min(projectedObserverDist, this._RCloud1);

      let offset = this._visibleDist * this._localShadowsVisibleDistScale;
      let cameraPos = vec3.create();
      cameraPos[0] = projectorOrigin[0] + projectedObserverDir[0] * minDist;
      cameraPos[1] = projectorOrigin[1] + projectedObserverDir[1] * minDist;
      cameraPos[2] = projectorOrigin[2] + projectedObserverDir[2] * minDist;
      this._getLookAtMat(this._localCloudShadowMapViewMat, projectorOrigin, new Float32Array(3));
      this._localCloudShadowMapViewMat.set(cameraPos, 12);
      mat4.invert(this._localCloudShadowMapViewMatInv, this._localCloudShadowMapViewMat);

      offset = this._visibleDist * this._globalShadowsVisibleDistScale;
      cameraPos[0] = projectorOrigin[0] + projectedObserverDir[0] * minDist;
      cameraPos[1] = projectorOrigin[1] + projectedObserverDir[1] * minDist;
      cameraPos[2] = projectorOrigin[2] + projectedObserverDir[2] * minDist;
      this._getLookAtMat(this._globalCloudShadowMapViewMat, projectorOrigin, new Float32Array(3));
      this._globalCloudShadowMapViewMat.set(cameraPos, 12);
      mat4.invert(this._globalCloudShadowMapViewMatInv, this._globalCloudShadowMapViewMat);

      let globalVisibility = this._visibleDist * this._globalShadowsVisibleDistScale;

      mat4.ortho(
        this._globalCloudShadowMapProjMat,
        -globalVisibility,
        globalVisibility,
        -globalVisibility,
        globalVisibility,
        -this._RCloud1,
        this._RCloud1
      );

      mat4.ortho(
        this._localCloudShadowMapProjMat,
        -this._visibleDist * this._localShadowsVisibleDistScale,
        this._visibleDist * this._localShadowsVisibleDistScale,
        -this._visibleDist * this._localShadowsVisibleDistScale,
        this._visibleDist * this._localShadowsVisibleDistScale,
        -this._RCloud1,
        this._RCloud1
      );

      mat4.mul(this._localCloudShadowMapProjViewMatInv, this._localCloudShadowMapProjMat, this._localCloudShadowMapViewMatInv);
      mat4.mul(this._globalCloudShadowMapProjViewMatInv, this._globalCloudShadowMapProjMat, this._globalCloudShadowMapViewMatInv);
    }

    _updateVisibleDist () {
      let h = vec3.len(this._viewMat.slice(12, 15));
      this._visibleDist = Math.min(
        this._RCloud1,
        Math.sqrt(h * h - this._RPlanet * this._RPlanet) + Math.sqrt(this._RCloud1 * this._RCloud1 - this._RPlanet * this._RPlanet)
      );
    }

    _resetFramebufferAttachments () {
      let i;
      let maxAttachemts = this._gl.getParameter(this._gl.MAX_COLOR_ATTACHMENTS);
      for (i = 0; i < maxAttachemts; i++) {
        this._gl.framebufferTexture2D(this._gl.FRAMEBUFFER, this._gl[`COLOR_ATTACHMENT${i}`], this._gl.TEXTURE_2D, null, 0);
      }
    }

    _setupRenderingToBufferTexture (viewportWidth = DEFAULT_RES, viewportHeight = DEFAULT_RES, framebuffer = this._framebuffer) {
      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, framebuffer);
      this._gl.viewport(0, 0, viewportWidth, viewportHeight);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._bufferVerticesBuf);
      this._gl.vertexAttribPointer(this._currentProgram.attrs.aPos, 3, this._gl.FLOAT, false, 0, 0);
      this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._bufferIndicesBuf);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._bufferTextureCoordBuf);
      this._gl.vertexAttribPointer(this._currentProgram.attrs.aTexCoord, 2, this._gl.FLOAT, false, 0, 0);
    }

    _renderSkyVolume () {
      this._setCurrentProgram(this._programs.renderSkyVolume);
      this._setupRenderingToBufferTexture(SKY_VOLUME_SIZE[0], SKY_VOLUME_SIZE[1], this._skyVolumeFramebuffer);
      this._gl.drawBuffers([this._gl.COLOR_ATTACHMENT0, this._gl.COLOR_ATTACHMENT1]);
      let i;
      for (i = 0; i < SKY_VOLUME_SIZE[2]; i++) {
        this._gl.framebufferTextureLayer(
          this._gl.FRAMEBUFFER,
          this._gl.COLOR_ATTACHMENT0,
          this._skyScatteringVolume,
          0,
          i
        );
        this._gl.framebufferTextureLayer(
          this._gl.FRAMEBUFFER,
          this._gl.COLOR_ATTACHMENT1,
          this._skyTransmittanceVolume,
          0,
          i
        );
        this._gl.uniform1f(this._programs.renderSkyVolume.unifs.uRenderLayer, i);
        this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
      }
      this._resetFramebufferAttachments();
      this._gl.drawBuffers([this._gl.COLOR_ATTACHMENT0]);
    }

    _renderSkyViewLUT () {
      this._setCurrentProgram(this._programs.renderSkyViewLUT);
      this._setupRenderingToBufferTexture(SKY_VIEW_LUT_SIZE[0], SKY_VIEW_LUT_SIZE[1], this._skyViewLUTFramebuffer);
      this._gl.drawBuffers([this._gl.COLOR_ATTACHMENT0]);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._skyViewLUT,
        0
      );
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);

      // bilateral blur as an attempt to hide stepping(banding) caused by small sample size on highly curved planets (when RPlanet ralatively small)
      this._blurTex(this._skyViewLUT, this._skyViewLUTSwap, SKY_VIEW_LUT_SIZE[0], SKY_VIEW_LUT_SIZE[1], this._skyViewLUTFramebuffer);
    }

    _renderSkyShadowMap () {
      if (!this._shouldRecalcSkyShadowMap) {
        return;
      }
      mat4.ortho(
        this._skyShadowMapProjMat,
        -this._R1,
        this._R1,
        -this._R1,
        this._R1,
        -this._R1,
        this._R1
      );
      // mat4.perspective(
      //   this._shadowMapProjMat,
      //   Math.atan(this._RCloud1 / vec3.len(this._lightPos)) * 2,
      //   1.,
      //   ZNEAR,
      //   ZFAR
      // );
      this._setCurrentProgram(this._programs.renderSkyShadowMap);
      this._setupRenderingToBufferTexture(SKY_OPTICAL_DEPTH_LUT_SIZE[0], SKY_OPTICAL_DEPTH_LUT_SIZE[1], this._skyOpticalDepthFramebuffer);
      this._gl.drawBuffers([this._gl.COLOR_ATTACHMENT0]);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._skyOpticalDepthTex,
        0
      );
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);

      this._gl.bindTexture(this._gl.TEXTURE_2D, this._skyOpticalDepthTex);
      this._gl.generateMipmap(this._gl.TEXTURE_2D);


      // this._setupRenderingToBufferTexture(SKY_VOLUME_W, SKY_VOLUME_W);
      // let i;
      // for (i = 0; i < SKY_VOLUME_D; i++) {
      //   this._gl.framebufferTextureLayer(
      //     this._gl.FRAMEBUFFER,
      //     this._gl.COLOR_ATTACHMENT0,
      //     this._skyScatteringVolume,
      //     0,
      //     i
      //   );
      //   this._gl.uniform1f(this._programs.renderSkyShadowMap.unifs.uRenderLayer, i);
      //   this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
      // }
      this._shouldRecalcSkyShadowMap = false;
    }

    _renderCloudShadowMaps () {
      if (!this._shouldRecalcCloudShadowMap) {
        return;
      }
      this._updateShadowMapMatrices();
      this._setCurrentProgram(this._programs.renderCloudShadowMaps);
      this._setupRenderingToBufferTexture(CLOUD_SHADOW_MAP_SIZE[0], CLOUD_SHADOW_MAP_SIZE[1], this._cloudShadowmapFramebuffer);
      this._gl.drawBuffers([this._gl.COLOR_ATTACHMENT0, this._gl.COLOR_ATTACHMENT1]);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._globalCloudShadowMap,
        0
      );
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT1,
        this._gl.TEXTURE_2D,
        this._localCloudShadowMap,
        0
      );
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
      this._gl.drawBuffers([this._gl.COLOR_ATTACHMENT0]);
      this._resetFramebufferAttachments();

      // this._gl.bindTexture(this._gl.TEXTURE_2D, this._localCloudShadowMap);
      // this._gl.generateMipmap(this._gl.TEXTURE_2D);
      this._shouldRecalcCloudShadowMap = false;
    }

    _renderCloudShadowMapVolume () {
      let i;
      this._setCurrentProgram(this._programs.renderCloudShadowMapVolume);
      this._setupRenderingToBufferTexture(CLOUD_SHADOW_MAP_VOLUME_SIZE[0], CLOUD_SHADOW_MAP_VOLUME_SIZE[1], this._cloudShadowMapVolFramebuffer);
      for (i = 0; i < CLOUD_SHADOW_MAP_VOLUME_SIZE[2]; i++) {
        this._gl.framebufferTextureLayer(
          this._gl.FRAMEBUFFER,
          this._gl.COLOR_ATTACHMENT0,
          this._cloudShadowMapVol,
          0,
          i
        );
        this._gl.uniform1f(this._programs.renderCloudShadowMapVolume.unifs.uRenderLayer, i);
        this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
      }
    }

    _renderWeatherMap () {
      this._setCurrentProgram(this._programs.renderWeatherMap);
      this._setupRenderingToBufferTexture(WEATHER_MAP_SIZE[0], WEATHER_MAP_SIZE[1], this._weatherMapFramebuffer);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._weatherMap,
        0
      );
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.drawElements(this._gl.TRIANGLES, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
    }

    _renderAtmosphere () {
      this._setCurrentProgram(this._programs.renderAtmosphere);
      this._setupRenderingToBufferTexture(this._windowSize[0] * this._resolutionScale, this._windowSize[1] * this._resolutionScale, this._atmosphereFramebuffer);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._backBuffer,
        0
      );
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT1,
        this._gl.TEXTURE_2D,
        this._primaryCloudLayerBuffer,
        0
      );
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT2,
        this._gl.TEXTURE_2D,
        this._primaryCloudLayerTransmittanceBuffer,
        0
      );
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT3,
        this._gl.TEXTURE_2D,
        this._crepuscularRaysBuffer,
        0
      );
      this._gl.drawBuffers([
        this._gl.COLOR_ATTACHMENT0,
        this._gl.COLOR_ATTACHMENT1,
        this._gl.COLOR_ATTACHMENT2,
        this._gl.COLOR_ATTACHMENT3
      ]);
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
      this._gl.drawBuffers([this._gl.COLOR_ATTACHMENT0]);
      this._resetFramebufferAttachments();

      // this._blurTex(this._primaryCloudLayerBuffer, this._primaryCloudLayerBufferSwap, this._windowSize[0], this._windowSize[1], this._atmosphereFramebuffer);

      let swap;
      swap = this._primaryCloudLayerBuffer;
      this._primaryCloudLayerBuffer = this._primaryCloudLayerBufferSwap;
      this._primaryCloudLayerBufferSwap = swap;

      swap = this._crepuscularRaysBuffer;
      this._crepuscularRaysBuffer = this._crepuscularRaysBufferSwap;
      this._crepuscularRaysBufferSwap = swap;

      swap = this._primaryCloudLayerTransmittanceBuffer;
      this._primaryCloudLayerTransmittanceBuffer = this._primaryCloudLayerTransmittanceBufferSwap;
      this._primaryCloudLayerTransmittanceBufferSwap = swap;
    }

    _renderTex (tex, is3DTex = false) {
      this._setCurrentProgram(this._programs.finalRender);
      this._setupRenderingToScreen();
      if (is3DTex) {
        this._gl.activeTexture(this._gl.TEXTURE1);
        this._gl.bindTexture(this._gl.TEXTURE_3D, tex);
        this._gl.uniform1i(this._programs.finalRender.unifs.uRender3DTex, 1);
      } else {
        this._gl.activeTexture(this._gl.TEXTURE0);
        this._gl.bindTexture(this._gl.TEXTURE_2D, tex);
        this._gl.uniform1i(this._programs.finalRender.unifs.uRender3DTex, 0);
      }
      this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
    }

    _render2DTex (tex) {
      this._setCurrentProgram(this._programs.render2DTex);
      this._setupRenderingToScreen();
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, tex);
      this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
    }

    _blurTex (inTex, outTex, texWidth, texHeight, fbo) {
      this._setCurrentProgram(this._programs.blurTex);
      this._setupRenderingToBufferTexture(texWidth, texHeight, fbo);
      this._gl.drawBuffers([this._gl.COLOR_ATTACHMENT0]);
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, inTex);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        outTex,
        0
      );
      this._gl.uniform2fv(this._currentProgram.unifs.uTexSize, new Float32Array([texWidth, texHeight]));
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
    }

    _denoise (inTex, outTex, texWidth, texHeight, fbo) {
      this._setCurrentProgram(this._programs.blurTex);
      this._setupRenderingToBufferTexture(texWidth, texHeight, fbo);
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, inTex);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        outTex,
        0
      );
      // this._gl.uniform2fv(this._currentProgram.unifs.uTexSize, new Float32Array([texWidth, texHeight]));
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.drawElements(this._drawMode, this._bufferIndices.length, this._gl.UNSIGNED_INT, 0);
    }

    _setupRenderingToScreen () {
      this._gl.clearColor(.0, .0, .0, 1.);
      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null);
      this._gl.viewport(0, 0, this._windowSize[0], this._windowSize[1]);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._bufferVerticesBuf);
      this._gl.vertexAttribPointer(this._currentProgram.attrs.aPos, 3, this._gl.FLOAT, false, 0, 0);
      this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._bufferIndicesBuf);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._bufferTextureCoordBuf);
      this._gl.vertexAttribPointer(this._currentProgram.attrs.aTexCoord, 2, this._gl.FLOAT, false, 0, 0);
    }

    _checkIfMoving () {
      let cameraPos = this._viewMat.slice(12,15);
      let prevCameraPos = this._prevViewMat.slice(12, 15);
      this._isMoving = cameraPos[0] != prevCameraPos[0] || cameraPos[1] != prevCameraPos[1] || cameraPos[2] != prevCameraPos[2];
    }

    _checkCameraPlanetCollision () {
      if (!this._checkCollisionWithPlanet) {
        return;
      }
      let cameraPos = this._viewMat.slice(12, 15);
      let len = vec3.len(cameraPos);
      // let prevCameraPos = this._prevViewMat.slice(12, 16);
      let v = vec3.create();
      // vec3.sub(v, prevCameraPos, cameraPos); // therefore actually -v
      vec3.normalize(v, cameraPos);
      if (len <= this._RPlanet) {
        let RPlanetDist = this._raySphereIntersect(cameraPos, v, [0, 0, 0], this._RPlanet, false) + .01;
        let newPos = vec3.create();
        let posShift = vec3.create();
        posShift[0] = v[0] * RPlanetDist;
        posShift[1] = v[1] * RPlanetDist;
        posShift[2] = v[2] * RPlanetDist;
        vec3.add(newPos, cameraPos, posShift);
        this._viewMat.set(newPos, 12);
      }
    }

    _dbgCalcReprojectedVals (resVec = new Float32Array([1., 1., 1., 1.])) {
      let rvCur = new Float32Array(4);
      rvCur.set(resVec, 0);

      resVec[0] = this._prevViewMatInv[0] * rvCur[0] + this._prevViewMatInv[4] * rvCur[1] + this._prevViewMatInv[8] * rvCur[2] + this._prevViewMatInv[12] * rvCur[3];
      resVec[1] = this._prevViewMatInv[1] * rvCur[0] + this._prevViewMatInv[5] * rvCur[1] + this._prevViewMatInv[9] * rvCur[2] + this._prevViewMatInv[13] * rvCur[3];
      resVec[2] = this._prevViewMatInv[2] * rvCur[0] + this._prevViewMatInv[6] * rvCur[1] + this._prevViewMatInv[10] * rvCur[2] + this._prevViewMatInv[14] * rvCur[3];
      resVec[3] = this._prevViewMatInv[3] * rvCur[0] + this._prevViewMatInv[7] * rvCur[1] + this._prevViewMatInv[11] * rvCur[2] + this._prevViewMatInv[15] * rvCur[3];

      rvCur.set(resVec, 0);

      resVec[0] = this._projMat[0] * rvCur[0] + this._projMat[4] * rvCur[1] + this._projMat[8] * rvCur[2] + this._projMat[12] * rvCur[3];
      resVec[1] = this._projMat[1] * rvCur[0] + this._projMat[5] * rvCur[1] + this._projMat[9] * rvCur[2] + this._projMat[13] * rvCur[3];
      resVec[2] = this._projMat[2] * rvCur[0] + this._projMat[6] * rvCur[1] + this._projMat[10] * rvCur[2] + this._projMat[14] * rvCur[3];
      resVec[3] = this._projMat[3] * rvCur[0] + this._projMat[7] * rvCur[1] + this._projMat[11] * rvCur[2] + this._projMat[15] * rvCur[3];

      let resVecPrspDiv = new Float32Array(4);
      resVecPrspDiv[0] = resVec[0] / resVec[3];
      resVecPrspDiv[1] = resVec[1] / resVec[3];
      resVecPrspDiv[2] = resVec[2] / resVec[3];

      console.log(resVec);
      console.log(resVecPrspDiv);
    }

    update () {
      let t = performance.now();
      if (this._animateSun) {
        this._lightPos[1] = Math.abs(Math.sin(performance.now() * .0002)) * this._RSun * 100.;
        this._lightPos[2] = Math.abs(Math.cos(performance.now() * .0002)) * this._RSun * 100.;
        this._shouldRecalcCloudShadowMap = true;
        // this._shouldRecalcSkyShadowMap = true;
      }
      this._timeModded = performance.now() % 100000.;
      mat4.copy(this._prevViewMat, this._viewMat);
      mat4.invert(this._prevViewMatInv, this._prevViewMat);
      mat4.mul(this._projPrevViewMatInv, this._projMat, this._prevViewMatInv);
      this._processMouse();
      this._processKeys();
      this._checkCameraPlanetCollision();
      this._checkIfMoving();
      this._updateVisibleDist();
      if (this._isMoving || this._windMagnitude !== 0.) {
        this._shouldRecalcCloudShadowMap = true;
      }
      DBG_INFO.updateTime = performance.now() - t;
    }

    render () {
      // this._renderWeatherMap();
      this._renderCloudShadowMaps();
      // this._renderCloudShadowMapVolume();
      this._renderSkyShadowMap();
      this._renderSkyViewLUT();
      this._renderSkyVolume();
      this._renderAtmosphere();
      this._render2DTex(this._backBuffer);
    }

    _hexToRGB (hex = '#000000', normalize = false) {
      if (hex.length < 7) {
        return [0, 0, 0];
      }
      let pureStr = hex.substr(1, hex.length);
      let r = Number.parseInt(pureStr.substr(0, 2), 16);
      let g = Number.parseInt(pureStr.substr(2, 2), 16);
      let b = Number.parseInt(pureStr.substr(4, 2), 16);
      if (normalize) {
        r /= 255;
        g /= 255;
        b /= 255;
      }
      return [r, g, b];
    }

    _RGBToHex (rgb = [], normalized = false) {
      if (rgb.length < 3) {
        return '#000000';
      }
      let r = rgb[0];
      let g = rgb[1];
      let b = rgb[2];
      let hex;
      if (normalized) {
        r = Math.round(r * 255);
        g = Math.round(g * 255);
        b = Math.round(b * 255);
      }
      let rs = r.toString(16);
      let gs = g.toString(16);
      let bs = b.toString(16);
      if (rs.length < 2) {
        rs = `0${rs}`;
      }
      if (gs.length < 2) {
        gs = `0${gs}`;
      }
      if (bs.length < 2) {
        bs = `0${bs}`;
      }
      hex = `#${rs}${gs}${bs}`;
      return hex;
    }

    _applySimConfig (cfg) {
      let i;
      let j;
      let inputField;
      let idx;
      this._shouldRecalcCloudShadowMap = true;
      this._shouldRecalcSkyShadowMap = true;
      for (i in cfg) {
        inputField = document.querySelector(`[data-field="${i}"]`);
        if (inputField === null) {
          console.log('WARN: no input found with data-field=', i);
          continue;
        }
        idx = parseInt(inputField.dataset.idx, 10);
        if (inputField.type === 'number') {
          if (!Number.isNaN(idx)) {
            inputField.value = cfg[i][idx];
          } else {
            inputField.value = cfg[i];
          }
        } else if (inputField.type === 'color') {
          let colorVal = cfg[i];
          if (vec3.len(cfg[i]) <= 1.) {
            colorVal = vec3.normalize(new Float32Array(3), cfg[i]);
          }
          inputField.value = this._RGBToHex(colorVal, true);
        } else if (inputField.type === 'checkbox') {
          inputField.checked = cfg[i];
        }
        if (typeof cfg[i] === 'object' && cfg[i].length !== undefined) {
          if (this[i] !== undefined) {
            for (j = 0; j < this[i].length; j++) {
              this[i][j] = cfg[i][j];
            }
            continue;
          }
        }
        this[i] = cfg[i];
      }
    }

    // defining all ui related stuff here in order to easily move/remove in next projects
    // in this case it becomes self-contained plug-n-play thing.
    _addUI () {
      let html = `
        <div class="control-panel">
          <div class="section">Sun:</div>
          <div class="ui-item">
            <span class="caption">magnitude:</span>
            <input type="number"
              data-field="_lightMagnitude"
              data-val-min="0"
              step=".1"
              class="narrow-64"
              value="${this._lightMagnitude}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">radisu:</span>
            <input type="number"
              data-field="_RSun"
              data-val-min="0"
              step=".1"
              class="narrow-64"
              value="${this._RSun}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">X:</span>
            <input type="number"
              data-field="_lightPos"
              data-idx="0"
              data-recalc-shadow-map="true"
              step="50"
              class="narrow-64"
              value="${this._lightPos[0]}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">Y:</span>
            <input type="number"
              data-field="_lightPos"
              data-idx="1"
              data-recalc-shadow-map="true"
              step="50"
              class="narrow-64"
              value="${this._lightPos[1]}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">Z:</span>
            <input type="number"
              data-field="_lightPos"
              data-idx="2"
              data-recalc-shadow-map="true"
              step="50"
              class="narrow-64"
              value="${this._lightPos[2]}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">color:</span>
            <input type="color"
              data-field="_lightColor"
              class="narrow-64"
              value="${this._RGBToHex(this._lightColor, true)}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">animate sun:</span>
            <input type="checkbox"
              data-field="_animateSun"
              ${this._animateSun ? 'checked' : ''}
            />
          </div>

          <div class="section">Sky:</div>
          <div class="ui-item">
            <span class="caption">planet radius:</span>
            <input type="number"
              data-field="_RPlanet"
              data-recalc-sky-shadow-map="true"
              data-val-min="0"
              step=".1"
              class="narrow-64"
              value="${this._RPlanet}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">atmosphere radius:</span>
            <input type="number"
              data-field="_R1"
              data-recalc-sky-shadow-map="true"
              data-val-min="0"
              step=".1"
              class="narrow-64"
              value="${this._R1}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">rayleigh scattering:</span>
            <input type="color"
              data-field="_rayleighScattering"
              data-magnitude-scale="${this._rayleighScatteringMagnitude}"
              data-recalc-sky-shadow-map="true"
              class="narrow-64"
              value="${this._RGBToHex(vec3.normalize(new Float32Array(3), this._rayleighScattering), true)}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">rayleigh scattering mul:</span>
            <input type="number"
              data-field="_skyScatteringMul"
              data-recalc-sky-shadow-map="true"
              data-val-min="0"
              step=".1"
              class="narrow-64"
              value="${this._skyScatteringMul}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">ozone absorbtion mul:</span>
            <input type="number"
              data-field="_skyAbsorptionMul"
              data-recalc-sky-shadow-map="true"
              data-val-min="0"
              step=".1"
              class="narrow-64"
              value="${this._skyAbsorptionMul}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">rayleigh density scale 1/:</span>
            <input type="number"
              data-field="_rayleighScatteringScale"
              data-recalc-sky-shadow-map="true"
              data-val-min="0"
              step=".1"
              class="narrow-64"
              value="${this._rayleighScatteringScale}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">mie density scale 1/:</span>
            <input type="number"
              data-field="_mieScatteringScale"
              data-recalc-sky-shadow-map="true"
              data-val-min="0"
              step=".1"
              class="narrow-64"
              value="${this._mieScatteringScale}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">mie scattering:</span>
            <input type="color"
              data-field="_mieScattering"
              data-magnitude-scale="${this._mieScatteringMagnitude}"
              data-recalc-sky-shadow-map="true"
              class="narrow-64"
              value="${this._RGBToHex(vec3.normalize(new Float32Array(3), this._mieScattering), true)}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">mie absorbtion:</span>
            <input type="color"
              data-field="_mieAbsorbtion"
              data-magnitude-scale="${this._mieAbsorbtionMagnitude}"
              data-recalc-sky-shadow-map="true"
              class="narrow-64"
              value="${this._RGBToHex(vec3.normalize(new Float32Array(3), this._mieAbsorbtion), true)}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">mie phase G:</span>
            <input type="number"
              data-field="_miePhaseG"
              data-recalc-sky-shadow-map="true"
              class="narrow-64"
              step=".01"
              value="${this._miePhaseG}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">march samples:</span>
            <input type="number"
              data-field="_skyMarchSamples"
              data-val-min="1"
              step="1"
              class="narrow-64"
              value="${this._skyMarchSamples}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">scatt octaves:</span>
            <input type="number"
              data-field="_skyScattOctaves"
              data-val-min="0"
              step="1"
              class="narrow-64"
              value="${this._skyScattOctaves}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">optical depth map samples:</span>
            <input type="number"
              data-field="_skyShadowMapSamples"
              data-recalc-sky-shadow-map="true"
              data-val-min="1"
              step="1"
              class="narrow-64"
              value="${this._skyShadowMapSamples}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">bilateral blur sigma:</span>
            <input type="number"
              data-field="_bilateralBlurSigma"
              data-val-min="0."
              step=".1"
              class="narrow-64"
              value="${this._bilateralBlurSigma}"
            />
          </div>
          <div class="ui-item">
            <span class="caption">bilateral blur bsigma:</span>
            <input type="number"
              data-field="_bilateralBlurBSigma"
              data-val-min="0."
              step=".1"
              class="narrow-64"
              value="${this._bilateralBlurBSigma}"
            />
          </div>

          <div class="section">Clouds:</div>
          <div class="ui-item">
            <span class="caption">start radius:</span>
            <input type="number" data-field="_RCloud0" data-recalc-shadow-map="true" data-val-min="0" step=".1" class="narrow-64" value="${this._RCloud0}"/>
          </div>
          <div class="ui-item">
            <span class="caption">end radius:</span>
            <input type="number" data-field="_RCloud1" data-recalc-shadow-map="true" data-val-min="0" step=".1" class="narrow-64" value="${this._RCloud1}"/>
          </div>
          <div class="ui-item">
            <span class="caption">scattering:</span>
            <input type="color" data-field="_cloudScattering" data-recalc-shadow-map="true" class="narrow-64" value="${this._RGBToHex(this._cloudScattering, true)}"/>
          </div>
          <div class="ui-item">
            <span class="caption">density mul:</span>
            <input type="number" data-field="_cloudDensityMul" data-recalc-shadow-map="true" data-val-min="0" step="1" class="narrow-64" value="${this._cloudDensityMul}"/>
          </div>
          <div class="ui-item">
            <span class="caption">march samples:</span>
            <input type="number" data-field="_cloudMarchSamples" data-val-min="1" step=".5" class="narrow-64" value="${this._cloudMarchSamples}"/>
          </div>
          <div class="ui-item">
            <span class="caption">max stsepSize:</span>
            <input type="number" data-field="_cloudMarchMaxStepSize" data-val-min=".001" step=".01" class="narrow-64" value="${this._cloudMarchMaxStepSize}"/>
          </div>
          <div class="ui-item">
            <span class="caption">shadow march samples:</span>
            <input type="number" data-field="_cloudShadowSamples" data-val-min="1" step="1." class="narrow-64" value="${this._cloudShadowSamples}"/>
          </div>
          <div class="ui-item">
            <span class="caption">scatt octaves:</span>
            <input type="number" data-field="_cloudScattOctaves" data-val-min="0" step="1" class="narrow-64" value="${this._cloudScattOctaves}"/>
          </div>
          <div class="ui-item">
            <span class="caption">optical depth map samples:</span>
            <input type="number" data-field="_cloudShadowMapSamples" data-recalc-shadow-map="true" data-val-min="1" step="1" class="narrow-64" value="${this._cloudShadowMapSamples}"/>
          </div>
          <div class="ui-item">
            <span class="caption">phase g0:</span>
            <input type="number" data-field="_cloudPhaseG0" step=".05" class="narrow-64" value="${this._cloudPhaseG0}"/>
          </div>
          <div class="ui-item">
            <span class="caption">phase g1:</span>
            <input type="number" data-field="_cloudPhaseG1" data-val-min="0" step=".05" class="narrow-64" value="${this._cloudPhaseG1}"/>
          </div>
          <div class="ui-item">
            <span class="caption">base density start:</span>
            <input type="number" data-field="_cloudBaseDensityStart" data-recalc-shadow-map="true" data-val-min="0" data-val-max="1" step=".01" class="narrow-64" value="${this._cloudBaseDensityStart}"/>
          </div>
          <div class="ui-item">
            <span class="caption">top density start:</span>
            <input type="number" data-field="_cloudTopDensityStart" data-recalc-shadow-map="true" data-val-min="0" data-val-max="1" step=".01" class="narrow-64" value="${this._cloudTopDensityStart}"/>
          </div>
          <div class="ui-item">
            <span class="caption">top density end:</span>
            <input type="number" data-field="_cloudTopDensityEnd" data-recalc-shadow-map="true" data-val-min="0" data-val-max="1" step=".01" class="narrow-64" value="${this._cloudTopDensityEnd}"/>
          </div>
          <div class="ui-item">
            <span class="caption">erosion threshold:</span>
            <input type="number" data-field="_erosionThreshold" data-recalc-shadow-map="true" data-val-min="0" step="0.01" class="narrow-64" value="${this._erosionThreshold}"/>
          </div>
          <div class="ui-item">
            <span class="caption">cloud noise scale:</span>
            <input type="number" data-field="_cloudTexScale" data-recalc-shadow-map="true" data-val-min="0" step=".01" class="narrow-64" value="${this._cloudTexScale}"/>
          </div>
          <div class="ui-item">
            <span class="caption">weather tex scale:</span>
            <input type="number" data-field="_weatherTexScale" data-recalc-shadow-map="true" data-val-min="0" step=".01" class="narrow-64" value="${this._weatherTexScale}"/>
          </div>
          <div class="ui-item">
            <span class="caption">wind magnitude:</span>
            <input type="number"
              data-field="_windMagnitude"
              data-recalc-shadow-map="true"
              data-val-min=".0"
              step=".01"
              class="narrow-64"
              value="${this._windMagnitude}"
            />
          </div>

          <div class="section">Misc:</div>
          <div class="ui-item">
            <span class="caption">temporal coef:</span>
            <input type="number" data-field="_temporalAlpha" data-val-min="0" data-val-max="1" step=".05" class="narrow-64" value="${this._temporalAlpha}"/>
          </div>
          <div class="ui-item">
            <span class="caption">resolution scale:</span>
            <input type="number" data-field="_resolutionScale" data-val-min=".1" step=".1" data-reset-texture-assets="true" class="narrow-64" value="${this._resolutionScale}"/>
          </div>
          <div class="ui-item">
            <span class="caption">crepuscular rays samples:</span>
            <input type="number" data-field="_crepuscularRaysMarchSamples" data-val-min="1" step="1" class="narrow-64" value="${this._crepuscularRaysMarchSamples}"/>
          </div>
          <div class="ui-item">
            <span class="caption">local shadowmap visible dist:</span>
            <input type="number" data-field="_localShadowsVisibleDistScale" data-recalc-shadow-map="true" data-val-min="0." data-val-max="1." step=".01" class="narrow-64" value="${this._localShadowsVisibleDistScale}"/>
          </div>
          <div class="ui-item">
            <span class="caption">global shadowmap visible dist:</span>
            <input type="number" data-field="_globalShadowsVisibleDistScale" data-recalc-shadow-map="true" data-val-min="0." data-val-max="1." step=".01" class="narrow-64" value="${this._globalShadowsVisibleDistScale}"/>
          </div>
          <div class="ui-item">
            <span class="caption">collision with planet:</span><input type="checkbox" data-field="_checkCollisionWithPlanet" ${this._checkCollisionWithPlanet ? 'checked' : ''}/>
          </div>
          <div class="ui-item">
            <span class="caption">march crepuscular rays:</span><input type="checkbox" data-field="_marchCrepuscularRays" ${this._marchCrepuscularRays ? 'checked' : ''}/>
          </div>
          <div class="ui-item">
            <span class="caption">sample cloud noise:</span><input type="checkbox" data-field="_sampleCloudNoise" data-recalc-shadow-map="true" ${this._sampleCloudNoise ? 'checked' : ''}/>
          </div>
          <div class="ui-item">
            <span class="caption">show debug info:</span><input type="checkbox" data-field="_showDbgInfo" ${this._showDbgInfo ? 'checked' : ''}/>
          </div>
          <div class="ui-item">
            <span class="caption">hide ui when not in focus:</span>
            <input type="checkbox"
              data-field="_hideUIOnBlur"
              data-switch-class="hide-on-blur"
              ${this._hideUIOnBlur ? 'checked' : ''}
            />
          </div>
          <div class="ui-item reset-sim">
            <div class="button">reset</div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', html);
      let cp = document.querySelector('.control-panel');
      cp.addEventListener('wheel', (e) => {
        e.stopPropagation();
      });
      cp.addEventListener('keydown', (e) => {
        e.stopPropagation();
      });
      cp.addEventListener('keyup', (e) => {
        e.stopPropagation();
      });

      let inputHandler = (e) => {
        let fieldName = e.target.dataset.field;
        if (this[fieldName] == undefined) {
          console.error('ERR: no fieldName', fieldName);
          return;
        }
        let idx = parseInt(e.target.dataset.idx, 10);
        let resetTextureAssets = e.target.dataset.resetTextureAssets === 'true';
        let recalcShadowMap = e.target.dataset.recalcShadowMap === 'true';
        let recalcSkyShadowMap = e.target.dataset.recalcSkyShadowMap === 'true';
        let minVal = parseFloat(e.target.dataset.valMin);
        let maxVal = parseFloat(e.target.dataset.valMax);
        if (Number.isNaN(minVal)) {
          minVal = -Infinity;
        }
        if (Number.isNaN(maxVal)) {
          maxVal = Infinity;
        }
        let val = Number.parseFloat(e.target.value);
        if (Number.isNaN(val)) {
          val = minVal;
        }
        val = Math.min(Math.max(minVal, val), maxVal);
        if (this[fieldName].length !== undefined) {
          if(Number.isNaN(idx) === false) {
            this[fieldName][idx] = val;
          } else {
            console.error('ERR: no idx was provided for array field', fieldName);
          }
        } else {
          this[fieldName] = val;
        }
        e.target.value = val;
        this._shouldRecalcCloudShadowMap = recalcShadowMap;
        this._shouldRecalcSkyShadowMap = recalcSkyShadowMap;
        if (resetTextureAssets) {
          this._createResolutionDependentAssets();
        }
      };

      let wheelHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        let fieldName = e.target.dataset.field;
        if (this[fieldName] == undefined) {
          console.error('ERR: no fieldName', fieldName);
          return;
        }
        let idx = parseInt(e.target.dataset.idx, 10);
        let resetTextureAssets = e.target.dataset.resetTextureAssets === 'true';
        let recalcShadowMap = e.target.dataset.recalcShadowMap === 'true';
        let recalcSkyShadowMap = e.target.dataset.recalcSkyShadowMap === 'true';
        let val = parseFloat(e.target.value);
        let wheelStep = parseFloat(e.target.step);
        let minVal = parseFloat(e.target.dataset.valMin);
        let maxVal = parseFloat(e.target.dataset.valMax);
        if (Number.isNaN(minVal)) {
          minVal = -Infinity;
        }
        if (Number.isNaN(maxVal)) {
          maxVal = Infinity;
        }
        if (e.wheelDeltaY > 0) {
          val += wheelStep;
        } else {
          val -= wheelStep;
        }
        val = Math.min(Math.max(minVal, val), maxVal);
        if (this[fieldName].length !== undefined) {
          if(Number.isNaN(idx) === false) {
            this[fieldName][idx] = val;
          } else {
            console.error('ERR: no idx was provided for array field', fieldName);
          }
        } else {
          this[fieldName] = val;
        }
        e.target.value = val;
        this._shouldRecalcCloudShadowMap = recalcShadowMap;
        this._shouldRecalcSkyShadowMap = recalcSkyShadowMap;
        if (resetTextureAssets) {
          this._createResolutionDependentAssets();
        }
      };

      let colorInputHandler = (e) => {
        let fieldName = e.target.dataset.field;
        if (this[fieldName] == undefined) {
          console.error('ERR: no fieldName', fieldName);
          return;
        }
        let magnitudeScale = parseFloat(e.target.dataset.magnitudeScale);
        if (Number.isNaN(magnitudeScale)) {
          magnitudeScale = 1.;
        }
        let recalcShadowMap = e.target.dataset.recalcShadowMap === 'true';
        let recalcSkyShadowMap = e.target.dataset.recalcSkyShadowMap === 'true';
        let rgb = this._hexToRGB(e.target.value, true);
        rgb[0] = rgb[0] * magnitudeScale;
        rgb[1] = rgb[1] * magnitudeScale;
        rgb[2] = rgb[2] * magnitudeScale;
        this[fieldName].set(rgb, 0);
        this._shouldRecalcCloudShadowMap = recalcShadowMap;
        this._shouldRecalcSkyShadowMap = recalcSkyShadowMap;
      };

      let checkboxHandler = (e) => {
        let fieldName = e.target.dataset.field;
        if (this[fieldName] == undefined) {
          console.error('ERR: no fieldName', fieldName);
          return;
        }
        let classSwitch = e.target.dataset.switchClass;
        let recalcShadowMap = e.target.dataset.recalcShadowMap === 'true';
        let recalcSkyShadowMap = e.target.dataset.recalcSkyShadowMap === 'true';
        this[fieldName] = e.target.checked;
        this._shouldRecalcCloudShadowMap = recalcShadowMap;
        this._shouldRecalcSkyShadowMap = recalcSkyShadowMap;
        if (e.target.checked) {
          document.querySelector('.control-panel').classList.add(classSwitch);
        } else {
          document.querySelector('.control-panel').classList.remove(classSwitch);
        }
      };

      let i;
      let uiItems = document.querySelectorAll('.ui-item');
      let inputEl;
      for (i = 0; i < uiItems.length; i++) {
        inputEl = uiItems[i].querySelector('input');
        if (!inputEl) {
          continue;
        }
        if (inputEl.type === 'number') {
          inputEl.addEventListener('input', inputHandler);
          inputEl.addEventListener('wheel', wheelHandler);
        } else if (inputEl.type === 'color') {
          inputEl.addEventListener('input', colorInputHandler);
        } else if (inputEl.type === 'checkbox') {
          inputEl.addEventListener('change', checkboxHandler);
        }
      }

      let resetBtn = document.querySelector('.reset-sim');
      resetBtn.addEventListener('click', (e) => {
        this._applySimConfig(DEFAULT_CFG);
      });
    }

    _renderDbgInfo () {
      let dbgDOM = document.querySelector('.dbg');
      if (this._showDbgInfo) {
        dbgDOM.style.display = 'block';
      } else {
        dbgDOM.style.display = 'none';
        return;
      }
      let i;
      let dbgInfo = '';
      DBG_INFO.frameTime = this._dt;
      for (i in DBG_INFO) {
        dbgInfo += `${i}: ${DBG_INFO[i]}\n`;
      }
      dbgDOM.textContent = dbgInfo;
    }

    async _readMieScatteringData (filename = '') {
      return fetch(filename).then(resp => resp.text())
        .then(text => {
          let ai = text.indexOf('Angle');
          let dataWithHeader = text.substring(ai, text.length);
          let nli = dataWithHeader.indexOf('\n');
          let data = dataWithHeader.substring(nli + 1, text.length);
          let dataArr = data.split('\n');
          let min = Infinity, max = -Infinity;
          let len;
          let dataRow;
          let scattR, scattG, scattB;
          let scattVals = [];
          let i;
          for (i = 0; i < dataArr.length; i++) {
            dataRow = dataArr[i].split('\t');
            if (dataRow.length < 9){
              break;
            }
            scattR = parseFloat(dataRow[1].trim());
            scattG = parseFloat(dataRow[3].trim());
            scattB = parseFloat(dataRow[5].trim());
            min = Math.min(Math.min(Math.min(min, scattR), scattG), scattB);
            max = Math.max(Math.max(Math.max(max, scattR), scattG), scattB);
            scattVals.push(scattR, scattG, scattB, 1.);
          }

          // len = max - min;

          // for (i = 0; i < scattVals.length; i += 4) {
          //   scattVals[i] -= min;
          //   scattVals[i] /= len;
          //   scattVals[i + 1] -= min;
          //   scattVals[i + 1] /= len;
          //   scattVals[i + 2] -= min;
          //   scattVals[i + 2] /= len;

          //   scattVals[i] = Math.log(scattVals[i] * 10. + 1.);
          //   scattVals[i + 1] = Math.log(scattVals[i + 1] * 10. + 1.);
          //   scattVals[i + 2] = Math.log(scattVals[i + 2] * 10. + 1.);
          // }

          return new Float32Array(scattVals);
        });
    }

    mainLoop () {
      requestAnimationFrame(this._binded.mainLoop);
      this._dt = performance.now() - this._prevTime;
      this._prevTime = performance.now();
      this._renderDbgInfo();
      this.update();
      this.render();
    }
  }

  return new MainModule();
})();

window.onload = function () {
  mainModule.init();
  //dbg
  window.mainMod = mainModule;
  //
};
