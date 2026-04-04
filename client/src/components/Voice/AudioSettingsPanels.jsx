import React from 'react';
import {
  AudioSettingsFooterView,
  AudioSettingsInputPanelView,
  AudioSettingsOutputPanelView,
  AudioSettingsProcessingPanelView,
  AudioSettingsSensitivityPanelView,
} from './AudioSettingsPanelViews.jsx';

export function AudioSettingsInputPanel({
  labelStyle,
  selectStyle,
  selectedInput = '',
  inputDevices = [],
  handleInputChange = () => {},
  testing = false,
  testStarting = false,
  startTest = () => {},
  stopTest = () => {},
  meterFillRef,
  meterValueRef,
  meterStatusRef,
  activeMonitorProfile = { hint: '' },
  lowLatencyEnabled = false,
  noiseSuppression = false,
  noiseSuppressionFallbackReason = null,
  testDiagnostics = null,
} = {}) {
  return <AudioSettingsInputPanelView {...{
    labelStyle,
    selectStyle,
    selectedInput,
    inputDevices,
    handleInputChange,
    testing,
    testStarting,
    startTest,
    stopTest,
    meterFillRef,
    meterValueRef,
    meterStatusRef,
    activeMonitorProfile,
    lowLatencyEnabled,
    noiseSuppression,
    noiseSuppressionFallbackReason,
    testDiagnostics,
  }} />;
}

export function AudioSettingsSensitivityPanel({
  labelStyle,
  lowLatencyEnabled = false,
  micGain = 3,
  onMicGainChange = () => {},
} = {}) {
  return <AudioSettingsSensitivityPanelView {...{
    labelStyle,
    lowLatencyEnabled,
    micGain,
    onMicGainChange,
  }} />;
}

export function AudioSettingsProcessingPanel({
  labelStyle,
  lowLatencyEnabled = false,
  preferredSuppressionImplementation = { detail: '' },
  appleHardwareProcessingGuidance = null,
  handleSelectProcessingMode = () => {},
  noiseSuppressionFallbackReason = null,
} = {}) {
  return <AudioSettingsProcessingPanelView {...{
    labelStyle,
    lowLatencyEnabled,
    preferredSuppressionImplementation,
    appleHardwareProcessingGuidance,
    handleSelectProcessingMode,
    noiseSuppressionFallbackReason,
  }} />;
}

export function AudioSettingsOutputPanel({
  labelStyle,
  selectStyle,
  selectedOutput = '',
  outputDevices = [],
  handleOutputChange = () => {},
  activeMonitorProfile = { hint: '' },
} = {}) {
  return <AudioSettingsOutputPanelView {...{
    labelStyle,
    selectStyle,
    selectedOutput,
    outputDevices,
    handleOutputChange,
    activeMonitorProfile,
  }} />;
}

export function AudioSettingsFooter({
  handleClose = () => {},
} = {}) {
  return <AudioSettingsFooterView {...{ handleClose }} />;
}
