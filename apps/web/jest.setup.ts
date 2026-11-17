import "@testing-library/jest-dom";

/*
 * jsdom implements no layout, so it ships no `ResizeObserver`. Radix measures
 * the control with one to size the hidden input it posts through, and without
 * this any test that renders a checkbox inside a form throws before asserting
 * anything.
 */
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
