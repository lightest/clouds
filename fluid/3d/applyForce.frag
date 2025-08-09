#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
precision highp sampler3D;
uniform float uLayer;
uniform float uLayersTotal;
uniform vec2 uWindowSize;
uniform vec2 uMouse;
uniform vec2 uForceDirection;
uniform float uForceMul;
uniform float uForceSplatSize;
uniform bool uUseZv;
uniform sampler3D uForceApplicationField;

in vec2 vTexCoord;
out vec4 color;

vec4 applyForce (vec3 coords, float forceRadius) {
  vec3 fdir;
  if (uUseZv) {
    fdir = vec3(0., 0., .3);
  } else {
    fdir = vec3(uForceDirection, 0.);
  }
  vec3 uv = vec3(vTexCoord, uLayer / uLayersTotal);
  if (length(fdir) != 0.) {
    fdir = normalize(fdir);
  }
  vec3 p = uv - coords;
  float aspect = uWindowSize.x / uWindowSize.y;
  if (aspect > 1.) {
    p.y /= aspect;
  } else {
    p.x *= aspect;
  }
  vec3 force = vec3(fdir * uForceMul * exp(-dot(p, p) / forceRadius));
  vec3 initial = textureLod(uForceApplicationField, uv, 0.).xyz;
  return vec4(initial + force, 1.);
}

void main () {
  vec3 coords = vec3(uMouse / uWindowSize, .5);
  // vec3 coords = vec3(uMouse / uWindowSize, uLayer / uLayersTotal);
  color = applyForce(coords, uForceSplatSize);
}
