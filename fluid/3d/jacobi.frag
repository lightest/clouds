#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
precision highp sampler3D;
uniform float uLayer;
uniform float uLayersTotal;
uniform sampler3D uJacobiX;
uniform sampler3D uJacobiB;
uniform float uAlpha;
uniform float uBeta;

in vec2 vTexCoord;
out vec4 color;

vec4 jacobi (vec3 coords, sampler3D x, sampler3D b, float alpha, float beta) {
  vec4 xL = textureOffset(x, coords, ivec3(-1, 0, 0));
  vec4 xR = textureOffset(x, coords, ivec3(1, 0, 0));
  vec4 xT = textureOffset(x, coords, ivec3(0, 1, 0));
  vec4 xB = textureOffset(x, coords, ivec3(0, -1, 0));
  vec4 xFront = textureOffset(x, coords, ivec3(0, 0, 1));
  vec4 xBack = textureOffset(x, coords, ivec3(0, 0, -1));
  vec4 bC = textureLod(b, coords, 0.);
  return (xL + xR + xT + xB + xFront + xBack + alpha * bC) * beta;
}

void main () {
  vec3 coords = vec3(vTexCoord, uLayer / uLayersTotal);
  color = jacobi(coords, uJacobiX, uJacobiB, uAlpha, uBeta);
}
