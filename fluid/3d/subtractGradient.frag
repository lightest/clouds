#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
precision highp sampler3D;
uniform float uLayer;
uniform float uLayersTotal;
uniform float uRdx;
uniform sampler3D uVelocityMap;
uniform sampler3D uPressureMap;

in vec2 vTexCoord;
out vec4 color;

vec4 subtractGradient (vec3 coords, sampler3D p, sampler3D w, float rdx) {
  float pL = textureOffset(p, coords, ivec3(-1, 0, 0)).x;
  float pR = textureOffset(p, coords, ivec3(1, 0, 0)).x;
  float pT = textureOffset(p, coords, ivec3(0, 1, 0)).x;
  float pB = textureOffset(p, coords, ivec3(0, -1, 0)).x;
  float pFront = textureOffset(p, coords, ivec3(0, 0, 1)).x;
  float pBack = textureOffset(p, coords, ivec3(0, 0, -1)).x;
  vec4 newW = textureLod(w, coords, 0.);
  newW.xyz -= rdx * vec3(pR - pL, pT - pB, pFront - pBack);
  return newW;
}

void main () {
  vec3 uv = vec3(vTexCoord, uLayer / uLayersTotal);
  color = subtractGradient(uv, uPressureMap, uVelocityMap, uRdx);
}
