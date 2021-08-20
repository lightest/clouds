#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
precision highp sampler3D;
uniform float uT;
uniform float uTModded;
uniform float uDT;
uniform vec2 uWindowSize;
uniform vec2 uMouse;
uniform bool uDoRenderUVs;
uniform bool uDoCustomUVRender;
uniform bool uRender3DTex;
uniform sampler2D uTex;
uniform sampler3D uTex3D;

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
  // if (uDoAdvect) {
  //   float V = 1.;
  //   col = advect(vTexCoord, V, uVelocityMap, uJupiterTex);
  // } else if (uDoDiffusion) {
  //   col = jacobi(vTexCoord, uJacobiX, uJacobiB, uAlpha, uBeta);
  // } else if (uDoDivergence) {
  //   col = divergence(vTexCoord, uVelocityMap, uRdx);
  // } else if (uDoPressure) {
  //   col = jacobi(vTexCoord, uJacobiX, uJacobiB, uAlpha, uBeta);
  // } else if (uDoGradient) {
  //   col = subtractGradient(vTexCoord, uPressureMap, uVelocityMap, uRdx);
  // } else if (uDoForceApplication) {
  //   vec2 coords = uMouse / uWindowSize;
  //   col = applyForce(coords, .0001);
  if (uDoRenderUVs) {
    color = vec4(vTexCoord.x, vTexCoord.y, 0., 1.);
  } else if (uRender3DTex) {
    color = texture(uTex3D, vec3(vTexCoord.xy, 1.));
  } else {
    vec4 c = texture(uTex, vTexCoord);
    // c.xyz = pow(c.xyz, vec3(1.0/2.2));
    color = vec4(c.xyz, 1.);
    // color = vec4(vTexCoord.x, 0., 0., 1.);
  }
  // } else if (uDoCustomUVRender) {
  //   vec4 customUV = texture(uCustomUV, vTexCoord);
  //   col = texture(uJupiterTex, customUV.xy);
  // }
}
