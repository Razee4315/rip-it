/** "RIP IT!" torn across the middle. */
export function Wordmark({ size = 30 }: { size?: number }) {
	const text = (
		<>
			RIP <em>IT!</em>
		</>
	);
	return (
		<span className="wordmark" style={{ fontSize: size }} role="img" aria-label="RIP IT!">
			<span className="wordmark__half wordmark__half--top" aria-hidden="true">
				{text}
			</span>
			<span className="wordmark__half wordmark__half--bottom" aria-hidden="true">
				{text}
			</span>
		</span>
	);
}
