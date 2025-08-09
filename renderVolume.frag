#version 300 es

precision highp float;
precision highp int;
precision highp sampler3D;
uniform vec2 uWindowSize;
uniform float uT;
uniform float uTModded;
uniform mat4 uViewMat;
uniform sampler3D uVol;

in vec2 vTexCoord;
layout (location=0) out vec4 color;

const float PI = 3.14159265359;
const float PI2 = PI * 2.;
const float inv4PI = 1. / (4. * PI);
const float PI_OVER_180 = PI / 180.0;
const float COT_HALF_FOV = 1. / (tan((30.) * PI_OVER_180));
const float BOX_SIZE = 50.;

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

// https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdBox (vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

// https://www.shadertoy.com/view/Ns23RK
void rayBoxIntersect (vec3 raypos, vec3 raydir, vec3 boxmin, vec3 boxmax, inout float t0, inout float t1) {
  float t1s = (boxmin.x - raypos.x) / raydir.x;
  float t2 = (boxmax.x - raypos.x) / raydir.x;
  float t3 = (boxmin.y - raypos.y) / raydir.y;
  float t4 = (boxmax.y - raypos.y) / raydir.y;
  float t5 = (boxmin.z - raypos.z) / raydir.z;
  float t6 = (boxmax.z - raypos.z) / raydir.z;

  float tmin = max(max(min(t1s, t2), min(t3, t4)), min(t5, t6));
  float tmax = min(min(max(t1s, t2), max(t3, t4)), max(t5, t6));

  // box on ray but behind ray origin
  if (tmax < 0.) {
    t0 = -1.;
    return;
  }

  // ray doesn't intersect box
  if (tmin > tmax) {
    t0 = -1.;
    return;
  }

  t0 = tmin;
  t1 = tmax;
}

LightData marchVolume (vec3 marchOrigin, vec3 rayDir, float marchDist, float steps) {
  vec3 samplePos;
  float stepSize = marchDist / steps;
  vec3 sampleToCameraDir;
  vec3 lightVal = vec3(1.);

  vec3 scattering;
  vec3 scatteredLightDS;
  vec3 transmittanceDS;
  vec3 scatteredLightIntegrated = vec3(0.);
  vec3 transmittance = vec3(1.);
  vec3 participatingMedia;

  float depth = stepSize * n1rand(vTexCoord) + .001;

  while (depth < marchDist) {
    samplePos = marchOrigin + rayDir * depth;
    participatingMedia = max(vec3(.0001), textureLod(uVol, (samplePos / BOX_SIZE) * .5 + .5, 0.).xyz);
    scattering = lightVal * participatingMedia;
    transmittanceDS = exp(-participatingMedia * stepSize);
    scatteredLightDS = (scattering - scattering * transmittanceDS) / participatingMedia;
    scatteredLightIntegrated += transmittance * scatteredLightDS;
    transmittance *= transmittanceDS;
    depth += stepSize;
  }

  return LightData(scatteredLightIntegrated, transmittance);
}

void marchV (vec3 cameraPos, vec3 rayDir) {
  float t0 = 0., t1 = 0.;
  rayBoxIntersect(cameraPos, rayDir, vec3(-BOX_SIZE), vec3(BOX_SIZE), t0, t1);
  float cameraBoxDist = sdBox(cameraPos, vec3(BOX_SIZE));
  vec3 marchOrigin;
  float marchDist;

  if (t0 == -1.) {
    color = vec4(1., 1., 1., 1.);
    return;
  }

  if (cameraBoxDist < 0.) {
    marchOrigin = cameraPos;
    marchDist = t1;
  } else {
    marchOrigin = cameraPos + rayDir * t0;
    marchDist = t1 - t0;
  }

  LightData res = marchVolume(marchOrigin, rayDir, marchDist, 50.);
  color = vec4(res.scatteredLight, 1.);
}

void main () {
  vec3 cameraPos = (uViewMat[3]).xyz;
  vec3 rayDir = (uViewMat * getRay()).xyz;
  marchV(cameraPos, rayDir);
}
