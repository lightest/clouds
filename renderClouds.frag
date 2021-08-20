#version 300 es

precision highp float;
precision highp int;
precision highp sampler3D;
uniform vec2 uWindowSize;
uniform vec2 uSkyViewLUTSize;
uniform bool uSampleCloudNoise;
uniform bool uMarchCrepuscularRays;
uniform float uT;
uniform float uTModded;
uniform float uRPlanet;
uniform float uRCloud0;
uniform float uRCloud1;
uniform float uCloudBaseDensityStart;
uniform float uCloudTopDensityStart;
uniform float uCloudTopDensityEnd;
uniform float uR1;
uniform float uRSun;
uniform vec3 uLightPos;
uniform float uLightMagnitude;
uniform vec3 uLightColor;
uniform float uCloudSamples;
// when inside/above clouds, some viewrays go above uRCloud0 in the horizon and start to touch uRCloud1,
// therefore larger distances has to be marched which causes visible separation in the cloud look.
// using uCloudMarchMaxStepSize prevents abrupt difference in stepSize and hides artifacts.
// combination of dynamic and static stepSize also allows for better quality and performance controls.
uniform float uCloudMarchMaxStepSize;
uniform float uCloudShadowSamples;
uniform float uSkyMarchSamples;
uniform float uCrepuscularRaysSamples;
uniform vec3 uMieScattering;
uniform vec3 uMieAbsorbtion;
uniform float uSkyRayleighScatteringMul;
uniform float uSkyAbsorptionMul;
uniform vec3 uSkyRayleighScattering;
uniform vec3 uCloudScattering;
uniform int uCloudScattOctaves;
uniform int uSkyScattOctaves;
uniform float uWeatherTexScale;
uniform float uWindMagnitude;
uniform float uCloudTexScale;
uniform float uErosionTexScale;
uniform float uErosionThreshold;
uniform float uTemporalAlpha;
uniform float uCloudPhaseG0;
uniform float uCloudPhaseG1;
uniform float uCloudDensityMul;
uniform float uVisibleDist;
uniform mat4 uViewMat;
uniform mat4 uPrevViewMat;
uniform mat4 uProjPrevViewMatInv; // uProjMat * uPrevViewMatInv
uniform mat4 uLocalShadowMapProjViewMatInv; // uLocalShadowMapProjMat * uLocalShadowMapViewMatInv
uniform mat4 uGlobalShadowMapProjViewMatInv; // uGlobalShadowMapProjMat * uGlobalShadowMapViewMatInv
uniform sampler3D uCloudTex;
uniform sampler3D uErosionTex;
uniform sampler2D uWeatherTex;
uniform sampler2D uCrepuscularRaysBuffer;
uniform sampler2D uMilkyWay;
uniform sampler2D uMieScattCloudTex;
uniform sampler2D uMieScattAirTex;
uniform sampler2D uPrevDepthBuffer;
uniform sampler2D uPrimaryCloudLayerBuffer;
uniform sampler2D uLocalCloudShadowMapTex;
uniform sampler2D uCloudShadowMapTex;
uniform sampler2D uSkyShadowMapTex;
uniform sampler3D uSkyScatteringVol;
uniform sampler3D uSkyTransmittanceVol;
// uniform sampler3D uCloudShadowMapVol;
uniform sampler2D uSkyViewLUT;
uniform sampler2D uPrimaryCloudLayerTransmittanceBuffer;

in vec2 vTexCoord;
layout (location=0) out vec4 color;
layout (location=1) out vec4 primaryCloudLayerOut;
layout (location=2) out vec4 primaryCloudLayerTransmittanceOut;
layout (location=3) out vec4 crepuscularRaysBufferOut;

const float PI = 3.14159265359;
const float PI2 = PI * 2.;
const float inv4PI = 1. / (4. * PI);
const float PI_OVER_180 = PI / 180.0;
const float COT_HALF_FOV = 1. / (tan((30.) * PI_OVER_180));
const vec3 PLANET_ORIGIN = vec3(0.);
const vec3 SIGMA_ABSORPTION_CONST = 0. * vec3(.067, .055, .055);

const float RAYLEIGH_EXP_SCALE = 1. / 8.;
const float RAYLEIGH_SCATTERING_MULTIPLIER = .03624;
const float MIE_EXP_SCALE = 1. / 1.2;
const float MIE_SCATTERING_MULTIPLIER = .00692;
const float MIE_ABSORBTION_MULTIPLIER = .00077;
const float OZONE_ABSORBTION_LAYER_WIDTH = 25.;
const float OZONE_LINEAR_TERM0 = 1. / 15.;
const float OZONE_CONSTANT_TERM0 = -2. / 3.;
const float OZONE_LINEAR_TERM1 = -1. / 15.;
const float OZONE_CONSTANT_TERM1 = 8. / 3.;
const vec3 OZONE_ABSORBTION =  vec3(.000650, .001881, .000085);

struct ParticipatingMedia {
  vec3 rayleighScattering;
  vec3 mieScattering;
  vec3 scattering;
  vec3 extinction;
};

struct CloudMarchData {
  vec3 scatteredLight;
  vec3 transmittance;
  float relativeFrontDepth;
  vec3 nearSample;
  vec3 farSample;
};

//note: uniformly distributed, normalized rand, [0;1[
float nrand(vec2 n) {
  return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
}

float n1rand(vec2 n) {
  return nrand(0.07 * fract(uTModded) + n);
}

float isotropicPhaseFunction () {
  return inv4PI;
}

float phaseHG (float g, float cosTheta) {
  float g2 = pow(g, 2.);
  return inv4PI * ((1. - g2) / pow(1. + g2 - 2. * g * cosTheta, 1.5));
}

float dualLobePhaseHG (float cosTheta, float attenuation) {
  return mix(phaseHG(uCloudPhaseG0 * attenuation, cosTheta), phaseHG(uCloudPhaseG1 * attenuation, cosTheta), .5);
}

float rayleighPhase (float cosTheta) {
  return (3. * (cosTheta * cosTheta + 1.)) /(PI * 16.);
}

// saved for later
vec3 cloudPhase (float cosTheta, float attenuation) {
  return vec3(dualLobePhaseHG(cosTheta, attenuation));
  // vec2 texCoord = vec2(cosTheta * -.5 + .5, 1.);
  // return clamp(texture(uMieScattCloudTex, texCoord).xyz * exp(texCoord.x * 5.5) * 7500000. + dualLobePhaseHG(cosTheta, attenuation), 0., 1.);
  // return clamp(log(1. + texture(uMieScattCloudTex, texCoord).xyz * 5000000000. + dualLobePhaseHG(cosTheta, attenuation)), 0., 1.);
  // return clamp(texture(uMieScattCloudTex, texCoord).xyz * exp(texCoord.x * 5.5) * 7500000. + isotropicPhaseFunction() * uCloudPhaseG1, 0., 1.);

  // return clamp(texture(uMieScattCloudTex, texCoord).xyz * 1./texture(uMieScattCloudTex, vec2(texCoord.x * .01, texCoord.y)).xyz, 0., 1.);// + dualLobePhaseHG(cosTheta, attenuation), 0., 1.);
}

vec4 getRay () {
  float r = uWindowSize.x / uWindowSize.y;
  vec2 xy = vTexCoord - .5;
  xy.x *= r;
  float z = .5 * COT_HALF_FOV;
  vec3 ray = normalize(vec3(xy, -z));
  return vec4(ray, 0.);
}

void LutTransmittanceParamsToUv(in float viewHeight, in float viewZenithCosAngle, out vec2 uv) {
  float H = sqrt(max(0.0f, uR1 * uR1 - uRPlanet * uRPlanet));
  float rho = sqrt(max(0.0f, viewHeight * viewHeight - uRPlanet * uRPlanet));

  float discriminant = viewHeight * viewHeight * (viewZenithCosAngle * viewZenithCosAngle - 1.0) + uR1 * uR1;
  float d = max(0.0, (-viewHeight * viewZenithCosAngle + sqrt(discriminant))); // Distance to atmosphere boundary

  float d_min = uR1 - viewHeight;
  float d_max = rho + H;
  float x_mu = (d - d_min) / (d_max - d_min);
  float x_r = rho / H;

  uv = vec2(x_mu, x_r);
}

float fromUnitToSubUvs(float u, float resolution) {
  return (u + .5f / resolution) * (resolution / (resolution + 1.));
}

void SkyViewLutParamsToUv(in bool IntersectGround, in float viewZenithCosAngle, in float lightForwardCosAngle, in float viewHeight, out vec2 uv) {
  float Vhorizon = sqrt(viewHeight * viewHeight - uRPlanet * uRPlanet);
  float CosBeta = Vhorizon / viewHeight;        // GroundToHorizonCos
  float Beta = acos(CosBeta);
  float ZenithHorizonAngle = PI - Beta;

  if (!IntersectGround) {
    float coord = acos(viewZenithCosAngle) / ZenithHorizonAngle;
    coord = 1.0 - coord;
    coord = sqrt(coord);
    coord = 1.0 - coord;
    uv.y = coord * 0.5f;
  } else {
    float coord = (acos(viewZenithCosAngle) - ZenithHorizonAngle) / Beta;
    coord = sqrt(coord);
    uv.y = coord * 0.5f + 0.5f;
  }

  {
    float coord = -lightForwardCosAngle * 0.5f + 0.5f;
    coord = sqrt(coord);
    uv.x = coord;
  }

  // Constrain uvs to valid sub texel range (avoid zenith derivative issue making LUT usage visible)
  uv = vec2(fromUnitToSubUvs(uv.x, uSkyViewLUTSize.x), fromUnitToSubUvs(uv.y, uSkyViewLUTSize.y));
}

float distToCapsule (vec3 p, vec3 pa, vec3 pb, float r) {
  vec3 ab = pb - pa;
  vec3 ap = p - pa;
  float t = clamp(dot(ap, ab) / dot(ab, ab), 0., 1.);
  vec3 c = pa + t * ab;
  return length(p - c) - r;
}

// needs more work, not optimized.
float rayCapsuleIntersect (in vec3 ro, in vec3 rd, in vec3 pa, in vec3 pb, in float ra, in bool farthest) {
  vec3  ba = pb - pa;
  vec3  oa = ro - pa;
  float baba = dot(ba,ba);
  float bard = dot(ba,rd);
  float baoa = dot(ba,oa);
  float rdoa = dot(rd,oa);
  float oaoa = dot(oa,oa);
  float a = baba - bard*bard;
  float b = baba*rdoa - baoa*bard;
  float c = baba*oaoa - baoa*baoa - ra*ra*baba;
  float h = b*b - a*c;
  float t0 = -1.;
  float t1 = -1.;
  float t0c = -1.;
  float t1c = -1.;
  float y0 = 0.;
  float y1 = 0.;

  if (h >= 0.0) {
    t0 = (-b - sqrt(h)) / a;
    t1 = (-b + sqrt(h)) / a;
    y0 = baoa + t0 * bard;
    y1 = baoa + t1 * bard;
  }

  // caps external
  vec3 oc;
  if (y0 <= 0.) {
    oc = oa;
  } else if (y0 >= baba) {
    oc = ro - pb;
  }
  b = dot(rd, oc);
  c = dot(oc, oc) - ra * ra;
  h = b * b - c;
  if (h >= 0.) {
    t0c = -b - sqrt(h);
  }

  // caps internal
  // this part actually ain't correct and results in a tiny hole at the end of the cap, when looking from inside.
  // needs fix.
  oc = (y1 <= 0.) ? oa : ro - pb;
  b = dot(rd, oc);
  c = dot(oc, oc) - ra * ra;
  float hInt = b * b - c;
  if (hInt >= 0.) {
    t1c = -b + sqrt(hInt);
  }

  if (farthest) {
    if (t1 >= 0. && y1 > 0. && y1 < baba) {
      // color = vec4(1., 0., 0., 1.);
      return t1;
    }
    if (t1c >= 0.) {
      // color = vec4(1., 1., 0., 1.);
      return t1c;
    }
  } else {
    if(t0 >= 0. && y0 > 0. && y0 < baba) {
      // color = vec4(0., 0., 1., 1.);
      return t0;
    }
    if(t0c >= 0.) {
      // color = vec4(0., 1., 0., 1.);
      return t0c;
    }
    if (t1 >= 0. && y1 > 0. && y1 < baba) {
      // color = vec4(1., 0., 1., 1.);
      return t1;
    }
    if (t1c >= 0.) {
      // color = vec4(1., 1., 0., 1.);
      return t1c;
    }
  }

  // color = vec4(1., 0., 1., 1.);
  return -1.0;
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

float getHeightSignal (vec3 samplePos) {
  float sampleAltitude = clamp((length(samplePos) - uRCloud0) / (uRCloud1 - uRCloud0), 0., 1.);
  float sampleAltitudeSquard = sampleAltitude * sampleAltitude;
  return mix(smoothstep(0., uCloudBaseDensityStart, sampleAltitudeSquard), 1. - smoothstep(uCloudTopDensityStart, uCloudTopDensityEnd, sampleAltitude), sampleAltitude);
}

ParticipatingMedia getParticipatingMedia(const vec3 samplePos, const bool sampleCloudNoise) {
  vec3 sigmaScattering;
  vec3 sigmaExtinction;
  float weatherData = texture(uWeatherTex, (uT * uWindMagnitude * .005 + samplePos.xz) * uWeatherTexScale).x;
  float density;
  float cloudSample;
  float coverageSignal = weatherData * getHeightSignal(samplePos);
  if (coverageSignal >= uErosionThreshold) {
    if (sampleCloudNoise) {
      // texture(uErosionTex, pos * uErosionTexScale);
      density = coverageSignal * texture(uCloudTex, samplePos * uCloudTexScale).x;
      density *= step(uErosionThreshold, density);
      // if (density < uErosionThreshold) {
      //   density -= texture(uErosionTex, pos * uErosionTexScale).x;
      // }
    } else {
      density = coverageSignal;
    }
  }
  density = clamp(density, 0., 1.);
  sigmaScattering = uCloudDensityMul * uCloudScattering * density;
  sigmaExtinction = max(vec3(.000000001), SIGMA_ABSORPTION_CONST * density + sigmaScattering);
  return ParticipatingMedia(vec3(0.), vec3(0.), sigmaScattering, sigmaExtinction);
}

vec4 getSkyOpticalDepthToSun (vec3 worldPos, vec3 dirToLight) {
  float sampleAltitude = length(worldPos);
  vec3 upVector = worldPos / sampleAltitude;
  float sunZenithCosAngle = dot(dirToLight, upVector);
  vec2 uv;
  LutTransmittanceParamsToUv(sampleAltitude, sunZenithCosAngle, uv);
  return texture(uSkyShadowMapTex, uv);
}

vec3 getOpticalDepthToSun(vec3 from, vec3 dirToLight, const float f, const bool sampleCloudNoise) {
  float s;
  float numSteps = uCloudShadowSamples;
  float depth = 0.;
  float stepSize = 0.;
  vec3 samplePos;
  vec3 opticalDepth = vec3(0.);
  vec3 sigmaExtinction;
  float marchDist;
  float RCloud0Dist = raySphereIntersect(from, dirToLight, PLANET_ORIGIN, uRCloud0, false);
  if (RCloud0Dist >= 0.) {
    marchDist = RCloud0Dist;
  } else {
    marchDist = raySphereIntersect(from, dirToLight, PLANET_ORIGIN, uRCloud1, false);
  }
  // float maxMarchDist = 3. * (uRCloud1 - uRCloud0);
  // marchDist = min(maxMarchDist, marchDist);

  s = numSteps;
  // float f = 0.7182 * n1rand(vTexCoord) + 2.;
  while(depth < marchDist && s >= 0.) {
    stepSize = pow(f, -s) * marchDist - depth;
    s--;
    depth += stepSize;
    samplePos = dirToLight * depth + from;
    sigmaExtinction = getParticipatingMedia(samplePos, sampleCloudNoise).extinction;
    opticalDepth += sigmaExtinction * stepSize;
  }

  return opticalDepth;
}

vec3 approximateCloudMultipleScattering (vec3 lightVal, vec3 sigmaScattering, const float cosTheta, vec3 shadowPathOpticalDepth, const int octaves) {
  int i;
  float a = 1.;
  float b = 1.;
  float c = 1.;
  float attenuation = .5;
  float lightContribution = .53;
  float excentricityAttenuation = .7;
  vec3 approximatedMultipleScattering = vec3(0.);

  for (i = 0; i < octaves; i++) {
    a *= attenuation;
    b *= lightContribution;
    c *= excentricityAttenuation;
    approximatedMultipleScattering += lightVal * b * sigmaScattering * dualLobePhaseHG(cosTheta * c, c) * exp(-shadowPathOpticalDepth * a);
    // approximatedMultipleScattering += lightVal * b * sigmaScattering * cloudPhase(cosTheta * c, c) * exp(-shadowPathOpticalDepth * a);
  }

  return approximatedMultipleScattering;
}

vec3 approximateSkyShadowMultipleScattering (vec3 shadowPathOpticalDepth, int octaves) {
  int i;
  float a = 1.;
  float attenuation = .35;
  vec3 finalShadow = vec3(0.);

  for (i = 0; i < octaves; i++) {
    a *= attenuation;
    finalShadow += exp(-shadowPathOpticalDepth * a);
  }

  return finalShadow;
}

vec3 evaluateLight (vec3 origin, vec3 lightPos, vec3 lightColor) {
  vec3 L = lightPos - origin;
  vec3 lightVal = lightColor / dot(L, L);
  return lightVal;
}

vec4 mixWithReprojectedPixel (vec4 currentPixel, vec3 worldPos, vec3 farthestPos, sampler2D pixelBuf) {
  float temporalAlpha = 1.;
  vec4 bufferedPixel = vec4(0., 0., 0., 1.);
  vec4 finalVal = currentPixel;
  vec4 cameraPos = uViewMat[3];
  vec4 prevCameraPos = uPrevViewMat[3];
  vec2 uv;
  vec4 prevPos = uProjPrevViewMatInv * vec4(worldPos, 1.);
  prevPos /= prevPos.w;
  uv = prevPos.xy * .5 + .5;

  if (uv.x >= 0. && uv.x <= 1. && uv.y >= 0. && uv.y <= 1.) {
    bufferedPixel = texture(pixelBuf, uv);
    // color = vec4(uv, 0., 1.);
    if (worldPos != farthestPos) {
      temporalAlpha = uTemporalAlpha;
    } else {
      const float MAX_NO_GHOST_V = .1;
      float v = clamp(length(cameraPos - prevCameraPos), 0., MAX_NO_GHOST_V) / MAX_NO_GHOST_V;
      temporalAlpha = mix(uTemporalAlpha, 1., v);
    }
  }
  finalVal = clamp(mix(bufferedPixel, currentPixel, temporalAlpha), 0., 1.);
  // vec3 finalVal = currentPixel.xyz * temporalAlpha + bufferedPixel.xyz * (1. - temporalAlpha);
  return finalVal;
}

// saved for later, for more precise crepuscular rays
// vec4 getCloudShadowMapVolData (vec3 worldPos, vec3 lightDir) {
//   float marchDist = 0.;
//   float distToCloud0 = raySphereIntersect(worldPos, lightDir, PLANET_ORIGIN, uRCloud0, false);
//   float distToCloud1 = raySphereIntersect(worldPos, lightDir, PLANET_ORIGIN, uRCloud1, false);
//   float distToCloud1Back;
//   if (distToCloud0 != -1.) {
//     marchDist = distToCloud1 - distToCloud0;
//   } else {
//     distToCloud1Back = raySphereIntersect(worldPos, -lightDir, PLANET_ORIGIN, uRCloud1, false);
//     marchDist = distToCloud1Back + distToCloud1;
//   }
//   float z = clamp(distToCloud1 / marchDist, 0., 1.);
//   vec4 shadowMapData = vec4(0.);
//   vec2 uv;
//   vec4 pos = uGlobalShadowMapProjViewMatInv * vec4(worldPos, 1.);
//   pos /= pos.w;
//   uv = pos.xy * .5 + .5;

//   if (uv.x >= 0. && uv.x <= 1. && uv.y >= 0. && uv.y <= 1.) {
//     shadowMapData = texture(uCloudShadowMapVol, vec3(uv, z));
//     // color = vec4(uv, 0., 1.);
//   }
//   return shadowMapData;
// }

vec4 getCloudShadowMapData (vec3 worldPos) {
  vec4 shadowMapData = vec4(0.);
  vec2 uv;
  vec4 pos = uLocalShadowMapProjViewMatInv * vec4(worldPos, 1.);
  pos /= pos.w;
  uv = pos.xy * .5 + .5;

  if (uv.x >= 0. && uv.x <= 1. && uv.y >= 0. && uv.y <= 1.) {
    shadowMapData = texture(uLocalCloudShadowMapTex, uv);
    // color = vec4(uv, 0., 1.);
  } else {
    pos = uGlobalShadowMapProjViewMatInv * vec4(worldPos, 1.);
    pos /= pos.w;
    uv = pos.xy * .5 + .5;
    if (uv.x >= 0. && uv.x <= 1. && uv.y >= 0. && uv.y <= 1.) {
      shadowMapData = texture(uCloudShadowMapTex, uv);
    }
  }
  return shadowMapData;
}

void applySkyToClouds (vec3 marchOrigin, vec3 rayDir, float marchDist, inout CloudMarchData primaryCloudLayer, vec3 primaryCloudCrepRaysTerm) {
  float z;
  vec3 nearSkyScattering;
  vec3 nearSkyTransmittance;

  if (primaryCloudLayer.transmittance != vec3(1.)) {
    z = length(marchOrigin - primaryCloudLayer.nearSample) / marchDist;
    nearSkyScattering = texture(uSkyScatteringVol, vec3(vTexCoord, z)).xyz;
    nearSkyTransmittance = texture(uSkyTransmittanceVol, vec3(vTexCoord, z)).xyz;
    primaryCloudLayer.scatteredLight = primaryCloudLayer.scatteredLight * nearSkyTransmittance + nearSkyScattering * primaryCloudCrepRaysTerm;
    primaryCloudLayer.transmittance *= nearSkyTransmittance;
  }
}

vec3 marchCrepuscularRaysTerm (vec3 marchOrigin, vec3 rayDir, float marchDist, float steps, vec3 primaryCloudNearSample, out vec3 primaryCloudCrepRaysTerm) {
  float stepSize = marchDist / steps;
  float depth = n1rand(vTexCoord) * stepSize;
  vec3 nearSample = vec3(0.);
  vec3 dirToLight = normalize(uLightPos);
  vec3 samplePos;
  float distToCloud1;
  vec4 shadowMapData;
  vec4 shadowMapVolData;
  vec3 integratedAttenuation = vec3(0.);

  primaryCloudCrepRaysTerm = vec3(1.);
  if (marchDist == 0.) {
    return vec3(1.);
  }

  float primaryCloudLayerFrontDepth = length(marchOrigin - primaryCloudNearSample);
  float stepCtr = 0.;
  float primaryCloudSteps;

  while(depth < marchDist) {
    samplePos = rayDir * depth + marchOrigin;
    distToCloud1 = raySphereIntersect(samplePos, dirToLight, PLANET_ORIGIN, uRCloud1, true);
    shadowMapData = getCloudShadowMapData(samplePos);
    stepCtr++;
    // color = vec4(1., 0., 0., 1.);
    if (distToCloud1 > shadowMapData.w) {
      integratedAttenuation += exp(-shadowMapData.xyz) + approximateSkyShadowMultipleScattering(shadowMapData.xyz, uSkyScattOctaves);
    } else {
      integratedAttenuation += vec3(float(uSkyScattOctaves + 1));
    }
    if (depth <= primaryCloudLayerFrontDepth) {
      primaryCloudCrepRaysTerm = integratedAttenuation;
      primaryCloudSteps = stepCtr;
    }
    depth += stepSize;
  }

  if (primaryCloudSteps > 0.) {
    primaryCloudCrepRaysTerm = primaryCloudCrepRaysTerm / (primaryCloudSteps * float(uSkyScattOctaves + 1));
  }

  return integratedAttenuation / (steps * float(uSkyScattOctaves + 1));
}

CloudMarchData marchCloudLayer (const vec3 marchOrigin, const vec3 rayDir, const float marchDist, const float steps, const float maxStepSize) {
  float depth;
  vec3 samplePos;
  vec3 lightVal = uLightColor * uLightMagnitude;
  // vec3 lightVal = evaluateLight(samplePos, uLightPos, uLightColor);

  vec3 dirToLight = normalize(uLightPos);
  float cosTheta = dot(-dirToLight, -rayDir);
  // vec3 cloudPhaseVal = cloudPhase(cosTheta, 1.);
  float cloudPhaseVal = dualLobePhaseHG(cosTheta, 1.);
  // vec3 isotropicPhaseVal = vec3(isotropicPhaseFunction());
  float cloudDepthFromSun;

  vec3 sunDirOpticalDepth;
  vec3 scattering;
  vec3 scatteredLightDS;
  vec3 transmittanceDS;
  vec3 scatteredLightIntegrated = vec3(0.);
  vec3 transmittance = vec3(1.);

  float rndVal = n1rand(vTexCoord);
  float cloudStepSize = min(marchDist / steps, maxStepSize);
  // hides banding better, but causes slower rendering
  // cloudStepSize += cloudStepSize * .5 * rndVal;
  depth = cloudStepSize * rndVal + .001;
  // depth = .001;
  vec4 shadowMapData;
  float distToCloud1;
  float distToCloud0;
  vec3 opticalDepthFromShadowMap;
  float RPlanetDist;
  float cloudFrontDepth = marchDist;
  vec3 farSample;
  vec3 skyOpticalDepth;
  ParticipatingMedia cloudMedia;
  // much smoother shadows in clouds. Reveals banding when using dynamic (march dist based) stepSize
  // float shadowRayStepSizeBase = 0.7182 * rndVal + 2.;
  float shadowRayStepSizeBase = 1.1182 * rndVal + 1.6;

  while (depth < marchDist) {
    samplePos = rayDir * depth + marchOrigin;
    depth += cloudStepSize;
    cloudMedia = getParticipatingMedia(samplePos, uSampleCloudNoise);
    if (cloudMedia.scattering == vec3(0.)) {
      continue;
    }
    farSample = samplePos;
    cloudFrontDepth = min(cloudFrontDepth, depth);
    RPlanetDist = raySphereIntersect(samplePos, dirToLight, PLANET_ORIGIN, uRPlanet, false);
    if (RPlanetDist != -1.) {
      scattering = vec3(0.);
    } else {
      distToCloud1 = raySphereIntersect(samplePos, dirToLight, PLANET_ORIGIN, uRCloud1, false);
      distToCloud0 = raySphereIntersect(samplePos, -dirToLight, PLANET_ORIGIN, uRCloud0, false);
      // shadowMapData = getCloudShadowMapData(samplePos);
      opticalDepthFromShadowMap = vec3(0.);
      // cloudDepthFromSun = clamp((distToCloud1 - .1) / shadowMapData.w, 0., 1.);
      // cloudPhaseVal = mix(cloudPhaseValMieHG, isotropicPhaseVal, cloudDepthFromSun);
      // only to render distant shadows
      if (distToCloud0 == -1. && distToCloud1 > shadowMapData.w) {
        // color = vec4(1., 0., 0., 1.);
        // opticalDepthFromShadowMap = shadowMapData.xyz;
        shadowMapData = getCloudShadowMapData(samplePos);
        opticalDepthFromShadowMap = min(shadowMapData.xyz, shadowMapData.xyz * max(0., distToCloud1 - shadowMapData.w));
      }
      skyOpticalDepth = getSkyOpticalDepthToSun(samplePos, dirToLight).xyz;
      sunDirOpticalDepth = getOpticalDepthToSun(samplePos, dirToLight, shadowRayStepSizeBase, uSampleCloudNoise) + opticalDepthFromShadowMap + skyOpticalDepth;
      scattering = lightVal * cloudMedia.scattering * cloudPhaseVal * exp(-sunDirOpticalDepth);
      scattering += approximateCloudMultipleScattering(lightVal, cloudMedia.scattering, cosTheta, sunDirOpticalDepth, uCloudScattOctaves);
    }
    transmittanceDS = exp(-cloudMedia.extinction * cloudStepSize);
    scatteredLightDS = (scattering - scattering * transmittanceDS) / cloudMedia.extinction;
    scatteredLightIntegrated += transmittance * scatteredLightDS;
    transmittance *= transmittanceDS;
    if (all(lessThan(transmittance, vec3(.01)))) {
      break;
    }
  }

  return CloudMarchData(scatteredLightIntegrated, transmittance, cloudFrontDepth, marchOrigin + rayDir * cloudFrontDepth, farSample);
}

vec4 marchAtmosphere (vec3 cameraPos, vec3 rayDir) {
  float RSunDist;
  float RPlanetDist;
  float R1Dist;
  float R1DistFar;

  float RCloud0Dist;
  float RCloud1Dist;
  float RCloud1DistFar;

  float camDist = length(cameraPos);

  vec3 cloudMarchOrigin;
  float cloudMarchDist = 0.;

  float skyMarchDist = 0.;
  vec3 skyMarchOrigin;
  vec3 crepRaysMarchOrigin;
  float crepRaysMarchDist;
  vec3 crepuscularRaysTerm = vec3(1.);
  vec3 primaryCloudCrepTerm = vec3(1.);

  if (camDist < uRPlanet) {
    return vec4(0., 0., 0., 1.);
  }

  RSunDist = raySphereIntersect(cameraPos, rayDir, uLightPos, uRSun, false);
  R1Dist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uR1, false);
  RPlanetDist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRPlanet, false);

  if (RSunDist != -1. && RSunDist < R1Dist) {
    return vec4(uLightColor, 1.);
  }

  RCloud0Dist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRCloud0, false);
  RCloud1Dist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRCloud1, false);

  if (R1Dist == -1.) {
    if (RSunDist != -1.) {
      return vec4(uLightColor, 1.);
    }
    // return vec4(0., 0., 0., 1.);
  }

  // same as in renderSkyVolume.frag
  if (camDist < uR1) {
    skyMarchOrigin = cameraPos;
    skyMarchDist = R1Dist;
  } else {
    skyMarchOrigin = cameraPos + rayDir * R1Dist;
    R1DistFar = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uR1, true);
    skyMarchDist = R1DistFar - R1Dist;
  }

  if (camDist >= uRCloud0 && camDist < uRCloud1) {
    cloudMarchOrigin = cameraPos;
    if (RPlanetDist != -1.) {
      cloudMarchDist = RCloud0Dist;
    } else {
      cloudMarchDist = RCloud1Dist;
    }
  } else if (camDist >= uRCloud1) {
    cloudMarchOrigin = cameraPos + rayDir * RCloud1Dist;
    if (RPlanetDist != -1.) {
      cloudMarchDist = RCloud0Dist - RCloud1Dist;
    } else {
      RCloud1DistFar = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRCloud1, true);
      cloudMarchDist = RCloud1DistFar - RCloud1Dist;
    }
  } else if (camDist >= uRPlanet && camDist < uRCloud0) {
    cloudMarchOrigin = cameraPos + rayDir * RCloud0Dist;
    if (RPlanetDist == -1.) {
      cloudMarchDist = RCloud1Dist - RCloud0Dist;
    }
  }

  // there was an attempt to solve ghosting on far cloud layer when above uRCloud0 using 2 cloud layers.
  // it resulted in a different issue where two layers of cloud connect together with a seam resulted from reprojection.
  // when new pixels appear from the edge of the layer they appear darker in first few frames thus causing visible separation.
  CloudMarchData primaryCloudLayer = marchCloudLayer(cloudMarchOrigin, rayDir, cloudMarchDist, uCloudSamples, uCloudMarchMaxStepSize);
  // CloudMarchData secondaryCloudLayer = marchCloudLayer(secondaryCloudMarchOrigin, rayDir, secondaryCloudMarchDist, uCloudSamples, uCloudMarchMaxStepSize);

  vec4 skyViewLUTData;
  vec2 uv;
  vec3 dirToLight = normalize(uLightPos);
  vec3 UpVector = normalize(cameraPos);
  float viewZenithCosAngle = dot(rayDir, UpVector);
  vec3 sideVector = normalize(cross(UpVector, rayDir));
  vec3 forwardVector = normalize(cross(sideVector, UpVector));
  vec2 lightOnPlane = normalize(vec2(dot(dirToLight, forwardVector), dot(dirToLight, sideVector)));
  float lightForwardCosAngle = lightOnPlane.x;
  bool intersectGround = RPlanetDist >= 0.;
  SkyViewLutParamsToUv(intersectGround, viewZenithCosAngle, lightForwardCosAngle, camDist, uv);
  skyViewLUTData = texture(uSkyViewLUT, uv);
  vec3 skyLayerScatteredLight = skyViewLUTData.xyz;

  if (uMarchCrepuscularRays) {
    float RCloud1CapsuleDist = distToCapsule(cameraPos, PLANET_ORIGIN, PLANET_ORIGIN - dirToLight * uR1, uRCloud1);
    float RCloud1CapsuleIntersectNear = rayCapsuleIntersect(cameraPos, rayDir, PLANET_ORIGIN, PLANET_ORIGIN - dirToLight * uR1, uRCloud1, false);
    float RCloud1CapsuleIntersectFar;
    if (RCloud1CapsuleDist < 0.) {
      crepRaysMarchOrigin = cameraPos;
      if (RPlanetDist == -1.) {
        crepRaysMarchDist = RCloud1CapsuleIntersectNear;
      } else {
        crepRaysMarchDist = RPlanetDist;
      }
    } else {
      crepRaysMarchOrigin = cameraPos + rayDir * RCloud1CapsuleIntersectNear;
      if (RPlanetDist == -1.) {
        RCloud1CapsuleIntersectFar = rayCapsuleIntersect(cameraPos, rayDir, PLANET_ORIGIN, PLANET_ORIGIN - dirToLight * uR1, uRCloud1, true);
        crepRaysMarchDist = RCloud1CapsuleIntersectFar - RCloud1CapsuleIntersectNear;
      } else {
        crepRaysMarchDist = RPlanetDist - RCloud1CapsuleIntersectNear;
      }
    }

    crepRaysMarchDist = max(0., crepRaysMarchDist);
    // not accurate waay to calculate crepuscular rays, they should be a part of sky color calculation,
    // however since we use low res sky LUTs, their quality becomes limited by LUT resolution.
    // marching crepuscular rays with the same resolution as clouds makes the whole thing fit together better.
    crepuscularRaysTerm = marchCrepuscularRaysTerm(crepRaysMarchOrigin, rayDir, crepRaysMarchDist, uCrepuscularRaysSamples, primaryCloudLayer.nearSample, primaryCloudCrepTerm);
    if (crepRaysMarchDist > 0.) {
      // since sky is rendered as is, with no reprojection - reprojecting crep rays to reduce noise and increase quality.
      // also using same approach to mitigate ghosting on passing through cloud layer boundaries as with clouds (see below).
      float reprojectionDist = max(crepRaysMarchDist, 15.);
      crepuscularRaysTerm = mixWithReprojectedPixel(vec4(crepuscularRaysTerm, 1.), rayDir * reprojectionDist + crepRaysMarchOrigin, rayDir * reprojectionDist + crepRaysMarchOrigin, uCrepuscularRaysBuffer).xyz;
    }
    skyLayerScatteredLight *= crepuscularRaysTerm;
    crepuscularRaysBufferOut = vec4(crepuscularRaysTerm, 1.);
  } else {
    crepuscularRaysBufferOut = vec4(vec3(0.), 1.);
  }

  applySkyToClouds(skyMarchOrigin, rayDir, skyMarchDist, primaryCloudLayer, primaryCloudCrepTerm);
  vec4 finalPrimaryCloudLayerScattering = vec4(0.);
  vec4 finalPrimaryCloudLayerTransmittance = vec4(1.);

  if (cloudMarchDist > 0.) {
    float reprojectionFrontDepth;
    vec3 reprojectionNearSample = primaryCloudLayer.nearSample;
    vec3 primaryLayerFarthestPos = rayDir * cloudMarchDist + cloudMarchOrigin;
    // when rising above uRCloud0, it's surface becomes very close to the camera.
    // that causes ghosting on horizon due to strong parallax between uRCloud0 depth
    // and far clouds. Choose arbitrary depth that is further away to avoid noticable ghosting.
    if (camDist > uRCloud0 && camDist < uRCloud1 && primaryCloudLayer.transmittance == vec3(1.)) {
      reprojectionFrontDepth = max(primaryCloudLayer.relativeFrontDepth, 15.);
      reprojectionNearSample = rayDir * reprojectionFrontDepth + cloudMarchOrigin;
      primaryLayerFarthestPos = reprojectionNearSample;
    }
    finalPrimaryCloudLayerScattering = mixWithReprojectedPixel(vec4(primaryCloudLayer.scatteredLight, 1.), reprojectionNearSample, primaryLayerFarthestPos, uPrimaryCloudLayerBuffer);
    finalPrimaryCloudLayerTransmittance = mixWithReprojectedPixel(vec4(primaryCloudLayer.transmittance, 1.), reprojectionNearSample, primaryLayerFarthestPos, uPrimaryCloudLayerTransmittanceBuffer);
  }

  primaryCloudLayerOut = finalPrimaryCloudLayerScattering;
  primaryCloudLayerTransmittanceOut = finalPrimaryCloudLayerTransmittance;

  vec3 finalColor = skyLayerScatteredLight * finalPrimaryCloudLayerTransmittance.xyz + finalPrimaryCloudLayerScattering.xyz;

  if (RSunDist != -1. && RPlanetDist == -1.) {
    finalColor += uLightColor * finalPrimaryCloudLayerTransmittance.xyz * texture(uSkyTransmittanceVol, vec3(vTexCoord, 1.)).xyz;
  }

  return vec4(finalColor, 1.);
}

void main () {
  vec3 cameraPos = (uViewMat[3]).xyz;
  vec3 rayDir = (uViewMat * getRay()).xyz;
  color += marchAtmosphere(cameraPos, rayDir);

  // float RSpaceDist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uR1 * 1000., false);
  // vec3 mwCoords = vec3(cameraPos + rayDir * RSpaceDist) * .00009;

  // for debug purposes
  vec2 uv;
  // if (vTexCoord.x < .25 && vTexCoord.y < .25) {
  //   // color = texture(uLocalCloudShadowMapTex, vTexCoord / .25);
  //   uv = vec2(vTexCoord / .25);
  //   // color = texture(uSkyScatteringVol, vec3(uv, .05));
  //   // color = texture(uWeatherTex, uv);
  //   color = texture(uCloudShadowMapTex, vTexCoord / .25);
  //   // color = texture(uSkyShadowMapVol, vec3(vTexCoord / .25, .9));
  // }
  // if (vTexCoord.x >= .25 && vTexCoord.x < .25 * 2. && vTexCoord.y < .25) {
  //   // color = texture(uPrimaryCloudLayerBuffer, vTexCoord / .25);
  //   uv = vec2((vTexCoord.x - .25) / .25, vTexCoord.y / .25);
  //   // color = texture(uSkyScatteringVol, vec3(uv, 1.));
  //   // color = texture(uCloudShadowMapVol, vec3(uv, 1.));
  // }
  // if (vTexCoord.x >= .25  * 2. && vTexCoord.x < .25 * 3. && vTexCoord.y < .25) {
  //   uv = vec2((vTexCoord.x - .5) / .25, vTexCoord.y / .25);
  //   color = texture(uSkyViewLUT, uv);
  // }
  // if (vTexCoord.x < .25 && vTexCoord.y > .25 && vTexCoord.y < .25 * 2.) {
  //   uv = vec2(vTexCoord.x / .25, (vTexCoord.y - .25) / .25);
  //   color = texture(uPrimaryCloudLayerBuffer, uv);
  // }
  // if (vTexCoord.x > .25 && vTexCoord.x < .25 * 2. && vTexCoord.y > .25 && vTexCoord.y < .25 * 2.) {
  //   uv = vec2((vTexCoord.x - .25) / .25, (vTexCoord.y - .25) / .25);
  //   color = texture(uCrepuscularRaysBuffer, uv);
  // }
}
