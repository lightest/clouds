#version 300 es

precision highp float;

uniform sampler2D uVelocityField;

in vec2 vTexCoord;
out vec4 color;

void main () {
  vec2 vt = textureOffset(uVelocityField, vTexCoord, ivec2(0, 1)).xy;
  vec2 vb = textureOffset(uVelocityField, vTexCoord, ivec2(0, -1)).xy;
  vec2 vl = textureOffset(uVelocityField, vTexCoord, ivec2(-1, 0)).xy;
  vec2 vr = textureOffset(uVelocityField, vTexCoord, ivec2(1, 0)).xy;
  float curl = (vr.y - vl.y - vt.x + vb.x) * .5;
  color = vec4(0., 0., curl, 1.);
}
