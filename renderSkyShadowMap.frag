#version 300 es

precision highp float;
precision highp int;
precision highp sampler3D;
uniform vec2 uWindowSize;
uniform bool uSampleCloudNoise;
uniform float uT;
uniform float uTModded;
uniform float uRCloud0;
uniform float uRCloud1;
uniform float uR1;
uniform float uRSun;
uniform float uRPlanet;
uniform vec3 uLightPos;
uniform float uMarchSamples;
uniform float uSkyRayleighScatteringMul;
uniform float uRayleighScaleDiv;
uniform float uMieScaleDiv;
uniform float uSkyAbsorptionMul;
uniform vec3 uSkyRayleighScattering;
uniform vec3 uMieScattering;
uniform vec3 uMieAbsorbtion;
uniform vec3 uCloudScattering;
uniform float uCloudTexScale;
uniform float uErosionTexScale;
uniform float uErosionThreshold;
uniform float uCloudDensityMul;
uniform sampler3D uCloudTex;
uniform sampler3D uErosionTex;

in vec2 vTexCoord;
layout (location=0) out vec4 color;

const float PI = 3.14159265359;
const float PI2 = PI * 2.;
const float inv4PI = 1. / (4. * PI);
const float PI_OVER_180 = PI / 180.0;
const float COT_HALF_FOV = 1. / (tan((30.) * PI_OVER_180));
const vec3 PLANET_ORIGIN = vec3(0.);

const float RAYLEIGH_SCATTERING_MULTIPLIER = .03624;
const float MIE_SCATTERING_MULTIPLIER = .00692;
const float MIE_ABSORBTION_MULTIPLIER = .00077;
const float OZONE_ABSORBTION_LAYER_WIDTH = 25.;
const float OZONE_LINEAR_TERM0 = 1. / 15.;
const float OZONE_CONSTANT_TERM0 = -2. / 3.;
const float OZONE_LINEAR_TERM1 = -1. / 15.;
const float OZONE_CONSTANT_TERM1 = 8. / 3.;
const vec3 OZONE_ABSORBTION =  vec3(.000650, .001881, .000085);

struct ShadowMarchData {
  vec3 opticalDepth;
  vec3 nearSample;
  vec3 farSample;
};

struct ParticipatingMedia {
  vec3 rayleighScattering;
  vec3 mieScattering;
  vec3 scattering;
  vec3 extinction;
};


//note: uniformly distributed, normalized rand, [0;1[
float nrand(vec2 n) {
  return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
}

float n1rand(vec2 n) {
  float t = fract(uTModded);
  float nrnd0 = nrand(n + 0.07 * t);
  return nrnd0;
}

// - r0: ray origin
// - rd: normalized ray direction
// - s0: sphere center
// - sR: sphere radius
// - Returns distance from r0 to first intersecion with sphere,
//   or -1.0 if no intersection.
float raySphereIntersect(vec3 r0, vec3 rd, vec3 s0, float sR, bool farthest) {
  float a = dot(rd, rd);
  vec3 s0_r0 = r0 - s0;
  float b = 2.0 * dot(rd, s0_r0);
  float c = dot(s0_r0, s0_r0) - (sR * sR);
  float delta = b * b - 4.0*a*c;
  if (delta < 0.0 || a == 0.0) {
    return -1.0;
  }
  float sol0 = (-b - sqrt(delta)) / (2.0*a);
  float sol1 = (-b + sqrt(delta)) / (2.0*a);
  if (sol0 < 0.0 && sol1 < 0.0) {
    return -1.0;
  }
  if (sol0 < 0.0) {
    return max(0.0, sol1);
  } else if (sol1 < 0.0) {
    return max(0.0, sol0);
  }

  if (farthest) {
    return max(0.0, max(sol0, sol1));
  } else {
    return max(0.0, min(sol0, sol1));
  }
}

void uvToLutTransmittanceParams (out float viewHeight, out float viewZenithCosAngle, in vec2 uv) {
  float x_mu = uv.x;
  float x_r = uv.y;

  float H = sqrt(uR1 * uR1 - uRPlanet * uRPlanet);
  float rho = H * x_r;
  viewHeight = sqrt(rho * rho + uRPlanet * uRPlanet);

  float d_min = uR1 - viewHeight;
  float d_max = rho + H;
  float d = d_min + x_mu * (d_max - d_min);
  viewZenithCosAngle = d == 0.0 ? 1.0f : (H * H - rho * rho - d * d) / (2.0 * viewHeight * d);
  viewZenithCosAngle = clamp(viewZenithCosAngle, -1.0, 1.0);
}

ParticipatingMedia getSkyParticipatingMedia(const vec3 samplePos, const float RAYLEIGH_EXP_SCALE, const float MIE_EXP_SCALE) {
  float sampleAltitude = length(samplePos) - uRPlanet;
  float rayleightDensity = exp(-sampleAltitude * RAYLEIGH_EXP_SCALE);
  float mieDensity = exp(-sampleAltitude * MIE_EXP_SCALE);
  float ozoneDensity = clamp(sampleAltitude < OZONE_ABSORBTION_LAYER_WIDTH ? OZONE_LINEAR_TERM0 * sampleAltitude + OZONE_CONSTANT_TERM0 : OZONE_LINEAR_TERM1 * sampleAltitude + OZONE_CONSTANT_TERM1, 0., 1.);
  vec3 mieAbsorbtion = uMieAbsorbtion * mieDensity;
  vec3 mieScattering = uMieScattering * mieDensity;
  vec3 rayleighScattering = uSkyRayleighScattering * uSkyRayleighScatteringMul * rayleightDensity;
  vec3 ozoneAbsorbtion = OZONE_ABSORBTION * ozoneDensity * uSkyAbsorptionMul;
  vec3 sigmaScattering = mieScattering + rayleighScattering;
  vec3 sigmaAbsorption = mieAbsorbtion + ozoneAbsorbtion;
  vec3 sigmaExtinction = max(vec3(.000000001), sigmaAbsorption + sigmaScattering);

  return ParticipatingMedia(rayleighScattering, mieScattering, sigmaScattering, sigmaExtinction);
}

ShadowMarchData marchSkyLayer (vec3 marchOrigin, vec3 rayDir, float marchDist, float steps) {
  vec3 samplePos;
  vec3 nearSample;
  vec3 farSample;

  vec3 sigmaExtinction;
  vec3 opticalDepth = vec3(0.);

  float stepSize = marchDist / steps;
  // float depth = stepSize * n1rand(vTexCoord.xy) + .001;
  float depth = .001;
  float RAYLEIGH_EXP_SCALE = 1. / uRayleighScaleDiv;
  float MIE_EXP_SCALE = 1. / uMieScaleDiv;

  while (depth < marchDist) {
    samplePos = marchOrigin + rayDir * depth;
    sigmaExtinction = getSkyParticipatingMedia(samplePos, RAYLEIGH_EXP_SCALE, MIE_EXP_SCALE).extinction;
    opticalDepth += sigmaExtinction * stepSize;
    depth += stepSize;
  }

  // nearSample = marchOrigin + rayDir * marchDist;
  nearSample = marchOrigin;
  farSample = samplePos;

  return ShadowMarchData(opticalDepth, nearSample, farSample);
}

vec4 marchAtmosphere (vec3 cameraPos, vec3 rayDir) {
  float marchDist;
  float R1Dist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uR1, false);
  float RPlanetDist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRPlanet, false);

  if (R1Dist == -1.) {
    return vec4(0.);
  }

  // marchOrigin = rayDir * R1Dist + cameraPos;
  // if (RPlanetDist == -1.) {
  //   R1DistFar = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uR1, true);
  //   marchDist = R1DistFar - R1Dist;
  // } else {
  //   marchDist = RPlanetDist - R1Dist;
  // }

  if (RPlanetDist == -1.) {
    marchDist = R1Dist;
  } else {
    marchDist = min(R1Dist, RPlanetDist);
  }

  ShadowMarchData skyLayer = marchSkyLayer(cameraPos, rayDir, marchDist, uMarchSamples);
  return vec4(skyLayer.opticalDepth, 1.);
}

void main () {
  // vec3 cameraPos = normalize(uLightPos) * (uR1 + .1) + vec3(0.);
  // vec3 cameraOffset = (uShadowMapViewMat * vec4((vTexCoord * 2. - 1.) * uR1, 0., 0.)).xyz;
  // cameraPos += cameraOffset;
  // vec3 rayDir = (uShadowMapViewMat * vec4(0., 0., -1., 0.)).xyz;

  vec2 uv = vec2(vTexCoord.x, 1. - vTexCoord.y);
  uv = vTexCoord;
  float viewHeight;
  float viewZenithCosAngle;
  uvToLutTransmittanceParams(viewHeight, viewZenithCosAngle, uv);
  vec3 cameraPos = vec3(0., 0., viewHeight);
  vec3 rayDir = vec3(0., sqrt(1. - viewZenithCosAngle * viewZenithCosAngle), viewZenithCosAngle);
  color = marchAtmosphere(cameraPos, rayDir);
  // color = vec4(uv, 0., 1.);
}
