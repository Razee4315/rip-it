/** How a cloth is hung: where its particles start and which ones are held. */

export type Mount =
	/** curtain rod: `clips` rings along the top, gathered to `gather` of its width into pleats */
	| { kind: "rod"; clips: number; gather: number }
	/** washing line: a few pegs along the top edge */
	| { kind: "line"; pegs: number }
	/** two nails through the top corners; the top edge swags between them */
	| { kind: "corners"; gather: number }
	/** flag: the hoist (left edge) is laced to a pole */
	| { kind: "pole" }
	/** stretched drum-tight in a frame, every border point held */
	| { kind: "frame" }
	/** batten: the whole top edge is clamped flat */
	| { kind: "batten" }
	/** nothing holds it — laid over whatever is underneath */
	| { kind: "drape"; tilt: number };

export type Layout = {
	positions: Float32Array;
	pins: Uint8Array;
	/** grid indices of the held particles that get visible hardware (clips, pegs, nails) */
	hardware: number[];
};

export function buildLayout(
	cols: number,
	rows: number,
	width: number,
	height: number,
	cx: number,
	topY: number,
	z: number,
	mount: Mount,
): Layout {
	const nx = cols + 1,
		ny = rows + 1;
	const positions = new Float32Array(nx * ny * 3);
	const pins = new Uint8Array(nx * ny);
	const hardware: number[] = [];
	const sx = width / cols,
		sy = height / rows;
	const set = (i: number, j: number, x: number, y: number, zz: number) => {
		const p = (j * nx + i) * 3;
		positions[p] = x;
		positions[p + 1] = y;
		positions[p + 2] = zz;
	};
	const pinAt = (i: number, j: number, hw = true) => {
		const p = j * nx + i;
		if (!pins[p]) {
			pins[p] = 1;
			if (hw) hardware.push(p);
		}
	};

	if (mount.kind === "rod" || mount.kind === "line" || mount.kind === "corners") {
		const n = mount.kind === "rod" ? mount.clips : mount.kind === "line" ? mount.pegs : 2;
		const g = mount.kind === "rod" ? mount.gather : mount.kind === "corners" ? mount.gather : 0.985;
		const clipCols: number[] = [];
		for (let k = 0; k < n; k++) clipCols.push(Math.round((k * cols) / (n - 1)));
		const wG = width * g;
		for (let i = 0; i < nx; i++) {
			// which pair of clips is this column between?
			let k = 0;
			while (k < n - 2 && i > clipCols[k + 1]) k++;
			const c0 = clipCols[k],
				c1 = clipCols[k + 1];
			const t = (i - c0) / Math.max(1, c1 - c0);
			const span = (c1 - c0) * sx * g;
			// pleat depth chosen so the squeezed cloth keeps its true length
			const amp = ((2 * span) / Math.PI) * Math.sqrt(Math.max(0, 1 / g - 1));
			const dir = mount.kind === "rod" ? (k % 2 === 0 ? 1 : -1) : 1;
			const x = cx - wG / 2 + i * sx * g;
			const wave = Math.sin(Math.PI * t);
			for (let j = 0; j < ny; j++) {
				const fall = j * sy;
				if (mount.kind === "rod") {
					set(i, j, x, topY - fall, z + amp * wave * dir);
				} else {
					// swag: slack hangs down between the holds rather than pleating
					const sag = amp * wave * 0.9;
					set(i, j, x, topY - fall - sag, z + amp * wave * 0.25 * (j === 0 ? 0 : 1));
				}
			}
		}
		for (const c of clipCols) pinAt(c, 0);
	} else if (mount.kind === "pole") {
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) {
				// start mid-flutter so it does not open as a rigid board
				const wob = Math.sin(i * 0.5) * 0.03 * (i / cols);
				set(i, j, cx - width / 2 + i * sx, topY - j * sy - (i / cols) * 0.1, z + wob);
			}
		for (let j = 0; j < ny; j++) pinAt(0, j, j % 3 === 0 || j === rows);
	} else if (mount.kind === "frame") {
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) set(i, j, cx - width / 2 + i * sx, topY - j * sy, z);
		for (let i = 0; i < nx; i++) {
			pinAt(i, 0, false);
			pinAt(i, rows, false);
		}
		for (let j = 0; j < ny; j++) {
			pinAt(0, j, false);
			pinAt(cols, j, false);
		}
	} else if (mount.kind === "batten") {
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) set(i, j, cx - width / 2 + i * sx, topY - j * sy, z);
		for (let i = 0; i < nx; i++) pinAt(i, 0, i % 4 === 0 || i === cols);
	} else {
		// drape: start as a gently tilted sheet floating above its resting place
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++)
				set(
					i,
					j,
					cx - width / 2 + i * sx,
					topY - j * sy * Math.sin(mount.tilt),
					z + height / 2 - j * sy * Math.cos(mount.tilt),
				);
	}
	return { positions, pins, hardware };
}
