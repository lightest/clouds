#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
uniform float uDT;
uniform float uFadeFactor;
uniform vec2 uWindowSize;
uniform sampler2D uVelocityMap;
uniform sampler2D uTexToAdvect;

in vec2 vTexCoord;
out vec4 color;

vec4 advect (vec2 coords, sampler2D u, sampler2D x) {
  vec2 finalVelocityVal = texture(u, coords).xy * uDT;
  float aspect = uWindowSize.x / uWindowSize.y;
  if (aspect > 1.) {
    finalVelocityVal.x /= aspect;
  } else {
    finalVelocityVal.y *= aspect;
  }
  vec2 prevPos = coords - finalVelocityVal;
  return texture(x, prevPos) * uFadeFactor;
}

void main () {
  color = advect(vTexCoord, uVelocityMap, uTexToAdvect);
}
