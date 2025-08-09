#version 300 es

precision highp float;
precision highp sampler3D;
uniform float uLayer;
uniform float uLayersTotal;
uniform float uDT;
uniform float uVorticityMul;
uniform sampler3D uVelocityField;
uniform sampler3D uCurlTex;

in vec2 vTexCoord;
out vec4 color;

void main () {
  vec3 uv = vec3(vTexCoord, uLayer / uLayersTotal);
  float cr = length(textureOffset(uCurlTex, uv, ivec3(1, 0, 0)).xyz);
  float cl = length(textureOffset(uCurlTex, uv, ivec3(-1, 0, 0)).xyz);
  float ct = length(textureOffset(uCurlTex, uv, ivec3(0, 1, 0)).xyz);
  float cb = length(textureOffset(uCurlTex, uv, ivec3(0, -1, 0)).xyz);
  float cFront = length(textureOffset(uCurlTex, uv, ivec3(0, 0, 1)).xyz);
  float cBack = length(textureOffset(uCurlTex, uv, ivec3(0, 0, -1)).xyz);
  vec3 curl = textureLod(uCurlTex, uv, 0.).xyz;
  vec3 curlLenGrad = vec3(cr - cl, ct - cb, cFront - cBack) * .5;
  vec3 curlLenGradNormalized = clamp(normalize(curlLenGrad), -1., 1.);
  vec3 vortingForce = uDT * uVorticityMul * cross(curlLenGradNormalized, curl);
  vortingForce *= step(.0045, length(vortingForce));
  vec3 v = texture(uVelocityField, uv).xyz;
  color = vec4(v + vortingForce, 1.);
}
