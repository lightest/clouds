var ShaderProgram = (function () {
  var NULL_FUNC = function () {};

  class ShaderProgram {
    constructor (params) {
      this._cbs = {
        setup: NULL_FUNC,
        update: NULL_FUNC
      };
      this.attrs = {};
      this.unifs = {};
      this.glProgram = undefined;
      this.creationPromise = this._create(params);
    }

    _compileShader (gl, src, type) {
      let info;
      let shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        info = gl.getShaderInfoLog(shader);
        console.log('Err in shader', type);
        console.log(info);
        shader = null;
      }
      return shader;
    }

    _getAttribLocations (gl, program, locations = []) {
      let i;
      let locs = {};
      for (i = 0; i < locations.length; i++) {
        locs[locations[i]] = gl.getAttribLocation(program, locations[i]);
      }
      return locs;
    }

    _getUniformLocations (gl, program, locations = []) {
      let i;
      let locs = {};
      for (i = 0; i < locations.length; i++) {
        locs[locations[i]] = gl.getUniformLocation(program, locations[i]);
      }
      return locs;
    }

    async _create (params) {
      let gl = params.gl;
      if (!params.vertPath || !params.fragPath) {
        console.error('vertPath or fragPath were not detected in params object:', params);
      }
      let texts = [
        fetch(params.vertPath).then(resp => resp.text()),
        fetch(params.fragPath).then(resp => resp.text())
      ];
      let [vertSrc, fragSrc] = await Promise.all(texts);
      let info;
      let program = gl.createProgram();
      let vertShader = this._compileShader(gl, vertSrc, gl.VERTEX_SHADER);
      let fragShader = this._compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
      if (!vertShader || !fragShader) {
        console.error('No suitable shaders. Shader files:', params.vertPath, params.fragPath);
        return null;
      }
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        info = gl.getProgramInfoLog(program);
        console.log(info);
        program = null;
      }
      this.glProgram = program;
      this.attrs = this._getAttribLocations(gl, program, params.attrs);
      this.unifs = this._getUniformLocations(gl, program, params.unifs);
      if (typeof params.setup === 'function') {
        this._cbs.setup = params.setup;
      } else {
        console.log('No shader program setup func were provided, requested shaders: %s, %s', params.vertPath, params.fragPath);
      }
      if (typeof params.update === 'function') {
        this._cbs.update = params.update;
      }
      return program;
    }

    setup (gl) {
      this._cbs.setup(gl, this);
    }

    update (gl) {
      this._cbs.update(gl, this);
    }
  }

  return ShaderProgram;
})();

export default ShaderProgram;
