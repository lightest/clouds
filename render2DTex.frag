#version 300 es

precision highp float;
uniform float uT;
uniform float uTModded;
uniform float uDT;
uniform vec2 uWindowSize;
uniform vec2 uMouse;
uniform sampler2D uTex;

in vec2 vTexCoord;
out vec4 color;

//note: uniformly distributed, normalized rand, [0;1[
float nrand(vec2 n) {
  return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
}

float n1rand(vec2 n) {
  float t = fract(uTModded);
  float nrnd0 = nrand(n + 0.07 * t);
  return nrnd0;
}

void main () {
  // vec4 c = texture(uTex, vTexCoord);
  // c.xyz += n1rand(vTexCoord);
  // vec4 v = texture(uTex, vTexCoord);
  // vec4 c = v * 1./texture(uTex, vec2(vTexCoord.x * .25, vTexCoord.y)) * 1.;
  // vec4 c = v * exp(vTexCoord.x * 7.5) * 100000000.;
  // c.xyz = pow(c.xyz, vec3(1.0/2.2));
  color = texture(uTex, vTexCoord);
}
