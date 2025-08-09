#version 300 es

precision highp float;

uniform float uDT;
uniform float uVorticityMul;
uniform sampler2D uVelocityField;
uniform sampler2D uCurlTex;

in vec2 vTexCoord;
out vec4 color;

void main () {
  float ct = textureOffset(uCurlTex, vTexCoord, ivec2(0, 1)).z;
  float cb = textureOffset(uCurlTex, vTexCoord, ivec2(0, -1)).z;
  float cr = textureOffset(uCurlTex, vTexCoord, ivec2(1, 0)).z;
  float cl = textureOffset(uCurlTex, vTexCoord, ivec2(-1, 0)).z;
  vec2 curlGrad = vec2(cr - cl, ct - cb) * .5;
  vec2 curlGradNorm = clamp(normalize(curlGrad), -1., 1.);
  vec4 curl = texture(uCurlTex, vTexCoord);
  vec3 vortingForce = uDT * uVorticityMul * cross(vec3(curlGradNorm, 0.), abs(curl.xyz));
  if (length(vortingForce) < .0045) {
    vortingForce = vec3(0.);
  }
  vec4 v = texture(uVelocityField, vTexCoord);
  color = vec4(v.xy + vortingForce.xy, 0., 1.);
}
