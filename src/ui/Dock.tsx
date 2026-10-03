import { TOOLS, type ToolId } from "@/engine/tools";
import { ToolIcon } from "./icons";

export type Toast = { id: number; title?: string; text: string };

type Props = {
	tools: ToolId[];
	tool: ToolId;
	left: Partial<Record<ToolId, number>>;
	toast: Toast | null;
	onTool: (t: ToolId) => void;
};

function allowance(tool: ToolId, left: number): string {
	return TOOLS[tool].unit === "seconds" ? `${left.toFixed(left < 10 ? 1 : 0)}s` : String(left);
}

/** The tools for this level, along the bottom edge under the player's thumb. */
export function Dock({ tools, tool, left, toast, onTool }: Props) {
	return (
		<div className="dock">
			{toast && (
				<div className="toast" key={toast.id} role="status">
					{toast.title && <b>{toast.title}</b>}
					{toast.text}
				</div>
			)}
			<nav className="dock__row" aria-label="Tools">
				{tools.map((t) => {
					const l = left[t];
					const empty = l !== undefined && l <= 0;
					return (
						<button
							key={t}
							type="button"
							className={`tool${t === tool ? " tool--on" : ""}${empty ? " tool--empty" : ""}`}
							aria-label={TOOLS[t].name}
							aria-pressed={t === tool}
							onClick={() => onTool(t)}
						>
							<ToolIcon tool={t} size={26} />
							{l !== undefined && <span className="tool__left">{allowance(t, l)}</span>}
							{tools.length > 1 && <span className="tool__key">{TOOLS[t].key}</span>}
						</button>
					);
				})}
			</nav>
		</div>
	);
}
