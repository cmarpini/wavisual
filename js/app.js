(function () {
  "use strict";

  var physics = window.WavisualPhysics;
  var SUPER_DIGITS = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "+": "⁺",
    "-": "⁻"
  };
  var BAND_LABELS = {
    uv: "Ultravioleta — sem cor visível",
    visible: "Faixa visível",
    ir: "Infravermelho — sem cor visível"
  };

  var SLIDER_MAX = 10000;
  var FREQ_TICKS = [
    { hz: 1.2e14, major: true, edge: true },
    { hz: 2e14, major: true },
    { hz: 3e14, major: false },
    { hz: 4e14, major: false },
    { hz: 5e14, major: true },
    { hz: 6e14, major: false },
    { hz: 7e14, major: false },
    { hz: 8e14, major: false },
    { hz: 9e14, major: false },
    { hz: 1e15, major: true },
    { hz: 1.2e15, major: false },
    { hz: 1.3e15, major: false },
    { hz: 1.4e15, major: false },
    { hz: 1.5e15, major: true, edge: true }
  ];

  var slider = document.getElementById("wavelength");
  var sortButton = document.getElementById("spectrum-sort");
  var spectrumHint = document.getElementById("spectrum-hint");
  var freqScaleEl = document.getElementById("spectrum-freq-scale");
  var lambdaEl = document.getElementById("lambda-value");
  var freqTHzEl = document.getElementById("freq-thz");
  var freqHzEl = document.getElementById("freq-hz");
  var bandEl = document.getElementById("band-note");
  var swatchEl = document.querySelector(".swatch");
  var spectrumCanvas = document.getElementById("spectrum");
  var waveCanvas = document.getElementById("wave");
  var spectrumCtx = spectrumCanvas.getContext("2d");
  var waveCtx = waveCanvas.getContext("2d");
  var reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  var state = {
    wavelengthNm: 550,
    frequencyHz: physics.frequencyFromWavelength(550),
    rgb: physics.displayColorFromWavelength(550),
    sortBy: "wavelength",
    phase: 0,
    lastTime: 0
  };

  function toSuperscript(exponent) {
    return String(exponent)
      .split("")
      .map(function (ch) {
        return SUPER_DIGITS[ch] || ch;
      })
      .join("");
  }

  function formatScientificHz(frequencyHz) {
    var exp = Math.floor(Math.log10(frequencyHz));
    var mantissa = frequencyHz / Math.pow(10, exp);
    return formatNumber(mantissa, 2) + " × 10" + toSuperscript(exp) + " Hz";
  }

  function formatNumber(value, digits) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function isFrequencySort() {
    return state.sortBy === "frequency";
  }

  function logBandBox(fromNm, toNm) {
    var inverted = isFrequencySort();
    var a = physics.wavelengthToLogPosition(fromNm, inverted);
    var b = physics.wavelengthToLogPosition(toNm, inverted);
    return {
      left: Math.min(a, b) * 100,
      width: Math.abs(b - a) * 100
    };
  }

  function setSpectrumLayoutVars() {
    var inverted = isFrequencySort();
    var uv = logBandBox(physics.SPECTRUM_MIN_NM, physics.VISIBLE_MIN_NM);
    var vis = logBandBox(physics.VISIBLE_MIN_NM, physics.VISIBLE_MAX_NM);
    var ir = logBandBox(physics.VISIBLE_MAX_NM, physics.SPECTRUM_MAX_NM);

    document.documentElement.style.setProperty("--uv-left", uv.left + "%");
    document.documentElement.style.setProperty("--uv-width", uv.width + "%");
    document.documentElement.style.setProperty("--uv-align", inverted ? "right" : "left");
    document.documentElement.style.setProperty("--vis-left", vis.left + "%");
    document.documentElement.style.setProperty("--vis-width", vis.width + "%");
    document.documentElement.style.setProperty("--ir-left", ir.left + "%");
    document.documentElement.style.setProperty("--ir-width", ir.width + "%");
  }

  function formatTickPower(hz) {
    var exp = Math.floor(Math.log10(hz) + 1e-12);
    var mantissa = hz / Math.pow(10, exp);
    if (Math.abs(mantissa - 1) < 0.02) {
      return "10" + toSuperscript(exp);
    }
    var digits = Math.abs(mantissa - Math.round(mantissa)) < 0.02 ? 0 : 1;
    return formatNumber(mantissa, digits) + "×10" + toSuperscript(exp);
  }

  function formatTickTHz(hz) {
    return Math.round(physics.toTHz(hz)) + " THz";
  }

  function renderFreqScale() {
    if (!freqScaleEl) {
      return;
    }

    freqScaleEl.innerHTML = "";
    var inverted = isFrequencySort();
    var minHz = physics.SPECTRUM_FREQ_MIN_HZ;
    var maxHz = physics.SPECTRUM_FREQ_MAX_HZ;

    FREQ_TICKS.forEach(function (tick) {
      if (tick.hz < minHz * 0.995 || tick.hz > maxHz * 1.005) {
        return;
      }

      var t = physics.frequencyToLogPosition(tick.hz, inverted) * 100;
      var item = document.createElement("div");
      item.className = "freq-tick" + (tick.major ? " major" : " minor") + (tick.edge ? " edge" : "");
      item.style.left = t + "%";

      if (t <= 3) {
        item.classList.add("align-start");
      } else if (t >= 97) {
        item.classList.add("align-end");
      }

      var mark = document.createElement("span");
      mark.className = "freq-tick-mark";
      item.appendChild(mark);

      if (tick.major) {
        var label = document.createElement("span");
        label.className = "freq-tick-label";
        label.textContent = formatTickPower(tick.hz);
        item.appendChild(label);

        var thz = document.createElement("span");
        thz.className = "freq-tick-thz";
        thz.textContent = formatTickTHz(tick.hz);
        item.appendChild(thz);
      }

      freqScaleEl.appendChild(item);
    });
  }

  function sliderToWavelength() {
    var t = Number(slider.value) / SLIDER_MAX;
    return physics.positionToWavelength(t, isFrequencySort());
  }

  function wavelengthToSlider(wavelengthNm) {
    var t = physics.wavelengthToLogPosition(wavelengthNm, isFrequencySort());
    return Math.round(t * SLIDER_MAX);
  }

  function syncSliderToWavelength() {
    slider.value = String(wavelengthToSlider(state.wavelengthNm));
  }

  function updateSortUI() {
    var inverted = isFrequencySort();
    var nextAction = inverted ? "Ordenar por comprimento de onda" : "Ordenar por frequência";

    if (sortButton) {
      sortButton.textContent = nextAction;
      sortButton.setAttribute("aria-pressed", inverted ? "true" : "false");
      sortButton.setAttribute("aria-label", nextAction);
    }
    if (spectrumHint) {
      spectrumHint.textContent = inverted
        ? "IV → visível → UV · escala log(f)"
        : "UV → visível → IV · escala log(f)";
    }
    slider.setAttribute("dir", "ltr");
    syncSliderToWavelength();
    setSpectrumLayoutVars();
    renderFreqScale();
    drawSpectrum();
  }

  function setCanvasSize(canvas) {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var width = Math.max(1, Math.round(rect.width * dpr));
    var height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  function drawSpectrum() {
    setCanvasSize(spectrumCanvas);
    var width = spectrumCanvas.width;
    var height = spectrumCanvas.height;
    var inverted = isFrequencySort();

    for (var x = 0; x < width; x += 1) {
      var t = width === 1 ? 0 : x / (width - 1);
      var wavelength = physics.positionToWavelength(t, inverted);
      spectrumCtx.fillStyle = physics.rgbToCss(physics.spectrumColorFromWavelength(wavelength));
      spectrumCtx.fillRect(x, 0, 1, height);
    }
  }

  function updateReadings() {
    var rgb = state.rgb;
    var css = physics.rgbToCss(rgb);
    var thz = physics.toTHz(state.frequencyHz);
    var band = physics.bandFromWavelength(state.wavelengthNm);
    var bandLabel = BAND_LABELS[band];

    document.documentElement.style.setProperty("--wave-color", css);
    lambdaEl.textContent = String(Math.round(state.wavelengthNm));
    freqTHzEl.textContent = formatNumber(thz, 1);
    freqHzEl.textContent = formatScientificHz(state.frequencyHz);
    if (bandEl) {
      bandEl.textContent = bandLabel;
    }
    if (swatchEl) {
      swatchEl.setAttribute("aria-label", "Amostra: " + bandLabel);
    }

    slider.setAttribute("aria-valuenow", String(Math.round(state.wavelengthNm)));
    slider.setAttribute(
      "aria-valuetext",
      Math.round(state.wavelengthNm) +
        " nanômetros, " +
        formatNumber(thz, 1) +
        " terahertz, " +
        bandLabel
    );
  }

  function applyWavelength(wavelengthNm) {
    var wl = Math.round(wavelengthNm);
    state.wavelengthNm = wl;
    state.frequencyHz = physics.frequencyFromWavelength(wl);
    state.rgb = physics.displayColorFromWavelength(wl);
    updateReadings();
  }

  function drawWave(timestamp) {
    setCanvasSize(waveCanvas);
    var width = waveCanvas.width;
    var height = waveCanvas.height;
    var dpr = window.devicePixelRatio || 1;

    if (!state.lastTime) {
      state.lastTime = timestamp;
    }
    var dt = Math.min(0.05, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;

    var minHz = physics.frequencyFromWavelength(physics.SPECTRUM_MAX_NM);
    var visualHz = 0.7 * (state.frequencyHz / minHz);
    if (!reduceMotionQuery.matches) {
      state.phase += 2 * Math.PI * visualHz * dt;
    }

    var lambdaPx = (state.wavelengthNm / physics.SPECTRUM_MIN_NM) * (56 * dpr);
    var amplitude = height * 0.32;
    var midY = height / 2;
    var css = physics.rgbToCss(state.rgb);

    waveCtx.clearRect(0, 0, width, height);

    waveCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    waveCtx.lineWidth = 1 * dpr;
    waveCtx.beginPath();
    waveCtx.moveTo(0, midY);
    waveCtx.lineTo(width, midY);
    waveCtx.stroke();

    waveCtx.strokeStyle = css;
    waveCtx.lineWidth = 2.4 * dpr;
    waveCtx.lineJoin = "round";
    waveCtx.lineCap = "round";
    waveCtx.shadowColor = css;
    waveCtx.shadowBlur = 12 * dpr;
    waveCtx.beginPath();

    for (var x = 0; x <= width; x += 1) {
      var y = midY + amplitude * Math.sin((2 * Math.PI * x) / lambdaPx - state.phase);
      if (x === 0) {
        waveCtx.moveTo(x, y);
      } else {
        waveCtx.lineTo(x, y);
      }
    }
    waveCtx.stroke();
    waveCtx.shadowBlur = 0;

    window.requestAnimationFrame(drawWave);
  }

  slider.addEventListener("input", function () {
    applyWavelength(sliderToWavelength());
  });

  if (sortButton) {
    sortButton.addEventListener("click", function () {
      state.sortBy = isFrequencySort() ? "wavelength" : "frequency";
      updateSortUI();
    });
  }

  if (window.ResizeObserver) {
    new window.ResizeObserver(drawSpectrum).observe(spectrumCanvas.parentElement);
  } else {
    window.addEventListener("resize", drawSpectrum);
  }
  if (typeof reduceMotionQuery.addEventListener === "function") {
    reduceMotionQuery.addEventListener("change", function () {
      state.lastTime = 0;
    });
  }

  applyWavelength(550);
  updateSortUI();
  window.requestAnimationFrame(drawWave);
})();
