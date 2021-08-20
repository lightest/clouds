#version 300 es

precision highp float;
in vec4 aPos;
in vec2 aTexCoord;

out vec2 vTexCoord;

void main () {
  vTexCoord = aTexCoord;
  gl_Position = aPos;
}
