import { createGlobalStyle } from "styled-components";
import { tokens } from "./tokens";

export const GlobalStyles = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent !important;
  }

  a, button, input, select, textarea, label,
  [role="button"], [tabindex]:not([tabindex="-1"]) {
    -webkit-tap-highlight-color: transparent !important;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }

  button { user-select: none; -webkit-user-select: none; }

  html, body, #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  html.touch, html.touch body {
    overflow-x: hidden;
    overflow-x: clip;
  }

  body {
    font-family: ${tokens.typography.fontFamily.primary};
    font-size: ${tokens.typography.fontSize.sm};
    line-height: ${tokens.typography.lineHeight.normal};
    color: ${tokens.colors.text.primary};
    background: ${tokens.colors.background.darkest};
    -webkit-font-smoothing: antialiased;
  }

  :focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: 2px;
  }

  html.touch :where(input, textarea, select) {
    font-size: 16px;
  }
`;
