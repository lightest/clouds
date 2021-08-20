#version 300 es

precision highp float;
in vec4 aPos;
in vec3 aTexCoord;
uniform mat4 uMVMat;
uniform mat4 uProjMat;

out vec3 vTexCoord;

void main () {
  vTexCoord = aTexCoord;
  gl_Position = uProjMat * uMVMat * aPos;
}
