(function (global) {
  "use strict";

  var SPEED_OF_LIGHT = 299792458;
  var SPECTRUM_MIN_NM = 200;
  var SPECTRUM_MAX_NM = 2500;
  var VISIBLE_MIN_NM = 380;
  var VISIBLE_MAX_NM = 750;
  var NM_IN_METERS = 1e-9;
  var THZ_IN_HZ = 1e12;
  var SPECTRUM_FREQ_MIN_HZ = SPEED_OF_LIGHT / (SPECTRUM_MAX_NM * NM_IN_METERS);
  var SPECTRUM_FREQ_MAX_HZ = SPEED_OF_LIGHT / (SPECTRUM_MIN_NM * NM_IN_METERS);
  var LOG_FREQ_MIN = Math.log10(SPECTRUM_FREQ_MIN_HZ);
  var LOG_FREQ_MAX = Math.log10(SPECTRUM_FREQ_MAX_HZ);
  var LOG_FREQ_SPAN = LOG_FREQ_MAX - LOG_FREQ_MIN;
  var RGB_GAMMA = 0.8;
  var RGB_INTENSITY_MAX = 255;
  var OUT_OF_VISIBLE_RGB = { r: 220, g: 220, b: 226 };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function frequencyFromWavelength(wavelengthNm) {
    var nm = clamp(Number(wavelengthNm), SPECTRUM_MIN_NM, SPECTRUM_MAX_NM);
    return SPEED_OF_LIGHT / (nm * NM_IN_METERS);
  }

  function wavelengthFromFrequency(frequencyHz) {
    var hz = clamp(Number(frequencyHz), SPECTRUM_FREQ_MIN_HZ, SPECTRUM_FREQ_MAX_HZ);
    return SPEED_OF_LIGHT / (hz * NM_IN_METERS);
  }

  /**
   * Posição 0..1 na barra em log10(frequência).
   * inverted=false (por λ): esquerda = f maior (UV).
   * inverted=true (por f): esquerda = f menor (IV), log(f) crescente.
   */
  function wavelengthToLogPosition(wavelengthNm, inverted) {
    var f = frequencyFromWavelength(wavelengthNm);
    var tFreq = (Math.log10(f) - LOG_FREQ_MIN) / LOG_FREQ_SPAN;
    var t = inverted ? tFreq : 1 - tFreq;
    return clamp(t, 0, 1);
  }

  function positionToWavelength(t, inverted) {
    var u = clamp(Number(t), 0, 1);
    var tFreq = inverted ? u : 1 - u;
    var logF = LOG_FREQ_MIN + tFreq * LOG_FREQ_SPAN;
    return wavelengthFromFrequency(Math.pow(10, logF));
  }

  function frequencyToLogPosition(frequencyHz, inverted) {
    return wavelengthToLogPosition(wavelengthFromFrequency(frequencyHz), inverted);
  }

  function isVisibleWavelength(wavelengthNm) {
    var wl = Number(wavelengthNm);
    return wl >= VISIBLE_MIN_NM && wl <= VISIBLE_MAX_NM;
  }

  function bandFromWavelength(wavelengthNm) {
    var wl = Number(wavelengthNm);
    if (wl < VISIBLE_MIN_NM) {
      return "uv";
    }
    if (wl > VISIBLE_MAX_NM) {
      return "ir";
    }
    return "visible";
  }

  function applyGamma(color, factor) {
    if (color <= 0) {
      return 0;
    }
    return Math.round(RGB_INTENSITY_MAX * Math.pow(color * factor, RGB_GAMMA));
  }

  /**
   * Conversão educativa λ → RGB (algoritmo piecewise no estilo Tanner Helland).
   * Aproxima a cor percebida no visível; não é um modelo CIE de laboratório.
   */
  function wavelengthToRgb(wavelengthNm) {
    var wl = clamp(Number(wavelengthNm), VISIBLE_MIN_NM, VISIBLE_MAX_NM);
    var red = 0;
    var green = 0;
    var blue = 0;
    var factor = 0;

    if (wl < 440) {
      red = -(wl - 440) / (440 - 380);
      green = 0;
      blue = 1;
    } else if (wl < 490) {
      red = 0;
      green = (wl - 440) / (490 - 440);
      blue = 1;
    } else if (wl < 510) {
      red = 0;
      green = 1;
      blue = -(wl - 510) / (510 - 490);
    } else if (wl < 580) {
      red = (wl - 510) / (580 - 510);
      green = 1;
      blue = 0;
    } else if (wl < 645) {
      red = 1;
      green = -(wl - 645) / (645 - 580);
      blue = 0;
    } else {
      red = 1;
      green = 0;
      blue = 0;
    }

    if (wl < 420) {
      factor = 0.3 + (0.7 * (wl - 380)) / (420 - 380);
    } else if (wl <= 700) {
      factor = 1;
    } else {
      factor = 0.3 + (0.7 * (750 - wl)) / (750 - 700);
    }

    return {
      r: applyGamma(red, factor),
      g: applyGamma(green, factor),
      b: applyGamma(blue, factor)
    };
  }

  function displayColorFromWavelength(wavelengthNm) {
    if (isVisibleWavelength(wavelengthNm)) {
      return wavelengthToRgb(wavelengthNm);
    }
    return {
      r: OUT_OF_VISIBLE_RGB.r,
      g: OUT_OF_VISIBLE_RGB.g,
      b: OUT_OF_VISIBLE_RGB.b
    };
  }

  function mixChannel(from, to, t) {
    return Math.round(from + (to - from) * clamp(t, 0, 1));
  }

  function spectrumColorFromWavelength(wavelengthNm) {
    var wl = clamp(Number(wavelengthNm), SPECTRUM_MIN_NM, SPECTRUM_MAX_NM);
    if (wl >= VISIBLE_MIN_NM && wl <= VISIBLE_MAX_NM) {
      return wavelengthToRgb(wl);
    }
    if (wl < VISIBLE_MIN_NM) {
      var tUv = (wl - SPECTRUM_MIN_NM) / (VISIBLE_MIN_NM - SPECTRUM_MIN_NM);
      return {
        r: mixChannel(156, 208, tUv),
        g: mixChannel(164, 212, tUv),
        b: mixChannel(184, 222, tUv)
      };
    }
    var tIr = (wl - VISIBLE_MAX_NM) / (SPECTRUM_MAX_NM - VISIBLE_MAX_NM);
    return {
      r: mixChannel(210, 148, tIr),
      g: mixChannel(206, 146, tIr),
      b: mixChannel(200, 152, tIr)
    };
  }

  function rgbToCss(rgb) {
    return "rgb(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ")";
  }

  function toTHz(frequencyHz) {
    return frequencyHz / THZ_IN_HZ;
  }

  global.WavisualPhysics = {
    SPEED_OF_LIGHT: SPEED_OF_LIGHT,
    SPECTRUM_MIN_NM: SPECTRUM_MIN_NM,
    SPECTRUM_MAX_NM: SPECTRUM_MAX_NM,
    VISIBLE_MIN_NM: VISIBLE_MIN_NM,
    VISIBLE_MAX_NM: VISIBLE_MAX_NM,
    SPECTRUM_FREQ_MIN_HZ: SPECTRUM_FREQ_MIN_HZ,
    SPECTRUM_FREQ_MAX_HZ: SPECTRUM_FREQ_MAX_HZ,
    OUT_OF_VISIBLE_RGB: OUT_OF_VISIBLE_RGB,
    frequencyFromWavelength: frequencyFromWavelength,
    wavelengthFromFrequency: wavelengthFromFrequency,
    wavelengthToLogPosition: wavelengthToLogPosition,
    positionToWavelength: positionToWavelength,
    frequencyToLogPosition: frequencyToLogPosition,
    wavelengthToRgb: wavelengthToRgb,
    displayColorFromWavelength: displayColorFromWavelength,
    spectrumColorFromWavelength: spectrumColorFromWavelength,
    isVisibleWavelength: isVisibleWavelength,
    bandFromWavelength: bandFromWavelength,
    rgbToCss: rgbToCss,
    toTHz: toTHz
  };
})(window);
