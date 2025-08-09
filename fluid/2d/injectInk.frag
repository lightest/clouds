#version 300 es

// based on GPU gems; chapter on fluid simulation

precision highp float;
uniform vec2 uWindowSize;
uniform vec2 uMouse;
uniform vec3 uInkColor;
uniform float uInkSplatSize;
uniform sampler2D uInkField;

in vec2 vTexCoord;
out vec4 ink;

vec4 injectInk (vec2 coords, float spotRadius) {
  vec2 p = vTexCoord - coords;
  float aspect = uWindowSize.x / uWindowSize.y;
  if (aspect > 1.) {
    p.y /= aspect;
  } else {
    p.x *= aspect;
  }
  vec3 inkSplat = uInkColor * exp(-dot(p, p) / spotRadius);
  vec3 initial = texture(uInkField, vTexCoord).rgb;
  return vec4(initial + inkSplat, 1.);
}

void main () {
  vec2 coords = uMouse / uWindowSize;
  ink = injectInk(coords, uInkSplatSize);
}
