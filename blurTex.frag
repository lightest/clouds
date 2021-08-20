#version 300 es

precision highp float;
uniform vec2 uWindowSize;
uniform vec2 uTexSize;
uniform float uSigma;
uniform float uBSigma;
uniform sampler2D uTex;

in vec2 vTexCoord;
out vec4 color;

#define MSIZE 32

float normpdf (in float x, in float sigma) {
  return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;
}

float normpdf3 (in vec3 v, in float sigma) {
  return 0.39894 * exp(-0.5 * dot(v, v) / (sigma * sigma)) / sigma;
}

vec4 bilateralBlur (sampler2D tex) {
  vec4 textureData = texture(tex, vTexCoord);
  vec3 c = textureData.xyz;
  int kSize = (MSIZE - 1) / 2;
  float kernel[MSIZE];
  vec3 final_colour = vec3(0.0);

  //create the 1-D kernel
  float Z = 0.0;
  for (int j = 0; j <= kSize; ++j) {
    kernel[kSize + j] = kernel[kSize - j] = normpdf(float(j), uSigma);
  }

  vec3 cc;
  float factor;
  float bZ = 1.0 / normpdf(0.0, uBSigma);

  //read out the texels
  for (int i = -kSize; i <= kSize; ++i) {
    for (int j = -kSize; j <= kSize; ++j) {
      cc = texture(tex, (gl_FragCoord.xy + vec2(float(i), float(j))) / uTexSize).rgb;
      factor = normpdf3(cc - c, uBSigma) * bZ * kernel[kSize + j] * kernel[kSize + i];
      Z += factor;
      final_colour += factor * cc;
    }
  }

  return vec4(final_colour / Z, textureData.w);
}

vec4 gaussianBlur (sampler2D tex) {
  const float offset[3] = float[](0.0, 1.3846153846, 3.2307692308);
  const float weight[3] = float[](0.2270270270, 0.3162162162, 0.0702702703);
  vec4 textureData = texture(tex, vTexCoord);
  vec4 c = vec4(textureData.xyz * weight[0], textureData.w);

  for (int i=1; i<3; i++) {
    c.xyz += texture(tex, (vec2(gl_FragCoord) + vec2(0.0, offset[i])) / uTexSize).xyz * weight[i];
    c.xyz += texture(tex, (vec2(gl_FragCoord) - vec2(0.0, offset[i])) / uTexSize).xyz * weight[i];
  }

  return c;
}

void main () {
  color = bilateralBlur(uTex);
}
