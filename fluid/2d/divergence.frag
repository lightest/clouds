#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
uniform sampler2D uTex;
uniform float uRdx;

in vec2 vTexCoord;
out vec4 color;

vec4 divergence (vec2 coords, sampler2D w, float rdx) {
  vec4 wL = textureOffset(w, coords, ivec2(-1, 0));
  vec4 wR = textureOffset(w, coords, ivec2(1, 0));
  vec4 wT = textureOffset(w, coords, ivec2(0, 1));
  vec4 wB = textureOffset(w, coords, ivec2(0, -1));
  float div = ((wR.x - wL.x) + (wT.y - wB.y)) * rdx;
  return vec4(div);
}

void main () {
  color = divergence(vTexCoord, uTex, uRdx);
}
