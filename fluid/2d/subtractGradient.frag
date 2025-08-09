#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
uniform float uRdx;
uniform sampler2D uVelocityMap;
uniform sampler2D uPressureMap;

in vec2 vTexCoord;
out vec4 color;

vec4 subtractGradient (vec2 coords, sampler2D p, sampler2D w, float rdx) {
  float pL = textureOffset(p, coords, ivec2(-1, 0)).x;
  float pR = textureOffset(p, coords, ivec2(1, 0)).x;
  float pT = textureOffset(p, coords, ivec2(0, 1)).x;
  float pB = textureOffset(p, coords, ivec2(0, -1)).x;
  vec4 newW = texture(w, coords);
  newW.xy -= rdx * vec2(pR - pL, pT - pB);
  return newW;
}

void main () {
  color = subtractGradient(vTexCoord, uPressureMap, uVelocityMap, uRdx);
}
