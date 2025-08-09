#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
uniform sampler2D uJacobiX;
uniform sampler2D uJacobiB;
uniform float uAlpha;
uniform float uBeta;

in vec2 vTexCoord;
out vec4 color;

vec4 jacobi (vec2 coords, sampler2D x, sampler2D b, float alpha, float beta) {
  vec4 xL = textureOffset(x, coords, ivec2(-1, 0));
  vec4 xR = textureOffset(x, coords, ivec2(1, 0));
  vec4 xT = textureOffset(x, coords, ivec2(0, 1));
  vec4 xB = textureOffset(x, coords, ivec2(0, -1));
  vec4 bC = texture(b, coords);
  return (xL + xR + xT + xB + alpha * bC) * beta;
}

void main () {
  color = jacobi(vTexCoord, uJacobiX, uJacobiB, uAlpha, uBeta);
}
