import { LIGHTS, SHADOW } from "./common";

export const CLOTH_ATTRIBS = ["aPos", "aNrm", "aUv", "aAux", "aAux2"];

export const CLOTH_VS = `
in vec3 aPos;
in vec3 aNrm;
in vec2 aUv;
in vec4 aAux;   // burn, wet, fray, heat
in vec4 aAux2;  // seam, -, -, -
uniform mat4 uVP;
uniform mat4 uLightVP;
out vec3 vPos;
out vec3 vNrm;
out vec2 vUv;
out vec4 vAux;
out float vSeam;
out vec4 vShadow;
void main() {
	vPos = aPos;
	vNrm = aNrm;
	vUv = aUv;
	vAux = aAux;
	vSeam = aAux2.x;
	vShadow = uLightVP * vec4(aPos + aNrm * 0.004, 1.0);
	gl_Position = uVP * vec4(aPos, 1.0);
}`;

/** What is left of the cloth at this fragment: shared by the colour and shadow passes. */
const DISSOLVE = `
uniform sampler2D uWeave;
uniform sampler2D uNoise;
uniform vec2 uSize;     // cloth size in metres
uniform float uTile;    // weave repeats per metre
uniform float uCutout;  // 1 for ring mail
// returns coverage 0..1; outputs burn front value and weave sample
float coverage(vec2 uv, vec4 aux, out float b, out vec4 wv, out vec2 wuv) {
	vec2 m = uv * uSize;
	wuv = m * uTile;
	wv = texture(uWeave, wuv);
	float cov = uCutout > 0.5 ? smoothstep(0.35, 0.6, wv.a) : 1.0;
	// fire eats an irregular edge: noise decides which fibres go first
	float n = texture(uNoise, m * 2.3).r * 0.62 + texture(uNoise, m * 9.0).g * 0.38;
	b = aux.x + (n - 0.5) * 0.55 * smoothstep(0.0, 0.25, aux.x);
	cov *= 1.0 - smoothstep(0.86, 0.9, b);
	// torn edges: individual threads let go, leaving a ragged fringe
	float thr = max(texture(uNoise, vec2(wuv.x * 0.11, wuv.y * 0.012)).b,
	                texture(uNoise, vec2(wuv.x * 0.012, wuv.y * 0.11)).a);
	float lim = 0.72 + 0.27 * thr;
	cov *= 1.0 - smoothstep(lim - 0.02, lim + 0.02, aux.z);
	return cov;
}
`;

export const CLOTH_FS = `
${LIGHTS}
${SHADOW}
${DISSOLVE}
in vec3 vPos;
in vec3 vNrm;
in vec2 vUv;
in vec4 vAux;
in float vSeam;
in vec4 vShadow;
uniform sampler2D uPrint;
uniform vec3 uWarp;
uniform vec3 uWeft;
uniform vec4 uMat;    // rough, spec, sheen, aniso
uniform vec4 uMat2;   // trans, metal, bump, wrinkle
uniform vec3 uSheenTint;
uniform vec3 uThread;
uniform float uA2C;
uniform float uTime;
out vec4 oCol;
const float PI = 3.14159265;

void main() {
	float b;
	vec4 wv;
	vec2 wuv;
	float cov = coverage(vUv, vAux, b, wv, wuv);
	if (cov < (uA2C > 0.5 ? 0.02 : 0.5)) discard;

	bool front = gl_FrontFacing;
	vec3 Ng = normalize(vNrm);
	if (!front) Ng = -Ng;
	vec3 V = normalize(uCam - vPos);

	// tangent frame from screen-space derivatives (u runs along the weft, v along the warp)
	vec3 dp1 = dFdx(vPos), dp2 = dFdy(vPos);
	vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
	vec3 dp2p = cross(dp2, Ng), dp1p = cross(Ng, dp1);
	vec3 T = dp2p * du1.x + dp1p * du2.x;
	vec3 B = dp2p * du1.y + dp1p * du2.y;
	float inv = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
	T *= inv; B *= inv;

	// weave relief + mid-scale wrinkles
	vec2 m = vUv * uSize;
	vec2 nm = (wv.rg - 0.5) * 2.0 * uMat2.z;
	vec4 wr = texture(uNoise, m * 1.7);
	vec4 wr2 = texture(uNoise, m * 5.3 + 0.37);
	nm += ((wr.rg - 0.5) * 1.1 + (wr2.ba - 0.5) * 0.5) * uMat2.w;
	if (!front) nm.x = -nm.x;
	vec3 N = normalize(Ng + T * nm.x + B * nm.y);

	// base colour: woven threads tinted by the print
	float mask = uCutout > 0.5 ? 0.5 : wv.a;
	vec4 pr = texture(uPrint, vUv);
	vec3 thread = mix(uWeft, uWarp, mask);
	vec3 albedo = thread * pr.rgb;
	if (!front) {
		// the reverse shows the weave more than the print
		vec3 plain = mix(uWeft, uWarp, 1.0 - mask) * mix(vec3(1.0), pr.rgb, 0.45);
		albedo = mix(plain, albedo, uMat2.x * 0.5);
	}
	float ao = 0.55 + 0.45 * wv.b;
	// slubs and uneven dye
	albedo *= 0.9 + 0.2 * wr.b;

	// loose fibres catch the light along a torn edge
	float frayE = smoothstep(0.35, 0.75, vAux.z);
	albedo = mix(albedo, uThread * 1.1, frayE * 0.45);

	// visible mending
	float seam = smoothstep(0.55, 0.95, vSeam);
	float st = step(0.55, fract((wuv.x + wuv.y) * 0.22)) * step(0.5, fract((wuv.x - wuv.y) * 0.11 + 0.25));
	albedo = mix(albedo, uThread * 0.25, seam * st * 0.9);

	// water darkens and slicks the cloth
	float wet = vAux.y;
	float rough = mix(uMat.x, uMat.x * 0.45, wet);
	float specK = uMat.y + wet * 0.45 * (1.0 - uMat2.y);
	albedo *= mix(1.0, 0.42, wet * (1.0 - uMat2.y));

	// scorch → char
	float scorch = smoothstep(0.02, 0.4, b);
	albedo = mix(albedo, albedo * vec3(0.45, 0.3, 0.2), scorch * 0.8);
	float charK = smoothstep(0.3, 0.7, b);
	albedo = mix(albedo, vec3(0.012, 0.01, 0.009), charK);
	rough = mix(rough, 1.0, charK);
	specK *= 1.0 - charK;

	// ── lighting ──
	float cone;
	vec3 L = keyDir(vPos, cone);
	float ndl = dot(N, L);
	float ndv = max(dot(N, V), 1e-3);
	float sh = shadowAt(vShadow, 1.6, 0.0016) * cone;
	float wrap = 0.3 * (1.0 - uMat2.y);
	float diff = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);
	// light arriving on the far side glows through thin cloth
	float through = clamp(-dot(Ng, L) * 0.85 + 0.15, 0.0, 1.0) * uMat2.x * (1.0 - charK) * (1.0 - wet * 0.5);

	vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
	vec3 dif = albedo * (1.0 - uMat2.y);
	vec3 col = dif * (uLightCol * (diff * sh + through * sh * 0.9) + hemi * ao);

	// specular
	vec3 H = normalize(L + V);
	float ndh = max(dot(N, H), 0.0);
	float a = max(rough * rough, 0.02);
	float a2 = a * a;
	float dd = ndh * ndh * (a2 - 1.0) + 1.0;
	float D = a2 / (PI * dd * dd);
	vec3 F0 = mix(vec3(0.04), albedo, uMat2.y);
	float fres = pow(1.0 - max(dot(H, V), 0.0), 5.0);
	vec3 F = F0 + (1.0 - F0) * fres;
	float vis = 0.25 / max(mix(ndv, 1.0, a) * mix(max(ndl, 0.0), 1.0, a), 0.05);
	vec3 spec = F * (D * vis) * specK;
	// satin: a long highlight stretched across the threads
	if (uMat.w > 0.0) {
		float th = dot(B, H);
		float tw = dot(T, H);
		float s1 = pow(max(1.0 - th * th, 0.0), 48.0);
		float s2 = pow(max(1.0 - tw * tw, 0.0), 90.0) * 0.35;
		spec += uSheenTint * (s1 + s2) * uMat.w * 0.5 * (0.4 + 0.6 * wr.b);
	}
	col += spec * uLightCol * max(ndl, 0.0) * sh * 3.0;

	// metal reads its surroundings
	if (uMat2.y > 0.0) {
		vec3 R = reflect(-V, N);
		vec3 envc = mix(uGround, uSky, smoothstep(-0.4, 0.6, R.y)) * 1.6 + uLightCol * pow(max(dot(R, L), 0.0), 18.0) * sh * 1.2;
		col += F0 * envc * uMat2.y * ao;
	}

	// sheen: fuzz lights up at grazing angles
	float grz = pow(1.0 - ndv, 3.2);
	col += uSheenTint * albedo * grz * uMat.z * (uLightCol * (0.25 + 0.75 * diff * sh) + hemi) * 1.6;

	// rim from the back light
	float rim = pow(1.0 - ndv, 2.5) * clamp(dot(N, uRimDir) * 0.5 + 0.5, 0.0, 1.0);
	col += uRimCol * rim * (albedo * 0.7 + 0.03);

	// back light glowing through thin cloth (paper screens, silk against a window)
	float throughR = clamp(-dot(Ng, uRimDir) * 0.8 + 0.2, 0.0, 1.0) * uMat2.x * (1.0 - charK);
	col += dif * uRimCol * throughR * 0.55;

	// fire nearby
	col += (dif + F0 * uMat2.y) * fireLight(vPos, N);

	// embers at the burn front, and metal glowing with heat
	float front1 = smoothstep(0.5, 0.86, b) * (1.0 - smoothstep(0.86, 0.9, b));
	float flick = 0.75 + 0.25 * sin(uTime * 23.0 + m.x * 90.0 + m.y * 70.0);
	col += vec3(3.2, 0.85, 0.12) * front1 * front1 * flick * 2.2;
	float glow = smoothstep(0.25, 0.5, b) * (1.0 - smoothstep(0.5, 0.86, b));
	col += vec3(0.9, 0.12, 0.02) * glow * 0.5 * flick;
	float heat = vAux.w * (1.0 - step(0.001, vAux.x));
	col += vec3(2.6, 0.5, 0.06) * heat * heat * heat * 1.3 * uMat2.y;

	oCol = vec4(col, uA2C > 0.5 ? cov : 1.0);
}`;

export const CLOTH_DEPTH_VS = `
in vec3 aPos;
in vec3 aNrm;
in vec2 aUv;
in vec4 aAux;
uniform mat4 uVP;
out vec2 vUv;
out vec4 vAux;
void main() {
	vUv = aUv;
	vAux = aAux;
	gl_Position = uVP * vec4(aPos, 1.0);
}`;

export const CLOTH_DEPTH_FS = `
${DISSOLVE}
in vec2 vUv;
in vec4 vAux;
void main() {
	float b;
	vec4 wv;
	vec2 wuv;
	if (coverage(vUv, vAux, b, wv, wuv) < 0.5) discard;
}`;
