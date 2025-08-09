export default function addUI(dataSource = {}) {
  let html = `
    <div class="control-panel">
      <div class="section">Sun:</div>
      <div class="ui-item">
        <span class="caption">magnitude:</span>
        <input type="number"
          data-field="_lightMagnitude"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._lightMagnitude}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">radisu:</span>
        <input type="number"
          data-field="_RSun"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._RSun}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">X:</span>
        <input type="number"
          data-field="_lightPos"
          data-idx="0"
          data-recalc-shadow-map="true"
          step="50"
          class="narrow-64"
          value="${dataSource._lightPos[0]}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">Y:</span>
        <input type="number"
          data-field="_lightPos"
          data-idx="1"
          data-recalc-shadow-map="true"
          step="50"
          class="narrow-64"
          value="${dataSource._lightPos[1]}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">Z:</span>
        <input type="number"
          data-field="_lightPos"
          data-idx="2"
          data-recalc-shadow-map="true"
          step="50"
          class="narrow-64"
          value="${dataSource._lightPos[2]}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">color:</span>
        <input type="color"
          data-field="_lightColor"
          class="narrow-64"
          value="${dataSource._RGBToHex(dataSource._lightColor, true)}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">animate sun:</span>
        <input type="checkbox"
          data-field="_animateSun"
          ${dataSource._animateSun ? 'checked' : ''}
        />
      </div>

      <div class="section">Sky:</div>
      <div class="ui-item">
        <span class="caption">planet radius:</span>
        <input type="number"
          data-field="_RPlanet"
          data-recalc-sky-shadow-map="true"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._RPlanet}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">atmosphere radius:</span>
        <input type="number"
          data-field="_R1"
          data-recalc-sky-shadow-map="true"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._R1}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">rayleigh scattering:</span>
        <input type="color"
          data-field="_rayleighScattering"
          data-magnitude-scale="${dataSource._rayleighScatteringMagnitude}"
          data-recalc-sky-shadow-map="true"
          class="narrow-64"
          value="${dataSource._RGBToHex(vec3.normalize(new Float32Array(3), dataSource._rayleighScattering), true)}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">rayleigh scattering mul:</span>
        <input type="number"
          data-field="_skyScatteringMul"
          data-recalc-sky-shadow-map="true"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._skyScatteringMul}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">ozone absorbtion mul:</span>
        <input type="number"
          data-field="_skyAbsorptionMul"
          data-recalc-sky-shadow-map="true"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._skyAbsorptionMul}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">rayleigh density scale 1/:</span>
        <input type="number"
          data-field="_rayleighScatteringScale"
          data-recalc-sky-shadow-map="true"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._rayleighScatteringScale}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">mie density scale 1/:</span>
        <input type="number"
          data-field="_mieScatteringScale"
          data-recalc-sky-shadow-map="true"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._mieScatteringScale}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">mie scattering:</span>
        <input type="color"
          data-field="_mieScattering"
          data-magnitude-scale="${dataSource._mieScatteringMagnitude}"
          data-recalc-sky-shadow-map="true"
          class="narrow-64"
          value="${dataSource._RGBToHex(vec3.normalize(new Float32Array(3), dataSource._mieScattering), true)}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">mie absorbtion:</span>
        <input type="color"
          data-field="_mieAbsorbtion"
          data-magnitude-scale="${dataSource._mieAbsorbtionMagnitude}"
          data-recalc-sky-shadow-map="true"
          class="narrow-64"
          value="${dataSource._RGBToHex(vec3.normalize(new Float32Array(3), dataSource._mieAbsorbtion), true)}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">mie phase G:</span>
        <input type="number"
          data-field="_miePhaseG"
          data-recalc-sky-shadow-map="true"
          class="narrow-64"
          step=".01"
          value="${dataSource._miePhaseG}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">march samples:</span>
        <input type="number"
          data-field="_skyMarchSamples"
          data-val-min="1"
          step="1"
          class="narrow-64"
          value="${dataSource._skyMarchSamples}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">scatt octaves:</span>
        <input type="number"
          data-field="_skyScattOctaves"
          data-val-min="0"
          step="1"
          class="narrow-64"
          value="${dataSource._skyScattOctaves}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">optical depth map samples:</span>
        <input type="number"
          data-field="_skyShadowMapSamples"
          data-recalc-sky-shadow-map="true"
          data-val-min="1"
          step="1"
          class="narrow-64"
          value="${dataSource._skyShadowMapSamples}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">bilateral blur sigma:</span>
        <input type="number"
          data-field="_bilateralBlurSigma"
          data-val-min="0."
          step=".1"
          class="narrow-64"
          value="${dataSource._bilateralBlurSigma}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">bilateral blur bsigma:</span>
        <input type="number"
          data-field="_bilateralBlurBSigma"
          data-val-min="0."
          step=".1"
          class="narrow-64"
          value="${dataSource._bilateralBlurBSigma}"
        />
      </div>

      <div class="section">Clouds:</div>
      <div class="ui-item">
        <span class="caption">start radius:</span>
        <input type="number" data-field="_RCloud0" data-recalc-shadow-map="true" data-val-min="0" step=".1" class="narrow-64" value="${dataSource._RCloud0}"/>
      </div>
      <div class="ui-item">
        <span class="caption">end radius:</span>
        <input type="number" data-field="_RCloud1" data-recalc-shadow-map="true" data-val-min="0" step=".1" class="narrow-64" value="${dataSource._RCloud1}"/>
      </div>
      <div class="ui-item">
        <span class="caption">scattering:</span>
        <input type="color" data-field="_cloudScattering" data-recalc-shadow-map="true" class="narrow-64" value="${dataSource._RGBToHex(dataSource._cloudScattering, true)}"/>
      </div>
      <div class="ui-item">
        <span class="caption">density mul:</span>
        <input type="number" data-field="_cloudDensityMul" data-recalc-shadow-map="true" data-val-min="0" step="1" class="narrow-64" value="${dataSource._cloudDensityMul}"/>
      </div>
      <div class="ui-item">
        <span class="caption">march samples:</span>
        <input type="number" data-field="_cloudMarchSamples" data-val-min="1" step=".5" class="narrow-64" value="${dataSource._cloudMarchSamples}"/>
      </div>
      <div class="ui-item">
        <span class="caption">max stsepSize:</span>
        <input type="number" data-field="_cloudMarchMaxStepSize" data-val-min=".001" step=".01" class="narrow-64" value="${dataSource._cloudMarchMaxStepSize}"/>
      </div>
      <div class="ui-item">
        <span class="caption">shadow march samples:</span>
        <input type="number" data-field="_cloudShadowSamples" data-val-min="1" step="1." class="narrow-64" value="${dataSource._cloudShadowSamples}"/>
      </div>
      <div class="ui-item">
        <span class="caption">scatt octaves:</span>
        <input type="number" data-field="_cloudScattOctaves" data-val-min="0" step="1" class="narrow-64" value="${dataSource._cloudScattOctaves}"/>
      </div>
      <div class="ui-item">
        <span class="caption">optical depth map samples:</span>
        <input type="number" data-field="_cloudShadowMapSamples" data-recalc-shadow-map="true" data-val-min="1" step="1" class="narrow-64" value="${dataSource._cloudShadowMapSamples}"/>
      </div>
      <div class="ui-item">
        <span class="caption">phase g0:</span>
        <input type="number" data-field="_cloudPhaseG0" step=".05" class="narrow-64" value="${dataSource._cloudPhaseG0}"/>
      </div>
      <div class="ui-item">
        <span class="caption">phase g1:</span>
        <input type="number" data-field="_cloudPhaseG1" data-val-min="0" step=".05" class="narrow-64" value="${dataSource._cloudPhaseG1}"/>
      </div>
      <div class="ui-item">
        <span class="caption">base density start:</span>
        <input type="number" data-field="_cloudBaseDensityStart" data-recalc-shadow-map="true" data-val-min="0" data-val-max="1" step=".01" class="narrow-64" value="${dataSource._cloudBaseDensityStart}"/>
      </div>
      <div class="ui-item">
        <span class="caption">top density start:</span>
        <input type="number" data-field="_cloudTopDensityStart" data-recalc-shadow-map="true" data-val-min="0" data-val-max="1" step=".01" class="narrow-64" value="${dataSource._cloudTopDensityStart}"/>
      </div>
      <div class="ui-item">
        <span class="caption">top density end:</span>
        <input type="number" data-field="_cloudTopDensityEnd" data-recalc-shadow-map="true" data-val-min="0" data-val-max="1" step=".01" class="narrow-64" value="${dataSource._cloudTopDensityEnd}"/>
      </div>
      <div class="ui-item">
        <span class="caption">erosion threshold:</span>
        <input type="number" data-field="_erosionThreshold" data-recalc-shadow-map="true" data-val-min="0" step="0.01" class="narrow-64" value="${dataSource._erosionThreshold}"/>
      </div>
      <div class="ui-item">
        <span class="caption">cloud noise scale:</span>
        <input type="number" data-field="_cloudTexScale" data-recalc-shadow-map="true" data-val-min="0" step=".01" class="narrow-64" value="${dataSource._cloudTexScale}"/>
      </div>

      <div class="section">Weather:</div>
      <div class="ui-item">
        <span class="caption">fluid sim weather:</span>
        <input type="checkbox"
          data-field="_useFluidSimForWeather"
          data-custom-handler="_handleFluidSimWeatherCheck"
          ${dataSource._useFluidSimForWeather ? 'checked' : ''}
        />
      </div>
      <div class="ui-item">
        <span class="caption">ink splat size:</span>
        <input type="number"
          data-field="_fluidSimInkSplatSize"
          data-val-min="0"
          step=".0001"
          class="narrow-64"
          value="${dataSource._fluidSimInkSplatSize}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">force splat size:</span>
        <input type="number"
          data-field="_fluidSimForceSplatSize"
          data-val-min="0"
          step=".0001"
          class="narrow-64"
          value="${dataSource._fluidSimForceSplatSize}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">force mul:</span>
        <input type="number"
          data-field="_fluidSimForceMag"
          data-val-min="0"
          step=".1"
          class="narrow-64"
          value="${dataSource._fluidSimForceMag}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">ink fade factor:</span>
        <input type="number"
          data-field="_fluidSimInkFadeFactor"
          data-val-min="0"
          data-val-max="1"
          step=".001"
          class="narrow-64"
          value="${dataSource._fluidSimInkFadeFactor}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">vorticity mul:</span>
        <input type="number"
          data-field="_fluidSimVorticityMul"
          data-val-min=".0001"
          step=".01"
          class="narrow-64"
          value="${dataSource._fluidSimVorticityMul}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">diffusion iterations:</span>
        <input type="number"
          data-field="_fluidSimDiffusionIterations"
          data-val-min="0"
          step="1"
          class="narrow-64"
          value="${dataSource._fluidSimDiffusionIterations}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">pressure iterations:</span>
        <input type="number"
          data-field="_fluidSimPressureIterations"
          data-val-min="0"
          step="1"
          class="narrow-64"
          value="${dataSource._fluidSimPressureIterations}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">time scale:</span>
        <input type="number"
          data-field="_fluidSimTimeScale"
          data-val-min="0.01"
          step=".01"
          class="narrow-64"
          value="${dataSource._fluidSimTimeScale}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">weather tex scale:</span>
        <input type="number"
          data-field="_weatherTexScale"
          data-recalc-shadow-map="true"
          data-val-min="0"
          step=".01"
          class="narrow-64"
          value="${dataSource._weatherTexScale}"
        />
      </div>
      <div class="ui-item">
        <span class="caption">wind magnitude:</span>
        <input type="number"
          data-field="_windMagnitude"
          data-recalc-shadow-map="true"
          data-val-min=".0"
          step=".01"
          class="narrow-64"
          value="${dataSource._windMagnitude}"
        />
      </div>

      <div class="section">Misc:</div>
      <div class="ui-item">
        <span class="caption">gamma 1/:</span>
        <input type="number" data-field="_gamma" data-val-min="0" data-val-max="10" step=".05" class="narrow-64" value="${dataSource._gamma}"/>
      </div>
      <div class="ui-item">
        <span class="caption">temporal coef:</span>
        <input type="number" data-field="_temporalAlpha" data-val-min="0" data-val-max="1" step=".05" class="narrow-64" value="${dataSource._temporalAlpha}"/>
      </div>
      <div class="ui-item">
        <span class="caption">resolution scale:</span>
        <input type="number" data-field="_resolutionScale" data-val-min=".1" step=".1" data-reset-texture-assets="true" class="narrow-64" value="${dataSource._resolutionScale}"/>
      </div>
      <div class="ui-item">
        <span class="caption">crepuscular rays samples:</span>
        <input type="number" data-field="_crepuscularRaysMarchSamples" data-val-min="1" step="1" class="narrow-64" value="${dataSource._crepuscularRaysMarchSamples}"/>
      </div>
      <div class="ui-item">
        <span class="caption">local shadowmap visible dist:</span>
        <input type="number" data-field="_localShadowsVisibleDistScale" data-recalc-shadow-map="true" data-val-min="0." data-val-max="1." step=".01" class="narrow-64" value="${dataSource._localShadowsVisibleDistScale}"/>
      </div>
      <div class="ui-item">
        <span class="caption">global shadowmap visible dist:</span>
        <input type="number" data-field="_globalShadowsVisibleDistScale" data-recalc-shadow-map="true" data-val-min="0." data-val-max="1." step=".01" class="narrow-64" value="${dataSource._globalShadowsVisibleDistScale}"/>
      </div>
      <div class="ui-item">
        <span class="caption">collision with planet:</span><input type="checkbox" data-field="_checkCollisionWithPlanet" ${dataSource._checkCollisionWithPlanet ? 'checked' : ''}/>
      </div>
      <div class="ui-item">
        <span class="caption">march crepuscular rays:</span><input type="checkbox" data-field="_marchCrepuscularRays" ${dataSource._marchCrepuscularRays ? 'checked' : ''}/>
      </div>
      <div class="ui-item">
        <span class="caption">sample cloud noise:</span><input type="checkbox" data-field="_sampleCloudNoise" data-recalc-shadow-map="true" ${dataSource._sampleCloudNoise ? 'checked' : ''}/>
      </div>
      <div class="ui-item">
        <span class="caption">show debug info:</span><input type="checkbox" data-field="_showDbgInfo" ${dataSource._showDbgInfo ? 'checked' : ''}/>
      </div>
      <div class="ui-item">
        <span class="caption">hide ui when not in focus:</span>
        <input type="checkbox"
          data-field="_hideUIOnBlur"
          data-switch-class="hide-on-blur"
          ${dataSource._hideUIOnBlur ? 'checked' : ''}
        />
      </div>
      <div class="ui-item reset-sim">
        <div class="button">reset</div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  let cp = document.querySelector('.control-panel');
  cp.addEventListener('wheel', (e) => {
    e.stopPropagation();
  });
  cp.addEventListener('keydown', (e) => {
    e.stopPropagation();
  });
  cp.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });

  let inputHandler = (e) => {
    let fieldName = e.target.dataset.field;
    if (dataSource[fieldName] == undefined) {
      console.error('ERR: no fieldName', fieldName);
      return;
    }
    let idx = parseInt(e.target.dataset.idx, 10);
    let resetTextureAssets = e.target.dataset.resetTextureAssets === 'true';
    let recalcShadowMap = e.target.dataset.recalcShadowMap === 'true';
    let recalcSkyShadowMap = e.target.dataset.recalcSkyShadowMap === 'true';
    let minVal = parseFloat(e.target.dataset.valMin);
    let maxVal = parseFloat(e.target.dataset.valMax);
    if (Number.isNaN(minVal)) {
      minVal = -Infinity;
    }
    if (Number.isNaN(maxVal)) {
      maxVal = Infinity;
    }
    let val = Number.parseFloat(e.target.value);
    if (Number.isNaN(val)) {
      val = minVal;
    }
    val = Math.min(Math.max(minVal, val), maxVal);
    if (dataSource[fieldName].length !== undefined) {
      if(Number.isNaN(idx) === false) {
        dataSource[fieldName][idx] = val;
      } else {
        console.error('ERR: no idx was provided for array field', fieldName);
      }
    } else {
      dataSource[fieldName] = val;
    }
    e.target.value = val;
    dataSource._shouldRecalcCloudShadowMap = recalcShadowMap;
    dataSource._shouldRecalcSkyShadowMap = recalcSkyShadowMap;
    if (resetTextureAssets) {
      dataSource._createResolutionDependentAssets();
    }
  };

  let wheelHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    let fieldName = e.target.dataset.field;
    if (dataSource[fieldName] == undefined) {
      console.error('ERR: no fieldName', fieldName);
      return;
    }
    let idx = parseInt(e.target.dataset.idx, 10);
    let resetTextureAssets = e.target.dataset.resetTextureAssets === 'true';
    let recalcShadowMap = e.target.dataset.recalcShadowMap === 'true';
    let recalcSkyShadowMap = e.target.dataset.recalcSkyShadowMap === 'true';
    let val = parseFloat(e.target.value);
    let wheelStep = parseFloat(e.target.step);
    let minVal = parseFloat(e.target.dataset.valMin);
    let maxVal = parseFloat(e.target.dataset.valMax);
    if (Number.isNaN(minVal)) {
      minVal = -Infinity;
    }
    if (Number.isNaN(maxVal)) {
      maxVal = Infinity;
    }
    if (e.wheelDeltaY > 0) {
      val += wheelStep;
    } else {
      val -= wheelStep;
    }
    val = Math.min(Math.max(minVal, val), maxVal);
    if (dataSource[fieldName].length !== undefined) {
      if(Number.isNaN(idx) === false) {
        dataSource[fieldName][idx] = val;
      } else {
        console.error('ERR: no idx was provided for array field', fieldName);
      }
    } else {
      dataSource[fieldName] = val;
    }
    e.target.value = val;
    dataSource._shouldRecalcCloudShadowMap = recalcShadowMap;
    dataSource._shouldRecalcSkyShadowMap = recalcSkyShadowMap;
    if (resetTextureAssets) {
      dataSource._createResolutionDependentAssets();
    }
  };

  let colorInputHandler = (e) => {
    let fieldName = e.target.dataset.field;
    if (dataSource[fieldName] == undefined) {
      console.error('ERR: no fieldName', fieldName);
      return;
    }
    let magnitudeScale = parseFloat(e.target.dataset.magnitudeScale);
    if (Number.isNaN(magnitudeScale)) {
      magnitudeScale = 1.;
    }
    let recalcShadowMap = e.target.dataset.recalcShadowMap === 'true';
    let recalcSkyShadowMap = e.target.dataset.recalcSkyShadowMap === 'true';
    let rgb = dataSource._hexToRGB(e.target.value, true);
    rgb[0] = rgb[0] * magnitudeScale;
    rgb[1] = rgb[1] * magnitudeScale;
    rgb[2] = rgb[2] * magnitudeScale;
    dataSource[fieldName].set(rgb, 0);
    dataSource._shouldRecalcCloudShadowMap = recalcShadowMap;
    dataSource._shouldRecalcSkyShadowMap = recalcSkyShadowMap;
  };

  let checkboxHandler = (e) => {
    let fieldName = e.target.dataset.field;
    if (dataSource[fieldName] == undefined) {
      console.error('ERR: no fieldName', fieldName);
      return;
    }
    let classSwitch = e.target.dataset.switchClass;
    let recalcShadowMap = e.target.dataset.recalcShadowMap === 'true';
    let recalcSkyShadowMap = e.target.dataset.recalcSkyShadowMap === 'true';
    dataSource[fieldName] = e.target.checked;
    dataSource._shouldRecalcCloudShadowMap = recalcShadowMap;
    dataSource._shouldRecalcSkyShadowMap = recalcSkyShadowMap;
    if (e.target.dataset.customHandler) {
      dataSource[e.target.dataset.customHandler](e.target.checked);
    }
    if (e.target.checked) {
      document.querySelector('.control-panel').classList.add(classSwitch);
    } else {
      document.querySelector('.control-panel').classList.remove(classSwitch);
    }
  };

  let i;
  let uiItems = document.querySelectorAll('.ui-item');
  let inputEl;
  for (i = 0; i < uiItems.length; i++) {
    inputEl = uiItems[i].querySelector('input');
    if (!inputEl) {
      continue;
    }
    if (inputEl.type === 'number') {
      inputEl.addEventListener('input', inputHandler);
      inputEl.addEventListener('wheel', wheelHandler);
    } else if (inputEl.type === 'color') {
      inputEl.addEventListener('input', colorInputHandler);
    } else if (inputEl.type === 'checkbox') {
      inputEl.addEventListener('change', checkboxHandler);
    }
  }

  let resetBtn = document.querySelector('.reset-sim');
  resetBtn.addEventListener('click', (e) => {
    dataSource._applySimConfig(DEFAULT_CFG);
  });
}
