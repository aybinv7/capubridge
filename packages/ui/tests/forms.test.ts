import { readFileSync } from "node:fs";
import { join } from "node:path";

import { h, nextTick, ref } from "vue";
import { expect, test } from "vite-plus/test";

import FormFixture from "../fixtures/forms/FormFixture.vue";
import {
  Checkbox,
  Input,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Switch,
  Textarea,
} from "../src/index.ts";
import type { SelectValue } from "../src/index.ts";
import {
  inputClearButtonSizes,
  inputClearGlyphSizes,
  inputFontSizes,
  inputIconWrapClasses,
  inputPaddingNoIcon,
  inputPaddingWithIcon,
} from "../src/components/forms/input.contracts.ts";
import {
  textareaIconWrapClasses,
  textareaPaddingNoIcon,
  textareaPaddingVertical,
  textareaPaddingWithIcon,
} from "../src/components/forms/textarea.contracts.ts";
import { byTestId, mountTree } from "./support/mountTree.ts";
import type { MountedTree } from "./support/mountTree.ts";

const formsCss = readFileSync(join(process.cwd(), "src", "styles", "forms.css"), "utf8");
const selectCss = readFileSync(join(process.cwd(), "src", "styles", "select.css"), "utf8");
const selectSource = readFileSync(
  join(process.cwd(), "src", "components", "forms", "Select.vue"),
  "utf8",
);
const stylesIndex = readFileSync(join(process.cwd(), "src", "styles", "index.css"), "utf8");
const checkboxGlyph = readFileSync(
  join(process.cwd(), "src", "components", "forms", "CheckboxGlyph.vue"),
  "utf8",
);

test("locks the Cladd field geometry ported as utility strings", () => {
  expect(inputFontSizes["2xl"]).toBe("text-cui-xs");
  expect(inputIconWrapClasses["2xl"]).toBe("left-3.5 [&>svg]:size-4");
  expect(inputPaddingNoIcon.lg).toBe("px-2.5");
  expect(inputPaddingWithIcon["2xl"]).toBe("pl-9.5 pr-4");
  expect(inputClearButtonSizes.lg).toBe("sm");
  expect(inputClearGlyphSizes.md).toBe("size-3.5!");
  expect(textareaPaddingVertical.lg).toBe("pt-2 pb-1.5");
  expect(textareaIconWrapClasses["2xl"]).toBe("left-3.5 [&>svg]:size-4 top-4");
  expect(textareaPaddingWithIcon.sm).toBe("pl-8.5 pr-2");
  expect(textareaPaddingNoIcon["2xl"]).toBe("px-3.5");
});

test("locks the Cladd checkbox indicator path", () => {
  expect(checkboxGlyph).toContain("M14.255 2.47c.477.386.55 1.086.164 1.562l-7.555 9.334");
  expect(checkboxGlyph).toContain('fill="currentColor"');
});

test("keeps input form semantics and textarea editor semantics", async () => {
  const inputValue = ref("target");
  const notes = ref("notes");
  const mounted = mountTree(
    h("form", null, [
      h(Input, {
        "data-testid": "input-shell",
        errorMessage: "Required",
        name: "query",
        "onUpdate:modelValue": (value: string) => (inputValue.value = value),
        valid: false,
        modelValue: inputValue.value,
      }),
      h(Textarea, {
        "data-testid": "textarea-shell",
        "onUpdate:modelValue": (value: string) => (notes.value = value),
        modelValue: notes.value,
      }),
    ]),
  );
  const inputShell = byTestId(mounted.root, "input-shell");
  const input = inputShell.querySelector("input") as HTMLInputElement;
  const textarea = byTestId(mounted.root, "textarea-shell") as HTMLElement;
  const editor = textarea.querySelector('[data-part="control"]') as HTMLElement;

  input.value = "device";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  editor.innerText = "updated";
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();

  expect(inputValue.value).toBe("device");
  expect(notes.value).toBe("updated");
  expect(inputShell.getAttribute("data-invalid")).toBe("true");
  expect(inputShell.querySelector('[data-part="error"]')?.textContent?.trim()).toBe("Required");
  expect(new FormData(mounted.root.querySelector("form") as HTMLFormElement).get("query")).toBe(
    "device",
  );
  mounted.app.unmount();
});

test("uses native state and form inputs for checkbox and switch", async () => {
  const checked = ref(false);
  const enabled = ref(false);
  const mounted = mountTree(
    h("form", null, [
      h(Checkbox, {
        "data-testid": "checkbox",
        name: "selected",
        "onUpdate:modelValue": (value: boolean) => (checked.value = value),
        value: "yes",
      }),
      h(Switch, {
        "data-testid": "switch",
        name: "enabled",
        "onUpdate:modelValue": (value: boolean) => (enabled.value = value),
        value: "yes",
      }),
    ]),
  );

  const checkboxIndicator = byTestId(mounted.root, "checkbox").querySelector(
    ".cui-checkbox__indicator",
  );
  const switchThumb = byTestId(mounted.root, "switch").querySelector(".cui-switch__thumb");
  const switchThumbFill = switchThumb?.querySelector(".cui-switch__thumb-fill");

  expect(checkboxIndicator?.getAttribute("data-state")).toBe("unchecked");
  expect(switchThumbFill?.parentElement).toBe(switchThumb);

  byTestId(mounted.root, "checkbox").click();
  byTestId(mounted.root, "switch").click();
  await nextTick();

  expect(checked.value).toBe(true);
  expect(enabled.value).toBe(true);
  expect(checkboxIndicator?.getAttribute("data-state")).toBe("checked");
  expect(byTestId(mounted.root, "checkbox").getAttribute("data-state")).toBe("checked");
  expect(byTestId(mounted.root, "switch").getAttribute("data-state")).toBe("checked");
  mounted.app.unmount();
});

test("matches Cladd switch surface and input-less contracts", async () => {
  const enabled = ref(false);
  const mounted = mountTree(
    h(
      Switch,
      {
        "data-testid": "switch-contract",
        color: "orange",
        input: false,
        "onUpdate:modelValue": (value: boolean) => (enabled.value = value),
        outline: false,
        surfaceLevel: "+2",
        thumbOutline: false,
        thumbSurfaceLevel: "+3",
        thumbVariant: "solid",
        variant: "gradient",
      },
      {
        icon: ({ checked }: { checked: boolean }) =>
          h("span", { "data-testid": "switch-icon" }, String(checked)),
      },
    ),
  );
  const switchRoot = byTestId(mounted.root, "switch-contract");
  const track = switchRoot.querySelector(".cui-switch__track");
  const thumb = switchRoot.querySelector(".cui-switch__thumb");

  expect(switchRoot.getAttribute("role")).toBe("switch");
  expect(track?.getAttribute("data-cui-surface-level")).toBe("2");
  expect(thumb?.getAttribute("data-cui-surface-level")).toBe("3");
  expect(thumb?.getAttribute("data-cui-surface-variant")).toBe("solid");
  expect(switchRoot.querySelector('[data-testid="switch-icon"]')?.textContent).toBe("false");
  switchRoot.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
  await nextTick();
  expect(enabled.value).toBe(true);
  expect(switchRoot.getAttribute("data-state")).toBe("checked");
  mounted.app.unmount();
});

test("matches Cladd checkbox input-less and customization APIs", async () => {
  const checked = ref(false);
  const mounted = mountTree(
    h(Checkbox, {
      "data-testid": "checkbox-contract",
      checkClassName: "checkbox-icon-contract",
      color: "green",
      input: false,
      "onUpdate:modelValue": (value: boolean) => (checked.value = value),
      size: "md",
      thumbOutline: false,
    }),
  );
  const checkbox = byTestId(mounted.root, "checkbox-contract");

  expect(checkbox.getAttribute("role")).toBe("checkbox");
  expect(checkbox.getAttribute("aria-checked")).toBe("false");
  expect(checkbox.querySelector('[data-part="input"]')).toBeNull();
  expect(checkbox.querySelector(".checkbox-icon-contract")).not.toBeNull();
  checkbox.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
  await nextTick();
  expect(checked.value).toBe(true);
  expect(checkbox.getAttribute("data-checked")).toBe("true");
  mounted.app.unmount();
});

test("coordinates radio selection through RadioGroup", async () => {
  const selected = ref("physical");
  const mounted = mountTree(
    h(
      RadioGroup,
      {
        "onUpdate:modelValue": (value: string) => (selected.value = value),
        name: "target",
      },
      {
        default: () => [
          h(Radio, { "data-testid": "physical", value: "physical" }),
          h(Radio, { "data-testid": "emulator", value: "emulator" }),
        ],
      },
    ),
  );

  byTestId(mounted.root, "emulator").click();
  await nextTick();

  expect(selected.value).toBe("emulator");
  expect(byTestId(mounted.root, "emulator").getAttribute("data-state")).toBe("checked");
  expect(byTestId(mounted.root, "physical").getAttribute("data-state")).toBe("unchecked");
  mounted.app.unmount();
});

test("matches Cladd radio standalone and input-less contracts", async () => {
  const selected = ref(false);
  const mounted = mountTree(
    h(Radio, {
      "data-testid": "radio-contract",
      color: "purple",
      input: false,
      "onUpdate:modelValue": (value: boolean) => (selected.value = value),
      size: "md",
      thumbOutline: false,
      value: "priority",
    }),
  );
  const radio = byTestId(mounted.root, "radio-contract");

  expect(radio.getAttribute("role")).toBe("radio");
  expect(radio.getAttribute("aria-checked")).toBe("false");
  expect(radio.querySelector('[data-part="input"]')).toBeNull();
  radio.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  await nextTick();
  expect(selected.value).toBe(true);
  expect(radio.getAttribute("data-state")).toBe("checked");
  mounted.app.unmount();
});

test("maps native slider input to the scalar model", async () => {
  const value = ref(0);
  const mounted = mountTree(
    h(Slider, {
      "aria-label": "Sampling rate",
      "data-testid": "slider",
      "onUpdate:modelValue": (next: number) => (value.value = next),
      step: 5,
    }),
  );
  const root = byTestId(mounted.root, "slider");
  const control = root.querySelector("input") as HTMLInputElement;

  expect(control.type).toBe("range");
  expect(control.getAttribute("aria-label")).toBe("Sampling rate");
  expect(root.getAttribute("aria-label")).toBeNull();
  expect(control.getAttribute("role")).toBeNull();

  control.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
  await nextTick();

  expect(value.value).toBe(5);
  expect(control.value).toBe("5");
  mounted.app.unmount();
});

test("matches Cladd slider scale and track contracts", async () => {
  const value = ref(20);
  const mounted = mountTree(
    h(Slider, {
      "data-testid": "slider-contract",
      color: "green",
      max: 20000,
      min: 20,
      rangeFill: true,
      rounded: true,
      scale: "log",
      "onUpdate:modelValue": (next: number) => (value.value = next),
      variant: "track",
    }),
  );
  const slider = byTestId(mounted.root, "slider-contract");
  const input = slider.querySelector("input") as HTMLInputElement;

  expect(input.min).toBe("0");
  expect(input.max).toBe("1000");
  expect(input.step).toBe("1");
  expect(slider.querySelector(".cui-slider__range--track")).not.toBeNull();
  expect(slider.classList.contains("cui-slider--rounded")).toBe(true);
  input.value = "500";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  expect(value.value).toBe(632);
  mounted.app.unmount();
});

test("anchors the thumb-slider value bubble to the moving thumb", () => {
  const mounted = mountTree(h(Slider, { defaultValue: 26 }));
  const slider = mounted.root.querySelector(".cui-slider") as HTMLElement;
  const anchor = slider.querySelector(".cui-slider__thumb-wrapper > .cui-slider__value-anchor");
  const value = anchor?.querySelector(".cui-slider__value");

  expect(anchor).not.toBeNull();
  expect(value?.textContent).toContain("26");
  mounted.app.unmount();
});

test("locks Slider to Cladd's literal authored geometry", () => {
  expect(formsCss).toContain('input[type="range"]::-webkit-slider-thumb');
  expect(formsCss).toContain("width: 20px");
  expect(formsCss).toContain("height: 6px");
  expect(formsCss).toContain("height: 8px");
  expect(formsCss).toContain("height: 2px");
  expect(formsCss).toContain("bottom: -16px");
  expect(formsCss).toContain("left: 10px");
  expect(formsCss).toContain("border-radius: var(--cui-radius-2xl)");
  expect(formsCss).toContain("transition: width 300ms ease-out");
  expect(formsCss).toContain("transition: padding-left 300ms ease-out");
});

test("matches Cladd Select trigger, listbox and single-select behavior", async () => {
  const selected = ref<string | number | boolean | null | Array<string | number | boolean | null>>(
    "",
  );
  const mounted = mountTree(
    h(Select, {
      "data-testid": "select-trigger",
      keyboardHints: true,
      modelValue: selected.value,
      "onUpdate:modelValue": (value: SelectValue | SelectValue[]) => (selected.value = value),
      options: [
        { label: "Brand", value: "brand" },
        { label: "Cyan", value: "cyan" },
      ],
      title: "Accent",
    }),
  );
  document.body.append(mounted.root);

  byTestId(mounted.root, "select-trigger").click();
  await nextTick();
  const listbox = document.body.querySelector<HTMLElement>('[role="listbox"]');
  const cyan = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(
    (option) => option.textContent?.includes("Cyan"),
  );

  expect(listbox).not.toBeNull();
  expect(document.body.textContent).toContain("Accent");
  expect(document.body.textContent).toContain("1");
  cyan?.click();
  await nextTick();
  expect(selected.value).toBe("cyan");
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(document.body.querySelector('[role="listbox"]')).toBeNull();

  mounted.app.unmount();
  mounted.root.remove();
});

test("locks Select to Cladd's trigger and option geometry", () => {
  expect(selectCss).toContain("min-width: 160px");
  expect(selectCss).toContain("justify-content: space-between");
  expect(selectSource).toContain('content-class-name="cui-select__option-content"');
  expect(selectSource).toContain("multiline");
  expect(selectSource).toContain("rounded");
  expect(selectSource).toContain('size="lg"');
  expect(selectSource).toContain('size="lg"');
  expect(selectCss).toContain(".cui-select__hint");
  expect(selectCss).toContain("grid-template-columns: minmax(0, 1fr)");
  expect(selectCss).toContain("overflow-x: hidden");
  expect(selectCss).toContain("overflow-y: auto");
  expect(stylesIndex.indexOf('@import "./select.css"')).toBeGreaterThan(
    stylesIndex.indexOf('@import "./overlays.css"'),
  );
});

interface MountedFormFixture extends MountedTree {
  submissions: Record<string, string>[];
}

function mountFormFixture(): MountedFormFixture {
  const submissions: Record<string, string>[] = [];
  const mounted = mountTree(
    h(FormFixture, {
      onSubmitted: (entries: string[][]) => submissions.push(Object.fromEntries(entries)),
    }),
  );
  document.body.append(mounted.root);
  return { ...mounted, submissions };
}

function cleanupFormFixture(mounted: MountedTree): void {
  mounted.app.unmount();
  mounted.root.remove();
}

function fixtureForm(root: HTMLElement): HTMLFormElement {
  return byTestId(root, "form") as HTMLFormElement;
}

function fieldControl(root: HTMLElement, testId: string): HTMLInputElement {
  const shell = byTestId(root, testId);
  return (shell.querySelector("input") ?? shell) as HTMLInputElement;
}

function editorControl(root: HTMLElement, testId: string): HTMLElement {
  return byTestId(root, testId).querySelector('[data-part="control"]') as HTMLElement;
}

function hiddenInput(root: HTMLElement, testId: string): HTMLInputElement {
  const input = byTestId(root, testId).querySelector("input");

  if (!input) {
    throw new Error(`Missing native input inside: ${testId}`);
  }

  return input;
}

function typeInto(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function messageText(root: HTMLElement, testId: string, part: "error" | "info"): string {
  return byTestId(root, testId).querySelector(`[data-part="${part}"]`)?.textContent?.trim() ?? "";
}

function submitFixture(root: HTMLElement): void {
  (byTestId(root, "submit") as HTMLButtonElement).click();
}

function resetFixture(root: HTMLElement): void {
  (byTestId(root, "reset") as HTMLButtonElement).click();
}

test("submits every named fixture control through native FormData", async () => {
  const mounted = mountFormFixture();

  typeInto(fieldControl(mounted.root, "serial"), "R3CX00SERIAL");
  await nextTick();
  submitFixture(mounted.root);
  await nextTick();

  expect(mounted.submissions).toHaveLength(1);
  expect(mounted.submissions[0]).toEqual({
    bufferSize: "40",
    deviceQuery: "pixel-9-pro",
    liveReload: "on",
    samplingRate: "30",
    serial: "R3CX00SERIAL",
    targetKind: "physical",
    verboseLogging: "yes",
  });
  cleanupFormFixture(mounted);
});

test("carries fixture interaction into the next native submission", async () => {
  const mounted = mountFormFixture();

  typeInto(fieldControl(mounted.root, "serial"), "R3CX00SERIAL");
  typeInto(fieldControl(mounted.root, "device-query"), "emulator-5554");
  typeInto(fieldControl(mounted.root, "release-notes"), "Reviewed");
  byTestId(mounted.root, "verbose-logging").click();
  byTestId(mounted.root, "experimental-inspector").click();
  byTestId(mounted.root, "target-emulator").click();
  byTestId(mounted.root, "live-reload").click();
  typeInto(hiddenInput(mounted.root, "sampling-rate"), "70");
  await nextTick();
  submitFixture(mounted.root);
  await nextTick();

  expect(mounted.submissions[0]).toEqual({
    bufferSize: "40",
    deviceQuery: "emulator-5554",
    experimentalInspector: "yes",
    samplingRate: "70",
    serial: "R3CX00SERIAL",
    targetKind: "emulator",
  });
  cleanupFormFixture(mounted);
});

test("keeps disabled fixture controls out of native submission", () => {
  const mounted = mountFormFixture();
  const fingerprint = fieldControl(mounted.root, "fingerprint");
  const archived = hiddenInput(mounted.root, "archived-sessions");
  const data = new FormData(fixtureForm(mounted.root));

  expect(fingerprint.disabled).toBe(true);
  expect(fingerprint.value).toBe("google/tokay/tokay");
  expect(archived.disabled).toBe(true);
  expect(archived.checked).toBe(true);
  expect(byTestId(mounted.root, "archived-sessions").getAttribute("data-state")).toBe("checked");
  expect(data.has("fingerprint")).toBe(false);
  expect(data.has("archivedSessions")).toBe(false);
  cleanupFormFixture(mounted);
});

test("restores every fixture control family from a native form reset", async () => {
  const mounted = mountFormFixture();
  const query = fieldControl(mounted.root, "device-query");
  const verboseInput = hiddenInput(mounted.root, "verbose-logging");
  const inspectorInput = hiddenInput(mounted.root, "experimental-inspector");
  const physicalInput = hiddenInput(mounted.root, "target-physical");
  const emulatorInput = hiddenInput(mounted.root, "target-emulator");
  const liveReloadInput = hiddenInput(mounted.root, "live-reload");
  const samplingInput = hiddenInput(mounted.root, "sampling-rate");
  const bufferInput = hiddenInput(mounted.root, "buffer-size");

  query.value = "scratch";
  verboseInput.checked = false;
  inspectorInput.checked = true;
  physicalInput.checked = false;
  emulatorInput.checked = true;
  liveReloadInput.checked = false;
  samplingInput.value = "5";
  bufferInput.value = "90";
  resetFixture(mounted.root);
  await nextTick();

  expect(query.value).toBe("pixel-9-pro");
  expect(verboseInput.checked).toBe(true);
  expect(inspectorInput.checked).toBe(false);
  expect(physicalInput.checked).toBe(true);
  expect(emulatorInput.checked).toBe(false);
  expect(liveReloadInput.checked).toBe(true);
  expect(samplingInput.value).toBe("30");
  expect(bufferInput.value).toBe("40");
  cleanupFormFixture(mounted);
});

test("keeps fixture indicator state and native state agreeing after a reset", async () => {
  const mounted = mountFormFixture();

  byTestId(mounted.root, "verbose-logging").click();
  byTestId(mounted.root, "experimental-inspector").click();
  byTestId(mounted.root, "target-emulator").click();
  byTestId(mounted.root, "live-reload").click();
  typeInto(hiddenInput(mounted.root, "sampling-rate"), "70");
  typeInto(hiddenInput(mounted.root, "buffer-size"), "90");
  await nextTick();
  resetFixture(mounted.root);
  await nextTick();

  const choices = [
    "verbose-logging",
    "experimental-inspector",
    "target-physical",
    "target-emulator",
    "live-reload",
  ];

  for (const testId of choices) {
    const rendered = byTestId(mounted.root, testId).getAttribute("data-state");
    expect(rendered).toBe(hiddenInput(mounted.root, testId).checked ? "checked" : "unchecked");
  }

  for (const testId of ["sampling-rate", "buffer-size"]) {
    const slider = byTestId(mounted.root, testId);
    expect(slider.querySelector(".cui-slider__value")?.textContent).toContain(
      hiddenInput(mounted.root, testId).value,
    );
  }

  expect(hiddenInput(mounted.root, "verbose-logging").checked).toBe(false);
  expect(hiddenInput(mounted.root, "experimental-inspector").checked).toBe(true);
  expect(hiddenInput(mounted.root, "target-emulator").checked).toBe(true);
  cleanupFormFixture(mounted);
});

test("keeps fixture labels and messages associated across submit and reset", async () => {
  const mounted = mountFormFixture();
  const serial = fieldControl(mounted.root, "serial");

  typeInto(serial, "R3CX00SERIAL");
  await nextTick();
  submitFixture(mounted.root);
  resetFixture(mounted.root);
  await nextTick();

  const fieldLabels: [string, string][] = [
    ["cui-form-fixture-device-query", "device-query"],
    ["cui-form-fixture-serial", "serial"],
  ];
  const choiceLabels: [string, string][] = [
    ["cui-form-fixture-verbose-logging", "verbose-logging"],
    ["cui-form-fixture-target-physical", "target-physical"],
    ["cui-form-fixture-target-emulator", "target-emulator"],
    ["cui-form-fixture-live-reload", "live-reload"],
  ];

  for (const [labelFor, testId] of fieldLabels) {
    const label = mounted.root.querySelector<HTMLLabelElement>(`label[for="${labelFor}"]`);
    expect(label?.control).toBe(fieldControl(mounted.root, testId));
  }

  for (const [labelFor, testId] of choiceLabels) {
    const label = mounted.root.querySelector<HTMLLabelElement>(`label[for="${labelFor}"]`);
    expect(label?.control).toBe(hiddenInput(mounted.root, testId));
  }

  expect(byTestId(mounted.root, "serial").getAttribute("data-invalid")).toBe("true");
  expect(serial.required).toBe(true);
  expect(messageText(mounted.root, "serial", "error")).toBe("Serial is required");
  expect(messageText(mounted.root, "device-query", "info")).toBe("Matches serial or model name");
  expect(messageText(mounted.root, "release-notes", "info")).toBe("Shown in the session report");
  expect(editorControl(mounted.root, "release-notes").getAttribute("contenteditable")).toBe("true");
  expect(byTestId(mounted.root, "accent").getAttribute("aria-label")).toBe("Accent");
  expect(byTestId(mounted.root, "accent").getAttribute("role")).toBe("combobox");
  cleanupFormFixture(mounted);
});
