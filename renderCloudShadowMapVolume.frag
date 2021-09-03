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
uniform float uCloudBaseDensityStart;
uniform float uCloudTopDensityStart;
uniform float uCloudTopDensityEnd;
uniform float uR1;
uniform float uRSun;
uniform float uRPlanet;
uniform vec3 uLightPos;
uniform float uMarchSamples;
uniform float uSkyRayleighScatteringMul;
uniform float uSkyAbsorptionMul;
uniform vec3 uSkyRayleighScattering;
uniform vec3 uCloudScattering;
uniform float uWeatherTexScale;
uniform float uWindMagnitude;
uniform float uCloudTexScale;
uniform float uErosionTexScale;
uniform float uErosionThreshold;
uniform float uCloudDensityMul;
uniform float uVisibleDist;
uniform float uLocalShadowMapVisDistScale;
uniform float uGlobalShadowMapVisDistScale;
uniform mat4 uLocalShadowMapViewMat;
uniform mat4 uGlobalShadowMapViewMat;
uniform mat4 uObserverViewMat;
uniform sampler3D uCloudTex;
uniform sampler3D uErosionTex;
uniform sampler2D uWeatherTex;
uniform float uRenderLayer;
uniform float uLastLayer;

in vec2 vTexCoord;
layout (location = 0) out vec4 shadowMapOut;

const float PI = 3.14159265359;
const float PI2 = PI * 2.;
const float inv4PI = 1. / (4. * PI);
const float PI_OVER_180 = PI / 180.0;
const float COT_HALF_FOV = 1. / (tan((30.) * PI_OVER_180));
const vec3 BOX_SIZE = vec3(1., 1., 2.);
const vec3 FULL_BOX_SIZE = vec3(BOX_SIZE.xy * 2., BOX_SIZE.z);
const vec3 PLANET_ORIGIN = vec3(0.);
const float MAX_DETAILED_DIST = 1.75;
const float SCATTERING_MULTIPLIER = 100.;
const vec3 SIGMA_ABSORPTION_CONST = 0. * vec3(.067, .055, .055);

const float ATM_SCATTERING_MULTIPLIER = .03624;
const float ATM_ABSORPTION_MULTIPLIER = .00199;
const vec3 ATM_SIGMA_ABSORPTION_CONST = vec3(0.3254901960784314, 0.9450980392156862, 0.043137254901960784);

struct ParticipatingMedia {
  vec3 scattering;
  vec3 extinction;
};

struct ShadowMarchData {
  vec3 opticalDepth;
  float frontDepth;
  float backDepth;
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

float getHeightSignal (vec3 samplePos) {
  float sampleAltitude = (length(samplePos) - uRCloud0) / (uRCloud1 - uRCloud0);
  float sampleAltitudeSquard = sampleAltitude * sampleAltitude;
  return mix(smoothstep(0., uCloudBaseDensityStart, sampleAltitudeSquard), 1. - smoothstep(uCloudTopDensityStart, uCloudTopDensityEnd, sampleAltitude), sampleAltitude);
}

ParticipatingMedia getParticipatingMedia(const vec3 samplePos, const bool sampleCloudNoise) {
  vec3 sigmaScattering;
  vec3 sigmaExtinction;
  float weatherData = textureLod(uWeatherTex, (uT * uWindMagnitude * .005 + samplePos.xz) * uWeatherTexScale, 0.).x;
  // float weatherData = generateWeatherMap((samplePos.xz + uT * .00025) * uWeatherTexScale);
  float density;
  float cloudSample;
  float coverageSignal = weatherData * getHeightSignal(samplePos);
  if (coverageSignal >= uErosionThreshold) {
    if (sampleCloudNoise) {
      // textureLod(uErosionTex, pos * uErosionTexScale, 0.);
      density = coverageSignal * textureLod(uCloudTex, samplePos * uCloudTexScale, 0.).x;
      density *= step(uErosionThreshold, density);
      // if (density < uErosionThreshold) {
      //   density -= textureLod(uErosionTex, pos * uErosionTexScale, 0.).x;
      // }
    } else {
      density = coverageSignal;
    }
  }
  density = clamp(density, 0., 1.);
  sigmaScattering = uCloudDensityMul * uCloudScattering * density;
  sigmaExtinction = max(vec3(.000000001), SIGMA_ABSORPTION_CONST * density + sigmaScattering);
  return ParticipatingMedia(sigmaScattering, sigmaExtinction);
}

ShadowMarchData marchCloudLayer (vec3 marchOrigin, vec3 rayDir, const float marchDist, const float steps) {
  vec3 samplePos;
  float cloudFrontDepth = marchDist;
  float cloudBackDepth = 0.;
  vec3 opticalDepth = vec3(0.);
  ParticipatingMedia cloudMedia;

  float stepSize = min(marchDist / steps, .5);
  // float depth = stepSize * n1rand(vTexCoord) + .001;
  float depth = .001;

  while (depth < marchDist) {
    samplePos = marchOrigin + rayDir * depth;
    depth += stepSize;
    cloudMedia = getParticipatingMedia(samplePos, uSampleCloudNoise);
    if (cloudMedia.scattering == vec3(0.)) {
      continue;
    }
    cloudFrontDepth = min(depth, cloudFrontDepth);
    cloudBackDepth = max(depth, cloudBackDepth);
    opticalDepth += cloudMedia.extinction * stepSize;
  }

  if (cloudBackDepth == 0.) {
    cloudBackDepth = raySphereIntersect(marchOrigin, rayDir, PLANET_ORIGIN, uRCloud1, true);
  }

  return ShadowMarchData(opticalDepth, cloudFrontDepth, cloudBackDepth);
}

vec4 marchAtmosphere (vec3 cameraPos, vec3 rayDir) {
  float RPlanetDist = 0.;
  float RCloud0Dist = 0.;
  float RCloud1Dist = 0.;
  float RCloud0DistFar = 0.;
  float RCloud1DistFar = 0.;

  float camDist = length(cameraPos);

  vec3 marchOrigin = vec3(0.);
  float marchDist = 0.;

  // if (camDist < uRPlanet) {
  //   // return ShadowMarchData(vec3(0.), vec3(1.), vec3(0.));
  //   return vec4(0., 0., 0., 1.);
  // }

  RPlanetDist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRPlanet, false);
  RCloud0Dist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRCloud0, false);
  RCloud1Dist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRCloud1, false);

  if (RCloud1Dist == -1.) {
    return vec4(0.);
  }

  if (camDist >= uRCloud0 && camDist < uRCloud1) {
    marchOrigin = cameraPos;
    if (RCloud0Dist == -1.) {
      marchDist = RCloud1Dist;
    } else {
      marchDist = RCloud0Dist;
    }
  } else if (camDist >= uRCloud1) {
    marchOrigin = cameraPos + rayDir * RCloud1Dist;
    if (RCloud0Dist == -1.) {
      RCloud1DistFar = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRCloud1, true);
      marchDist = RCloud1DistFar - RCloud1Dist;
    } else {
      marchDist = RCloud0Dist - RCloud1Dist;
    }
  } else if (camDist >= uRPlanet && camDist < uRCloud0) {
    marchOrigin = cameraPos + rayDir * RCloud0Dist;
    if (RPlanetDist == -1.) {
      marchDist = RCloud1Dist - RCloud0Dist;
    }
  }

  float layerP = uRenderLayer / uLastLayer;
  ShadowMarchData cloudLayer = marchCloudLayer(marchOrigin, rayDir, marchDist * layerP, uMarchSamples * layerP);
  return vec4(cloudLayer.opticalDepth, cloudLayer.backDepth);
}

void main () {
  vec3 lightDir = normalize(uLightPos);
  vec3 projectorOrigin = lightDir * uRCloud1;
  vec3 observerPos = (uObserverViewMat[3]).xyz;
  vec3 cameraPos;
  vec3 cameraOffset;
  vec3 observerProjectedPos;
  vec3 projectedObserverDir;
  vec3 observerRelativeToProjector;
  float projectedObserverDist;
  float offset;
  observerRelativeToProjector = observerPos - projectorOrigin;
  observerProjectedPos = observerRelativeToProjector + lightDir * dot(observerRelativeToProjector, -lightDir);
  projectedObserverDist = length(observerProjectedPos);
  projectedObserverDir = normalize(observerProjectedPos);
  cameraPos = projectorOrigin + projectedObserverDir * min(projectedObserverDist, uRCloud1);

  offset = uVisibleDist * uGlobalShadowMapVisDistScale;
  cameraOffset = (uGlobalShadowMapViewMat * vec4((vTexCoord * 2. - 1.) * offset, 0., 0.)).xyz;
  shadowMapOut = marchAtmosphere(cameraPos + cameraOffset, -lightDir);
}
