#version 300 es

precision highp float;
precision highp int;
precision highp sampler3D;
uniform vec2 uWindowSize;
uniform float uT;
uniform float uTModded;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform float uLightMagnitude;
uniform float uR1;
uniform float uRPlanet;
uniform float uRCloud0;
uniform float uRCloud1;
uniform int uSkyScattOctaves;
uniform vec3 uSkyRayleighScattering;
uniform vec3 uMieScattering;
uniform vec3 uMieAbsorbtion;
uniform float uMiePhaseG;
uniform float uSkyRayleighScatteringMul;
uniform float uRayleighScaleDiv;
uniform float uMieScaleDiv;
uniform float uSkyAbsorptionMul;
uniform float uSkyMarchSamples;
uniform mat4 uViewMat;
uniform sampler2D uSkyOpticalDepthToSun;
uniform float uRenderLayer;
uniform float uLastLayer;

in vec2 vTexCoord;
layout (location=0) out vec4 scatteredLightOut;
layout (location=1) out vec4 transmittanceOut;

const float PI = 3.14159265359;
const float PI2 = PI * 2.;
const float inv4PI = 1. / (4. * PI);
const float PI_OVER_180 = PI / 180.0;
const float COT_HALF_FOV = 1. / (tan((30.) * PI_OVER_180));
const vec3 PLANET_ORIGIN = vec3(0.);

// all sky related code is based on this:
// https://github.com/sebh/UnrealEngineSkyAtmosphere
const float RAYLEIGH_SCATTERING_MULTIPLIER = .03624;
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

struct LightData {
  vec3 scatteredLight;
  vec3 transmittance;
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

float isotropicPhaseFunction () {
  return inv4PI;
}

float phaseHG (float g, float cosTheta) {
  float g2 = pow(g, 2.);
  return inv4PI * ((1. - g2) / pow(1. + g2 - 2. * g * cosTheta, 1.5));
}

float rayleighPhase (float cosTheta) {
  return (3. * (cosTheta * cosTheta + 1.)) /(PI * 16.);
}

vec4 getRay () {
  float r = uWindowSize.x / uWindowSize.y;
  vec2 xy = vTexCoord - .5;
  xy.x *= r;
  float z = .5 * COT_HALF_FOV;
  vec3 ray = normalize(vec3(xy, -z));
  return vec4(ray, 0.);
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
  //uv = vec2(fromUnitToSubUvs(uv.x, TRANSMITTANCE_TEXTURE_WIDTH), fromUnitToSubUvs(uv.y, TRANSMITTANCE_TEXTURE_HEIGHT)); // No real impact so off
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

vec4 getSkyOpticalDepthToSun (vec3 worldPos, vec3 dirToLight) {
  float sampleAltitude = length(worldPos);
  vec3 upVector = worldPos / sampleAltitude;
  float sunZenithCosAngle = dot(dirToLight, upVector);
  vec2 uv;
  LutTransmittanceParamsToUv(sampleAltitude, sunZenithCosAngle, uv);
  return texture(uSkyOpticalDepthToSun, uv);
}

vec3 approximateSkyMultipleScattering (vec3 lightVal, vec3 rayleighScattering, vec3 mieScattering, float cosTheta, vec3 opticalDepthToSun, int octaves) {
  int i;
  float a = 1.;
  float b = 1.;
  float c = 1.;
  float attenuation = .35;
  float lightContribution = .53;
  float excentricityAttenuation = .7;
  vec3 approximatedMultipleScattering = vec3(0.);
  float rayleighPhaseVal;
  float miePhaseVal;
  vec3 sigmaScattering;

  for (i = 0; i < octaves; i++) {
    a *= attenuation;
    b *= lightContribution;
    c *= excentricityAttenuation;
    rayleighPhaseVal = rayleighPhase(cosTheta * c);
    miePhaseVal = phaseHG(uMiePhaseG * c, cosTheta * c);
    sigmaScattering = miePhaseVal * mieScattering + rayleighPhaseVal * rayleighScattering;
    approximatedMultipleScattering += lightVal * b * sigmaScattering * exp(-opticalDepthToSun * a);
  }

  return approximatedMultipleScattering;
}

LightData marchSkyLayer (vec3 marchOrigin, vec3 rayDir, float marchDist, float steps) {
  vec3 samplePos;
  float stepSize = marchDist / steps;
  vec3 sampleToCameraDir;
  vec3 lightVal = uLightColor * uLightMagnitude;

  float RPlanetDist;
  vec3 dirToLight = normalize(uLightPos);
  float cosTheta = dot(-dirToLight, -rayDir);
  float rayleighPhaseVal = rayleighPhase(cosTheta);
  float miePhaseVal = phaseHG(uMiePhaseG, cosTheta);

  vec3 scattering;
  vec3 scatteredLightDS;
  vec3 transmittanceDS;
  vec3 scatteredLightIntegrated = vec3(0.);
  vec3 transmittance = vec3(1.);
  vec3 sigmaScattering;
  ParticipatingMedia participatingMedia;
  vec3 opticalDepthToSun;

  // float depth = stepSize * n1rand(vTexCoord) + .001;
  float depth = .001;
  float RAYLEIGH_EXP_SCALE = 1. / uRayleighScaleDiv;
  float MIE_EXP_SCALE = 1. / uMieScaleDiv;

  while (depth < marchDist) {
    samplePos = marchOrigin + rayDir * depth;
    participatingMedia = getSkyParticipatingMedia(samplePos, RAYLEIGH_EXP_SCALE, MIE_EXP_SCALE);
    RPlanetDist = raySphereIntersect(samplePos, dirToLight, PLANET_ORIGIN, uRPlanet, false);
    if (RPlanetDist != -1.) {
      scattering = vec3(0.);
    } else {
      opticalDepthToSun = getSkyOpticalDepthToSun(samplePos, dirToLight).xyz;
      sigmaScattering = participatingMedia.mieScattering * miePhaseVal + participatingMedia.rayleighScattering * rayleighPhaseVal;
      scattering = lightVal * sigmaScattering * exp(-opticalDepthToSun);
      scattering += approximateSkyMultipleScattering(lightVal, participatingMedia.rayleighScattering, participatingMedia.mieScattering, cosTheta, opticalDepthToSun, uSkyScattOctaves);
    }
    transmittanceDS = exp(-participatingMedia.extinction * stepSize);
    scatteredLightDS = (scattering - scattering * transmittanceDS) / participatingMedia.extinction;
    scatteredLightIntegrated += transmittance * scatteredLightDS;
    transmittance *= transmittanceDS;
    depth += stepSize;
  }

  return LightData(scatteredLightIntegrated, transmittance);
}

void marchAtmosphere (vec3 cameraPos, vec3 rayDir) {
  float RPlanetDist;
  float R1Dist;
  float R1DistFar;

  float skyMarchDist = 0.;
  vec3 skyMarchOrigin = vec3(0.);
  float camDist = length(cameraPos);

  if (camDist < uRPlanet) {
    return;
  }

  R1Dist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uR1, false);
  // RPlanetDist = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uRPlanet, false);

  if (R1Dist == -1.) {
    return;
  }

  // march entire atmosphere always to avoid issues caused by low resolution (large squares on horizon)
  if (camDist < uR1) {
    skyMarchOrigin = cameraPos;
    skyMarchDist = R1Dist;
    // if (RPlanetDist == -1.) {
    //   skyMarchDist = R1Dist;
    // } else {
    //   skyMarchDist = RPlanetDist;
    // }
  } else {
    skyMarchOrigin = cameraPos + rayDir * R1Dist;
    R1DistFar = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uR1, true);
    skyMarchDist = R1DistFar - R1Dist;
    // if (RPlanetDist == -1.) {
    //   R1DistFar = raySphereIntersect(cameraPos, rayDir, PLANET_ORIGIN, uR1, true);
    //   skyMarchDist = R1DistFar - R1Dist;
    // } else {
    //   skyMarchDist = RPlanetDist - R1Dist;
    // }
  }

  float layerP = uRenderLayer / uLastLayer;

  LightData skyLayer = marchSkyLayer(skyMarchOrigin, rayDir, skyMarchDist * layerP, uSkyMarchSamples * layerP);
  scatteredLightOut = vec4(skyLayer.scatteredLight, 1.);
  transmittanceOut = vec4(skyLayer.transmittance, 1.);
}

void main () {
  vec3 cameraPos = (uViewMat[3]).xyz;
  vec3 rayDir = (uViewMat * getRay()).xyz;
  marchAtmosphere(cameraPos, rayDir);
}
