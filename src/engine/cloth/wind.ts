/** Wind field: a steady breeze, rolling gusts, small-scale turbulence and a hand-held blower. */
export class Wind {
	/** base wind velocity (m/s) */
	bx = 0;
	by = 0;
	bz = 0;
	/** 0..1 how much the breeze swells and fades */
	gust = 0.5;
	/** m/s of small-scale turbulence */
	turb = 0.4;
	time = 0;

	/** local jet from the blower tool */
	jetOn = false;
	jx = 0;
	jy = 0;
	jz = 0;
	jdx = 0;
	jdy = 0;
	jdz = -1;
	jetPower = 0;
	jetRadius = 0.35;

	private gustNow = 1;

	set(bx: number, by: number, bz: number, gust: number, turb: number) {
		this.bx = bx;
		this.by = by;
		this.bz = bz;
		this.gust = gust;
		this.turb = turb;
	}

	get speed() {
		return Math.hypot(this.bx, this.by, this.bz) * this.gustNow;
	}

	update(dt: number) {
		this.time += dt;
		const t = this.time;
		// layered slow sines → a breeze that breathes, with the odd strong gust
		const s =
			0.5 +
			0.28 * Math.sin(t * 0.61) +
			0.17 * Math.sin(t * 1.37 + 1.3) +
			0.12 * Math.sin(t * 2.9 + 4.1);
		const peak = Math.max(0, Math.sin(t * 0.23 + 2)) ** 6;
		this.gustNow = 1 - this.gust + this.gust * (s * 1.3 + peak * 1.4);
	}

	/** The breeze at a point, without the blower. Writes into out[0..2]. */
	base(x: number, y: number, z: number, out: Float32Array) {
		const t = this.time;
		const g = this.gustNow;
		// travelling ripples so the gust front visibly sweeps across the cloth
		const ph = x * 2.1 - t * 2.6;
		const rip = 1 + 0.35 * Math.sin(ph + y * 1.3) * this.gust;
		let wx = this.bx * g * rip;
		let wy = this.by * g * rip;
		let wz = this.bz * g * rip;
		const tb = this.turb * (0.4 + g);
		if (tb > 0) {
			wx += tb * Math.sin(y * 4.3 + t * 1.9 + z * 3.1) * Math.cos(x * 2.7 - t * 1.3);
			wy += tb * 0.5 * Math.sin(x * 3.9 - t * 2.3 + z * 2.0);
			wz += tb * Math.cos(x * 3.3 + t * 1.7) * Math.sin(y * 3.7 - t * 2.1);
		}
		out[0] = wx;
		out[1] = wy;
		out[2] = wz;
	}

	/** The jet from the blower at a point (zero outside its cone). Writes into out[0..2]. */
	jet(x: number, y: number, z: number, out: Float32Array) {
		out[0] = out[1] = out[2] = 0;
		if (!this.jetOn) return;
		const px = x - this.jx,
			py = y - this.jy,
			pz = z - this.jz;
		const along = px * this.jdx + py * this.jdy + pz * this.jdz;
		if (along < -0.05) return;
		const rx = px - this.jdx * along,
			ry = py - this.jdy * along,
			rz = pz - this.jdz * along;
		const r2 = rx * rx + ry * ry + rz * rz;
		const R = this.jetRadius * (1 + along * 0.6);
		if (r2 >= R * R) return;
		const f = 1 - r2 / (R * R);
		const p = this.jetPower * f * f;
		out[0] = this.jdx * p;
		out[1] = this.jdy * p;
		out[2] = this.jdz * p;
	}
}
