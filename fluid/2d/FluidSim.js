import ShaderProgram from '../../ShaderProgram.js';

var FluidSim = (function () {

  let SIM_TEX_N = 256;
  let VISCOSITY = .01;
  const DX = 1.;
  const DX2 = Math.pow(DX, 2);
  const RDX = 1.;
  const HALF_RDX = RDX * .5;
  const PRESSURE_ALPHA = -DX2;
  const PRESSURE_BETA = 1/4;
  let DIFFUSION_ALPHA;
  let DIFFUSION_BETA;
  let MOUSEBUTTONS = {
    LMB: 1,
    RMB: 3,
    MMB: 2
  };

  class FluidSim {
    constructor () {
      this._gl = undefined;
      this._dt = 0;
      this.timeScale = 1.;
      this.forceMagnitude = .3;
      this.inkFadeFactor = 1.;
      this.vorticityMul = 7.9;
      this._prevTime = 0;
      this._applyingForce = false;
      this._injectingInk = false;
      this._useVorticity = true;
      this.diffusionIterations = 15;
      this.pressureIterations = 33;
      this._mouse = new Float32Array([0, 0]);
      this._windowSize = new Float32Array([0, 0]);
      this._forceDirection = new Float32Array([1, 0]);
      this._inkColor = new Float32Array([1., 1., 1.]);
      this.inkSplatSize = .0001;
      this._simTexWidth = SIM_TEX_N;
      this._simTexHeight = SIM_TEX_N;

      this._simTextures = {
        uvTexture: undefined,
        swapUvTexture: undefined,
        currentVelocityTexture: undefined,
        currentPressureTexture: undefined,
        swapVelocityTexture: undefined,
        swapPressureTexture: undefined,
        divergenceTexture: undefined,
        curlTexture: undefined
      };

      this._currentProgram = undefined;
      this._programs = {};
      this._binded = {};
      this._bindMethods([
        this._handleMouse,
        this._handleMousedown,
        this._handleMouseup,
        this._setupRender2DTexProgram,
        this._setupJacobiProgram,
        this._setupFinalRenderProgram,
        this._setupCurlProgram,
        this._setupVorticityImpactProgram,
        this._setupAdvectProgram,
        this._setupJacobiProgram,
        this._setupApplyForceProgram,
        this._setupInjectInkProgram,
        this._setupDivergenceProgram,
        this._setupSubtractGradientProgram
      ]);
    }

    getInkTex () {
      return this._inkTex;
    }

    init (params) {
      this._drawingDOM = params.drawingBoard;
      this._inkTexWidth = params.inkTexWidth;
      this._inkTexHeight = params.inkTexHeight;
      let drawingBcr = this._drawingDOM.getBoundingClientRect();
      this._windowSize[0] = drawingBcr.width;
      this._windowSize[1] = drawingBcr.height;
      this._gl = params.gl;
      // this._cnv.width = document.documentElement.clientWidth;
      // this._cnv.height = document.documentElement.clientHeight;
      this._drawingDOM.addEventListener('mousemove', this._binded._handleMouse);
      this._drawingDOM.addEventListener('mousedown', this._binded._handleMousedown);
      this._drawingDOM.addEventListener('mouseup', this._binded._handleMouseup);
      this._drawingDOM.addEventListener('contextmenu', (e) => e.preventDefault());
      this._framebuffer = this._gl.createFramebuffer();
      this._inkFBO = this._gl.createFramebuffer();
      this._setupDataArrays();
      this._setupSimTextures();

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

      this._programs.slabOP_advect = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fluid/2d/advect.frag',
        gl: this._gl,
        setup: this._binded._setupAdvectProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uVelocityMap',
          'uTexToAdvect',
          'uWindowSize',
          'uDT',
          'uFadeFactor',
        ]
      });

      this._programs.slabOP_jacobi = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fluid/2d/jacobi.frag',
        gl: this._gl,
        setup: this._binded._setupJacobiProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uJacobiX',
          'uJacobiB',
          'uAlpha',
          'uBeta'
        ]
      });

      this._programs.slabOP_applyForce = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fluid/2d/applyForce.frag',
        gl: this._gl,
        setup: this._binded._setupApplyForceProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uWindowSize',
          'uMouse',
          'uForceMul',
          'uForceDirection',
          'uForceApplicationField'
        ]
      });

      this._programs.slabOP_injectInk = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fluid/2d/injectInk.frag',
        gl: this._gl,
        setup: this._binded._setupInjectInkProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uWindowSize',
          'uMouse',
          'uInkColor',
          'uInkField',
          'uInkSplatSize'
        ]
      });

      this._programs.slabOP_divergence = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fluid/2d/divergence.frag',
        gl: this._gl,
        setup: this._binded._setupDivergenceProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uTex',
          'uRdx'
        ]
      });

      this._programs.slabOP_subtractGradient = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fluid/2d/subtractGradient.frag',
        gl: this._gl,
        setup: this._binded._setupSubtractGradientProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uRdx',
          'uVelocityMap',
          'uPressureMap'
        ]
      });

      this._programs.curlDetector = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fluid/2d/curl.frag',
        gl: this._gl,
        setup: this._binded._setupCurlProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uVelocityField'
        ]
      });

      this._programs.vorticityImpact = new ShaderProgram({
        vertPath: './renderToTexture.vert',
        fragPath: './fluid/2d/applyVorticity.frag',
        gl: this._gl,
        setup: this._binded._setupVorticityImpactProgram,
        attrs: [
          'aPos',
          'aTexCoord'
        ],
        unifs: [
          'uDT',
          'uVorticityMul',
          'uVelocityField',
          'uCurlTex'
        ]
      });

      return Promise.all([
        ...Object.values(this._programs).map(program => program.creationPromise)
      ]);
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

    _handleMouse (e) {
      let bcr = e.target.getBoundingClientRect();
      let mx = e.clientX - bcr.x;
      let my = e.clientY - bcr.y;
      this._forceDirection[0] = mx - this._mouse[0];
      this._forceDirection[1] = this._windowSize[1] - my - this._mouse[1];
      this._mouse[0] = mx;
      this._mouse[1] = this._windowSize[1] - my;
    }

    _handleMousedown (e) {
      if (e.which === MOUSEBUTTONS.LMB) {
        this._applyingForce = true;
      }
      if (e.which === MOUSEBUTTONS.RMB) {
        this._injectingInk = true;
      }
    }

    _handleMouseup (e) {
      if (e.which === MOUSEBUTTONS.LMB) {
        this._applyingForce = false;
      }
      if (e.which === MOUSEBUTTONS.RMB) {
        this._injectingInk = false;
      }
    }

    _setupDataArrays () {
      this._vertices = new Float32Array([
        -1.0, -1.0, 0.,
        1.0, -1.0, 0.,
        1.0, 1.0, 0.,
        -1.0, 1.0, 0.
      ]);
      this._indices = new Uint32Array([
        0, 1, 2,
        0, 2, 3
      ]);
      this._texCoords = new Float32Array([
        0., 0.,
        1.0, 0.,
        1.0, 1.0,
        0., 1.0
      ]);

      this._verticesBuf = this._gl.createBuffer();
      this._indicesBuf = this._gl.createBuffer();
      this._texCoordsBuf = this._gl.createBuffer();

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._verticesBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._vertices, this._gl.STATIC_DRAW);

      this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._indicesBuf);
      this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, this._indices, this._gl.STATIC_DRAW);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._texCoordsBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._texCoords, this._gl.STATIC_DRAW);
    }

    _setCurrentProgram (shaderProgram) {
      this._currentProgram = shaderProgram;
      this._gl.useProgram(shaderProgram.glProgram);
      shaderProgram.setup(this._gl);
      this._gl.uniform1f(shaderProgram.unifs.uT, performance.now());
      this._gl.uniform1f(shaderProgram.unifs.uDT, this._dt * .001 * this.timeScale);
      this._gl.uniform2fv(shaderProgram.unifs.uMouse, this._mouse);
      this._gl.uniform2fv(shaderProgram.unifs.uWindowSize, this._windowSize);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._verticesBuf);
      this._gl.vertexAttribPointer(shaderProgram.attrs.aPos, 3, this._gl.FLOAT, false, 0, 0);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._texCoordsBuf);
      this._gl.vertexAttribPointer(shaderProgram.attrs.aTexCoord, 2, this._gl.FLOAT, false, 0, 0);
    }

    _setupRender2DTexProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uTex, 0);
    }

    _setupAdvectProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uVelocityMap, 0);
      gl.uniform1i(shaderProgram.unifs.uTexToAdvect, 1);
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentVelocityTexture);
    }

    _setupJacobiProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1f(shaderProgram.unifs.uAlpha, DIFFUSION_ALPHA);
      gl.uniform1f(shaderProgram.unifs.uBeta, DIFFUSION_BETA);
      gl.uniform1i(shaderProgram.unifs.uJacobiX, 0);
      gl.uniform1i(shaderProgram.unifs.uJacobiB, 1);
    }

    _setupInjectInkProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uInkField, 0);
      gl.uniform3fv(shaderProgram.unifs.uInkColor, this._inkColor);
      gl.uniform1f(shaderProgram.unifs.uInkSplatSize, this.inkSplatSize);
    }

    _setupApplyForceProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uForceApplicationField, 0);
      gl.uniform1f(shaderProgram.unifs.uForceMul, this.forceMagnitude);
    }

    _setupDivergenceProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uTex, 0);
    }

    _setupSubtractGradientProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uVelocityMap, 0);
      gl.uniform1i(shaderProgram.unifs.uPressureMap, 1);
    }

    _setupFinalRenderProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uTex, 0);
      gl.uniform1i(shaderProgram.unifs.uTex3D, 1);
    }

    _setupCurlProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uVelocityField, 0);
    }

    _setupVorticityImpactProgram (gl, shaderProgram) {
      gl.enableVertexAttribArray(shaderProgram.attrs.aPos);
      gl.enableVertexAttribArray(shaderProgram.attrs.aTexCoord);
      gl.uniform1i(shaderProgram.unifs.uVelocityField, 0);
      gl.uniform1i(shaderProgram.unifs.uCurlTex, 1);
      gl.uniform1f(shaderProgram.unifs.uVorticityMul, this.vorticityMul);
    }

    _setupSimTextures () {
      let i;
      let LOD = 0;
      let internalFormat = this._gl.RGBA32F;
      let border = 0;
      let texelFormat = this._gl.RGBA;
      let aspect = this._windowSize[0] / this._windowSize[1];
      this._simTexWidth = SIM_TEX_N;
      this._simTexHeight = SIM_TEX_N;
      if (aspect > 1) {
        this._simTexHeight = Math.floor(SIM_TEX_N / aspect);
      } else {
        this._simTexWidth = Math.floor(SIM_TEX_N * aspect);
      }
      let initialData = new Float32Array(this._simTexWidth * this._simTexHeight * 4);
      for (i = 0; i < initialData.length; i += 4) {
        initialData[i] = .0;
        initialData[i + 1] = .0;
        initialData[i + 2] = .0;
        initialData[i + 3] = 1.;
      }
      for (i in this._simTextures) {
        this._gl.deleteTexture(this._simTextures[i]);
        this._simTextures[i] = this._gl.createTexture();
        this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures[i]);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.REPEAT);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.REPEAT);
        this._gl.texImage2D(
          this._gl.TEXTURE_2D,
          LOD,
          internalFormat,
          this._simTexWidth,
          this._simTexHeight,
          border,
          texelFormat,
          this._gl.FLOAT,
          initialData
        );
      }

      this._gl.deleteTexture(this._inkTex);
      this._inkTex = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._inkTex);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.REPEAT);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.REPEAT);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        this._gl.R32F,
        this._inkTexWidth,
        this._inkTexHeight,
        border,
        this._gl.RED,
        this._gl.FLOAT,
        null
      );

      this._gl.deleteTexture(this._inkTexSwap);
      this._inkTexSwap = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._inkTexSwap);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.REPEAT);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.REPEAT);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        LOD,
        this._gl.R32F,
        this._inkTexWidth,
        this._inkTexHeight,
        border,
        this._gl.RED,
        this._gl.FLOAT,
        null
      );
    }

    _setupRenderingToBufferTexture (viewportWidth = this._simTexWidth, viewportHeight = this._simTexHeight, fbo = this._framebuffer) {
      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, fbo);
      this._gl.viewport(0, 0, viewportWidth, viewportHeight);
    }

    _swapSimTextures (f0Name, f1Name) {
      let swap = this._simTextures[f0Name];
      this._simTextures[f0Name] = this._simTextures[f1Name];
      this._simTextures[f1Name] = swap;
    }

    _swapVelocities () {
      let swap = this._simTextures.currentVelocityTexture;
      this._simTextures.currentVelocityTexture = this._simTextures.swapVelocityTexture;
      this._simTextures.swapVelocityTexture = swap;
    }

    _swapPressures () {
      let swap = this._simTextures.currentPressureTexture;
      this._simTextures.currentPressureTexture = this._simTextures.swapPressureTexture;
      this._simTextures.swapPressureTexture = swap;
    }

    _calcCurl () {
      this._setCurrentProgram(this._programs.curlDetector);
      this._setupRenderingToBufferTexture();
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentVelocityTexture);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._simTextures.curlTexture,
        0
      );
      this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
    }

    _applyVorticityImpact () {
      this._setCurrentProgram(this._programs.vorticityImpact);
      this._setupRenderingToBufferTexture();
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentVelocityTexture);
      this._gl.activeTexture(this._gl.TEXTURE1);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.curlTexture);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._simTextures.swapVelocityTexture,
        0
      );
      this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
      this._swapVelocities();
    }

    _injectInk () {
      this._setCurrentProgram(this._programs.slabOP_injectInk);
      this._setupRenderingToBufferTexture(this._inkTexWidth, this._inkTexHeight, this._inkFBO);
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._inkTex);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._inkTexSwap,
        0
      );
      this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
      let swap = this._inkTex;
      this._inkTex = this._inkTexSwap;
      this._inkTexSwap = swap;
    }

    _applyForce () {
      this._setCurrentProgram(this._programs.slabOP_applyForce);
      this._setupRenderingToBufferTexture();
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentVelocityTexture);
      this._gl.uniform2fv(this._currentProgram.unifs.uForceDirection, this._forceDirection);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._simTextures.swapVelocityTexture,
        0
      );
      this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
      this._swapVelocities();
    }

    _doAdvect (outTexture, textureToAdvect, width = SIM_TEX_N, height = SIM_TEX_N, fbo = this._framebuffer, fadeFactor = 1.) {
      this._setCurrentProgram(this._programs.slabOP_advect);
      this._setupRenderingToBufferTexture(width, height, fbo);
      this._gl.activeTexture(this._gl.TEXTURE1);
      this._gl.bindTexture(this._gl.TEXTURE_2D, textureToAdvect);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        outTexture,
        0
      );
      this._gl.uniform1f(this._currentProgram.unifs.uFadeFactor, fadeFactor);
      this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
    }

    _doDiffusion (n) {
      let i;
      this._setCurrentProgram(this._programs.slabOP_jacobi);
      this._setupRenderingToBufferTexture();
      for (i = 0; i < n; i++) {
        this._gl.activeTexture(this._gl.TEXTURE0);
        this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentVelocityTexture);
        this._gl.activeTexture(this._gl.TEXTURE1);
        this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentVelocityTexture);
        this._gl.framebufferTexture2D(
          this._gl.FRAMEBUFFER,
          this._gl.COLOR_ATTACHMENT0,
          this._gl.TEXTURE_2D,
          this._simTextures.swapVelocityTexture,
          0
        );
        this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
        this._swapVelocities();
      }
    }

    _doDivergence (outTexture) {
      this._setCurrentProgram(this._programs.slabOP_divergence);
      this._setupRenderingToBufferTexture();
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentVelocityTexture);
      this._gl.uniform1f(this._currentProgram.unifs.uRdx, HALF_RDX);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        outTexture,
        0
      );
      this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
    }

    _doPressure (n) {
      let i;
      this._setCurrentProgram(this._programs.slabOP_jacobi);
      this._setupRenderingToBufferTexture();
      this._gl.activeTexture(this._gl.TEXTURE1);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.divergenceTexture);
      this._gl.uniform1f(this._currentProgram.unifs.uAlpha, PRESSURE_ALPHA);
      this._gl.uniform1f(this._currentProgram.unifs.uBeta, PRESSURE_BETA);
      for (i = 0; i < n; i++) {
        this._gl.activeTexture(this._gl.TEXTURE0);
        this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentPressureTexture);
        this._gl.framebufferTexture2D(
          this._gl.FRAMEBUFFER,
          this._gl.COLOR_ATTACHMENT0,
          this._gl.TEXTURE_2D,
          this._simTextures.swapPressureTexture,
          0
        );
        this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
        this._swapPressures();
      }
    }

    _doPressureGradientSubtraction () {
      this._setCurrentProgram(this._programs.slabOP_subtractGradient);
      this._setupRenderingToBufferTexture();
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentVelocityTexture);
      this._gl.activeTexture(this._gl.TEXTURE1);
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._simTextures.currentPressureTexture);
      this._gl.uniform1f(this._currentProgram.unifs.uRdx, HALF_RDX);
      this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER,
        this._gl.COLOR_ATTACHMENT0,
        this._gl.TEXTURE_2D,
        this._simTextures.swapVelocityTexture,
        0
      );
      this._gl.drawElements(this._gl.TRIANGLES, this._indices.length, this._gl.UNSIGNED_INT, 0);
      this._swapVelocities();
    }

    _runSim () {
      this._doAdvect(this._simTextures.swapVelocityTexture, this._simTextures.currentVelocityTexture);
      this._swapVelocities();
      this._doDiffusion(this.diffusionIterations);
      if (this._applyingForce) {
        this._applyForce();
      }
      if (this._injectingInk) {
        this._injectInk();
      }
      this._doDivergence(this._simTextures.divergenceTexture);
      this._doPressure(this.pressureIterations);
      this._doPressureGradientSubtraction();
      if (this._useVorticity) {
        this._calcCurl();
        this._applyVorticityImpact();
      }
      this._doAdvect(this._inkTexSwap, this._inkTex, this._inkTexWidth, this._inkTexHeight, this._inkFBO, this.inkFadeFactor);
      let swap = this._inkTex;
      this._inkTex = this._inkTexSwap;
      this._inkTexSwap = swap;
    }

    update (dt) {
      this._dt = Math.min(35, dt);
      DIFFUSION_ALPHA = DX2 / (VISCOSITY * this._dt * .001 * this.timeScale);
      // DIFFUSION_ALPHA = DX2 / VISCOSITY * .016;
      DIFFUSION_BETA = 1 / (4 + DIFFUSION_ALPHA);
    }

    render () {
      this._runSim();
    }
  }

  return FluidSim;
})();

export default FluidSim;
