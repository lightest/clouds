#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
precision highp sampler3D;
uniform float uDT;
uniform float uFadeFactor;
uniform float uLayer;
uniform float uLayersTotal;
uniform vec2 uWindowSize;
uniform sampler3D uVelocityMap;
uniform sampler3D uTexToAdvect;

in vec2 vTexCoord;
out vec4 color;

vec4 advect (vec3 coords, sampler3D u, sampler3D x) {
  vec3 v = textureLod(u, coords, 0.).xyz * uDT;
  float aspect = uWindowSize.x / uWindowSize.y;
  if (aspect > 1.) {
    v.x /= aspect;
  } else {
    v.y *= aspect;
  }
  vec3 prevPos = coords - v;
  return textureLod(x, prevPos, 0.) * uFadeFactor;
}

void main () {
  vec3 coords = vec3(vTexCoord, uLayer / uLayersTotal);
  color = advect(coords, uVelocityMap, uTexToAdvect);
}
