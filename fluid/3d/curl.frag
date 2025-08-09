#version 300 es

precision highp float;
precision highp sampler3D;
uniform float uLayer;
uniform float uLayersTotal;
uniform sampler3D uVelocityField;

in vec2 vTexCoord;
out vec4 color;

void main () {
  vec3 uv = vec3(vTexCoord, uLayer / uLayersTotal);
  vec3 vt = textureOffset(uVelocityField, uv, ivec3(0, 1, 0)).xyz;
  vec3 vb = textureOffset(uVelocityField, uv, ivec3(0, -1, 0)).xyz;
  vec3 vl = textureOffset(uVelocityField, uv, ivec3(-1, 0, 0)).xyz;
  vec3 vr = textureOffset(uVelocityField, uv, ivec3(1, 0, 0)).xyz;
  vec3 vFront = textureOffset(uVelocityField, uv, ivec3(0, 0, 1)).xyz;
  vec3 vBack = textureOffset(uVelocityField, uv, ivec3(0, 0, -1)).xyz;
  float curlX = (vt.z - vb.z - vFront.y + vBack.y) * .5;
  float curlY = (vFront.x - vBack.x - vr.z + vl.z) * .5;
  float curlZ = (vr.y - vl.y - vt.x + vb.x) * .5;
  color = vec4(curlX, curlY, curlZ, 1.);
}
