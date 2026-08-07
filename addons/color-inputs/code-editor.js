export default async function ({ addon, console }) {
  const Blockly = await addon.tab.traps.getBlockly();

  const oldCreateLabelDom = Blockly.FieldColourSlider.prototype.createLabelDom_;
  Blockly.FieldColourSlider.prototype.createLabelDom_ = function (...args) {
    const [header, readout] = oldCreateLabelDom.call(this, ...args);
    header.classList.add("sa-color-inputs-row-header");
    readout.remove();
    const input = document.createElement("input");
    input.type = "number";
    input.min = 0;
    input.max = 100;
    input.className = addon.tab.scratchClass("input_input-form", "input_input-small", "input_input-small-range", {
      others: "sa-color-input",
    });
    Object.defineProperty(input, "textContent", {
      set(newValue) {
        input.value = newValue;
      },
    });
    header.appendChild(input);
    return [header, input];
  }

  const getInputListener = (field, channel) => {
    const sliderListener = field.sliderCallbackFactory_(channel);
    return (e) => {
      let oldValue = e.target.value;
      e.target.value *= { hue: 360 / 100, saturation: 1 / 100, brightness: 255 / 100 }[channel];
      sliderListener(e);
      e.target.value = oldValue;
    }
  };

  const oldShowEditor = Blockly.FieldColourSlider.prototype.showEditor_;
  Blockly.FieldColourSlider.prototype.showEditor_ = function (...args) {
    oldShowEditor.call(this, ...args);
    this.hueReadout_.addEventListener("input", getInputListener(this, "hue"));
    this.saturationReadout_.addEventListener("input", getInputListener(this, "saturation"));
    this.brightnessReadout_.addEventListener("input", getInputListener(this, "brightness"));
  }
}
