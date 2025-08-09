#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
precision highp sampler3D;
uniform float uLayer;
uniform float uLayersTotal;
uniform sampler3D uVelocityVol;
uniform float uRdx;

in vec2 vTexCoord;
out vec4 color;

float divergence (vec3 coords, sampler3D w, float rdx) {
  vec4 wL = textureOffset(w, coords, ivec3(-1, 0, 0));
  vec4 wR = textureOffset(w, coords, ivec3(1, 0, 0));
  vec4 wT = textureOffset(w, coords, ivec3(0, 1, 0));
  vec4 wB = textureOffset(w, coords, ivec3(0, -1, 0));
  vec4 wFront = textureOffset(w, coords, ivec3(0, 0, 1));
  vec4 wBack = textureOffset(w, coords, ivec3(0, 0, -1));
  return ((wR.x - wL.x) + (wT.y - wB.y) + (wFront.z - wBack.z)) * rdx;
}

void main () {
  vec3 coords = vec3(vTexCoord, uLayer / uLayersTotal);
  color = vec4(divergence(coords, uVelocityVol, uRdx));
}
