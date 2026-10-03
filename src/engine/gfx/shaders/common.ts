/** GLSL shared by several programs. */

export const NOISE = `
float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
	           mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
	float a = 0.5, s = 0.0;
	for (int i = 0; i < 5; i++) {
		s += a * vnoise(p);
		p = p * 2.03 + vec2(17.1, 9.2);
		a *= 0.5;
	}
	return s;
}
// value noise that repeats every "per" cells, for tiling textures
float tnoise(vec2 p, float per) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	vec2 i1 = mod(i + 1.0, per);
	i = mod(i, per);
	return mix(mix(hash21(i), hash21(vec2(i1.x, i.y)), f.x),
	           mix(hash21(vec2(i.x, i1.y)), hash21(i1), f.x), f.y);
}
`;

/** Shadow-map lookup with a small rotated PCF kernel. Expects uShadow / uShadowTexel. */
export const SHADOW = `
uniform highp sampler2DShadow uShadow;
uniform float uShadowTexel;
float shadowAt(vec4 sc, float radius, float bias) {
	vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
	if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
	p.z -= bias;
	float r = radius * uShadowTexel;
	float s = texture(uShadow, p);
	s += texture(uShadow, p + vec3( r * 0.94,  r * 0.34, 0.0));
	s += texture(uShadow, p + vec3(-r * 0.34,  r * 0.94, 0.0));
	s += texture(uShadow, p + vec3(-r * 0.94, -r * 0.34, 0.0));
	s += texture(uShadow, p + vec3( r * 0.34, -r * 0.94, 0.0));
	return s * 0.2;
}
`;

/** Scene lighting uniforms shared by cloth and props. */
export const LIGHTS = `
uniform vec3 uCam;
uniform vec3 uLightDir;   // toward the key light
uniform vec3 uLightCol;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec4 uSpot;       // xyz position, w > 0 when the key is a spotlight
uniform vec4 uSpotAim;    // xyz direction it points, w = cos(outer cone)
uniform vec3 uFirePos;
uniform vec4 uFireCol;    // rgb, a = intensity
vec3 keyDir(vec3 P, out float cone) {
	cone = 1.0;
	if (uSpot.w > 0.5) {
		vec3 L = normalize(uSpot.xyz - P);
		float c = dot(-L, uSpotAim.xyz);
		cone = smoothstep(uSpotAim.w, mix(uSpotAim.w, 1.0, 0.45), c);
		return L;
	}
	return uLightDir;
}
vec3 fireLight(vec3 P, vec3 N) {
	if (uFireCol.a <= 0.0) return vec3(0.0);
	vec3 d = uFirePos - P;
	float d2 = dot(d, d);
	float nl = dot(N, d) * inversesqrt(d2 + 1e-5);
	return uFireCol.rgb * uFireCol.a * (0.35 + 0.65 * clamp(nl, 0.0, 1.0)) / (1.0 + d2 * 5.0);
}
`;
