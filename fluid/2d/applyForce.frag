#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
uniform vec2 uWindowSize;
uniform vec2 uMouse;
uniform vec2 uForceDirection;
uniform float uForceMul;
uniform sampler2D uForceApplicationField;

in vec2 vTexCoord;
out vec4 color;

vec4 applyForce (vec2 coords, float forceRadius) {
  vec2 fdir = uForceDirection;
  if (length(fdir) != 0.) {
    fdir = normalize(uForceDirection);
  }
  vec2 p = vTexCoord - coords;
  float aspect = uWindowSize.x / uWindowSize.y;
  if (aspect > 1.) {
    p.y /= aspect;
  } else {
    p.x *= aspect;
  }
  vec3 force = vec3(fdir * uForceMul * exp(-dot(p, p) / forceRadius), 0.);
  vec3 initial = texture(uForceApplicationField, vTexCoord).xyz;
  return vec4(initial + force, 1.);
}

void main () {
  vec2 coords = uMouse / uWindowSize;
  color = applyForce(coords, .0001);
}
