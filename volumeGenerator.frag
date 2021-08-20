#version 300 es

precision highp float;
precision highp int;
precision highp sampler3D;

uniform sampler2D uTexToRender;
uniform sampler3D uTex;
uniform bool uRenderToLayer;
uniform uint uLayer;
uniform uint uLayersTotal;
uniform float uColMax;
uniform float uColMin;

in vec3 vTexCoord;
out vec4 color;

const float EPSILON = .095;

void main () {
  vec3 vc = vTexCoord;
  if (uRenderToLayer) {
    float h = float(uLayer) / float(uLayersTotal);
    float cStandard = (uColMax - uColMin) * h + uColMin;
    vec4 cActual = texture(uTexToRender, vTexCoord.xy);
    float avgC = (cActual.x + cActual.y + cActual.z) / 3.;
    float d = cStandard - avgC;
    if (abs(d) < EPSILON) {
      color = cActual;
      color.a = 1.;
    } else {
      if (d > 0.) {
        color = vec4(0.);
      } else {
        color = vec4(cActual.xyz - abs(d), 1.);
        // color.a = 1.;
      }
    }
    // color = vec4(1., 0., 0., 1.);
    // color = texture(uTexToRender, vTexCoord.xy);
  } else {
    // int i;
    // int l = 32;
    // float h = 0.;
    // vec4 c = vec4(0.);
    // for (i = 0; i < l; i++) {
    //   h = float(i) / float(l);
    //   vc.z = h;
    //   c += texture(uTex, vc);
    // }
    // c *= .075;
    // color = c;
    vc.z = .1;
    // vc.z = vTexCoord.x;
    color = texture(uTex, vc);
    // c.a = 1.;
    // color = texture(uTexToRender, vTexCoord.xy);
  }
  // color = vec4(vTexCoord.y, 0., 0., 1.);
}
