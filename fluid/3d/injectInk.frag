#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
precision highp sampler3D;
uniform float uLayer;
uniform float uLayersTotal;
uniform vec2 uWindowSize;
uniform vec2 uMouse;
uniform vec3 uInkColor;
uniform float uInkSplatSize;
uniform sampler3D uInkField;

in vec2 vTexCoord;
out vec4 ink;

vec4 injectInk (vec3 coords, float spotRadius) {
  vec3 uv = vec3(vTexCoord, uLayer / uLayersTotal);
  vec3 p = uv - coords;
  float aspect = uWindowSize.x / uWindowSize.y;
  if (aspect > 1.) {
    p.y /= aspect;
  } else {
    p.x *= aspect;
  }
  vec3 inkSplat = uInkColor * exp(-dot(p, p) / spotRadius);
  vec3 initial = textureLod(uInkField, uv, 0.).rgb;
  return vec4(initial + inkSplat, 1.);
}

void main () {
  // vec3 coords = vec3(uMouse / uWindowSize, uLayer / uLayersTotal);
  vec3 coords = vec3(uMouse / uWindowSize, .5);
  ink = injectInk(coords, uInkSplatSize);
}
