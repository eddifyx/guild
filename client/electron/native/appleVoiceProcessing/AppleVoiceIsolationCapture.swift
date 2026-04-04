import AudioToolbox
import AVFoundation
import Foundation

enum CaptureError: LocalizedError {
  case authorizationDenied
  case componentUnavailable
  case componentCreationFailed(OSStatus)
  case propertySetFailed(String, OSStatus)
  case initializeFailed(OSStatus)
  case startFailed(OSStatus)

  var errorDescription: String? {
    switch self {
    case .authorizationDenied:
      return "Apple voice processing does not have microphone permission."
    case .componentUnavailable:
      return "VoiceProcessingIO is unavailable on this Mac."
    case let .componentCreationFailed(status):
      return "Apple voice processing could not create the audio unit (OSStatus \(status))."
    case let .propertySetFailed(label, status):
      return "Apple voice processing could not configure \(label) (OSStatus \(status))."
    case let .initializeFailed(status):
      return "Apple voice processing could not initialize the audio unit (OSStatus \(status))."
    case let .startFailed(status):
      return "Apple voice processing could not start the audio unit (OSStatus \(status))."
    }
  }
}

final class VoiceIsolationCapture {
  private struct AudioUnitConfiguration {
    let id: String
    let enableOutputBus: Bool
  }

  private var audioUnit: AudioUnit?
  private let outputFile = FileHandle.standardOutput
  private let statusFile = FileHandle.standardError
  private let stopSemaphore = DispatchSemaphore(value: 0)
  private let sampleRate: Double = 48_000
  private let channels: UInt32 = 1
  private let frameSamples: UInt32 = 480
  private let minimumOtherAudioDuckingLevel = AUVoiceIOOtherAudioDuckingLevel(rawValue: 10)!
  private var pendingBuffer = Data()
  private var activeConfigurationId = "capture-only"

  func run() throws {
    switch AVCaptureDevice.authorizationStatus(for: .audio) {
    case .authorized:
      break
    case .notDetermined:
      let permissionSemaphore = DispatchSemaphore(value: 0)
      var granted = false
      AVCaptureDevice.requestAccess(for: .audio) { allowed in
        granted = allowed
        permissionSemaphore.signal()
      }
      permissionSemaphore.wait()
      if !granted {
        throw CaptureError.authorizationDenied
      }
    default:
      throw CaptureError.authorizationDenied
    }

    try setupAudioUnit()

    emitStatus(type: "ready", payload: [
      "sampleRate": Int(sampleRate),
      "channels": Int(channels),
      "frameSamples": Int(frameSamples),
      "voiceProcessingEnabled": true,
      "agcEnabled": true,
      "bypassVoiceProcessing": false,
      "advancedOtherAudioDucking": false,
      "otherAudioDuckingLevel": Int(minimumOtherAudioDuckingLevel.rawValue),
      "configuration": activeConfigurationId,
    ])

    let signalSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
    signal(SIGTERM, SIG_IGN)
    signalSource.setEventHandler { [weak self] in
      self?.stop()
    }
    signalSource.resume()

    let interruptSource = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
    signal(SIGINT, SIG_IGN)
    interruptSource.setEventHandler { [weak self] in
      self?.stop()
    }
    interruptSource.resume()

    stopSemaphore.wait()
  }

  private func setupAudioUnit() throws {
    let configurations = [
      AudioUnitConfiguration(id: "capture-only", enableOutputBus: false),
      AudioUnitConfiguration(id: "full-duplex", enableOutputBus: true),
    ]

    var lastError: Error?

    for (index, configuration) in configurations.enumerated() {
      do {
        try setupAudioUnit(using: configuration)
        activeConfigurationId = configuration.id
        return
      } catch {
        lastError = error
        teardownAudioUnit()

        let shouldRetry = index < configurations.count - 1 && shouldRetryWithCompatibilityConfiguration(error)
        if !shouldRetry {
          break
        }
      }
    }

    throw lastError ?? CaptureError.componentUnavailable
  }

  private func setupAudioUnit(using configuration: AudioUnitConfiguration) throws {
    var description = AudioComponentDescription(
      componentType: kAudioUnitType_Output,
      componentSubType: kAudioUnitSubType_VoiceProcessingIO,
      componentManufacturer: kAudioUnitManufacturer_Apple,
      componentFlags: 0,
      componentFlagsMask: 0
    )

    guard let component = AudioComponentFindNext(nil, &description) else {
      throw CaptureError.componentUnavailable
    }

    var unit: AudioUnit?
    let creationStatus = AudioComponentInstanceNew(component, &unit)
    guard creationStatus == noErr, let unit else {
      throw CaptureError.componentCreationFailed(creationStatus)
    }
    audioUnit = unit

    var enable: UInt32 = 1
    try setProperty(
      unit,
      id: kAudioOutputUnitProperty_EnableIO,
      scope: kAudioUnitScope_Input,
      element: 1,
      value: &enable,
      valueSize: UInt32(MemoryLayout<UInt32>.size),
      label: "microphone input"
    )

    var outputBusEnabled: UInt32 = configuration.enableOutputBus ? 1 : 0
    try setProperty(
      unit,
      id: kAudioOutputUnitProperty_EnableIO,
      scope: kAudioUnitScope_Output,
      element: 0,
      value: &outputBusEnabled,
      valueSize: UInt32(MemoryLayout<UInt32>.size),
      label: "output bus"
    )

    var bypassVoiceProcessing: UInt32 = 0
    try setProperty(
      unit,
      id: kAUVoiceIOProperty_BypassVoiceProcessing,
      scope: kAudioUnitScope_Global,
      element: 0,
      value: &bypassVoiceProcessing,
      valueSize: UInt32(MemoryLayout<UInt32>.size),
      label: "voice processing bypass"
    )

    var enableAgc: UInt32 = 1
    try setProperty(
      unit,
      id: kAUVoiceIOProperty_VoiceProcessingEnableAGC,
      scope: kAudioUnitScope_Global,
      element: 0,
      value: &enableAgc,
      valueSize: UInt32(MemoryLayout<UInt32>.size),
      label: "voice processing AGC"
    )

    var duckingConfiguration = AUVoiceIOOtherAudioDuckingConfiguration(
      mEnableAdvancedDucking: false,
      mDuckingLevel: minimumOtherAudioDuckingLevel
    )
    try setProperty(
      unit,
      id: kAUVoiceIOProperty_OtherAudioDuckingConfiguration,
      scope: kAudioUnitScope_Global,
      element: 0,
      value: &duckingConfiguration,
      valueSize: UInt32(MemoryLayout<AUVoiceIOOtherAudioDuckingConfiguration>.size),
      label: "other audio ducking"
    )

    var streamFormat = AudioStreamBasicDescription(
      mSampleRate: sampleRate,
      mFormatID: kAudioFormatLinearPCM,
      mFormatFlags: kLinearPCMFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked,
      mBytesPerPacket: 2 * channels,
      mFramesPerPacket: 1,
      mBytesPerFrame: 2 * channels,
      mChannelsPerFrame: channels,
      mBitsPerChannel: 16,
      mReserved: 0
    )

    try setProperty(
      unit,
      id: kAudioUnitProperty_StreamFormat,
      scope: kAudioUnitScope_Output,
      element: 1,
      value: &streamFormat,
      valueSize: UInt32(MemoryLayout<AudioStreamBasicDescription>.size),
      label: "input stream format"
    )

    if configuration.enableOutputBus {
      try setProperty(
        unit,
        id: kAudioUnitProperty_StreamFormat,
        scope: kAudioUnitScope_Input,
        element: 0,
        value: &streamFormat,
        valueSize: UInt32(MemoryLayout<AudioStreamBasicDescription>.size),
        label: "output stream format"
      )
    }

    var callback = AURenderCallbackStruct(
      inputProc: inputRenderCallback,
      inputProcRefCon: Unmanaged.passUnretained(self).toOpaque()
    )
    try setProperty(
      unit,
      id: kAudioOutputUnitProperty_SetInputCallback,
      scope: kAudioUnitScope_Global,
      element: 1,
      value: &callback,
      valueSize: UInt32(MemoryLayout<AURenderCallbackStruct>.size),
      label: "input callback"
    )

    if configuration.enableOutputBus {
      var renderCallback = AURenderCallbackStruct(
        inputProc: outputRenderCallback,
        inputProcRefCon: Unmanaged.passUnretained(self).toOpaque()
      )
      try setProperty(
        unit,
        id: kAudioUnitProperty_SetRenderCallback,
        scope: kAudioUnitScope_Global,
        element: 0,
        value: &renderCallback,
        valueSize: UInt32(MemoryLayout<AURenderCallbackStruct>.size),
        label: "output render callback"
      )
    }

    let initializeStatus = AudioUnitInitialize(unit)
    guard initializeStatus == noErr else {
      throw CaptureError.initializeFailed(initializeStatus)
    }

    let startStatus = AudioOutputUnitStart(unit)
    guard startStatus == noErr else {
      throw CaptureError.startFailed(startStatus)
    }
  }

  private func shouldRetryWithCompatibilityConfiguration(_ error: Error) -> Bool {
    switch error {
    case let CaptureError.propertySetFailed(label, _):
      return label == "output bus" || label == "input stream format" || label == "input callback"
    case CaptureError.initializeFailed:
      return true
    case CaptureError.startFailed:
      return true
    default:
      return false
    }
  }

  private func setProperty<T>(
    _ unit: AudioUnit,
    id: AudioUnitPropertyID,
    scope: AudioUnitScope,
    element: AudioUnitElement,
    value: inout T,
    valueSize: UInt32,
    label: String
  ) throws {
    let status = AudioUnitSetProperty(unit, id, scope, element, &value, valueSize)
    guard status == noErr else {
      throw CaptureError.propertySetFailed(label, status)
    }
  }

  fileprivate func handleInput(
    ioActionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
    timeStamp: UnsafePointer<AudioTimeStamp>,
    busNumber: UInt32,
    numberFrames: UInt32
  ) -> OSStatus {
    guard let unit = audioUnit else {
      return noErr
    }

    let byteCount = Int(numberFrames * channels * 2)
    var localBuffer = [Int16](repeating: 0, count: Int(numberFrames * channels))

    return localBuffer.withUnsafeMutableBytes { bytes in
      var audioBufferList = AudioBufferList(
        mNumberBuffers: 1,
        mBuffers: AudioBuffer(
          mNumberChannels: channels,
          mDataByteSize: UInt32(byteCount),
          mData: bytes.baseAddress
        )
      )

      let status = AudioUnitRender(
        unit,
        ioActionFlags,
        timeStamp,
        1,
        numberFrames,
        &audioBufferList
      )

      guard status == noErr else {
        emitStatus(type: "error", payload: ["message": "AudioUnitRender failed (\(status))."])
        return status
      }

      pendingBuffer.append(contentsOf: bytes.bindMemory(to: UInt8.self))
      flushPendingFrames()
      return noErr
    }
  }

  fileprivate func handleOutput(
    ioData: UnsafeMutablePointer<AudioBufferList>?
  ) -> OSStatus {
    guard let ioData else {
      return noErr
    }

    let buffers = UnsafeMutableAudioBufferListPointer(ioData)
    for buffer in buffers {
      guard let data = buffer.mData else {
        continue
      }
      memset(data, 0, Int(buffer.mDataByteSize))
    }
    return noErr
  }

  private func flushPendingFrames() {
    let targetFrameBytes = Int(frameSamples * channels * 2)
    while pendingBuffer.count >= targetFrameBytes {
      let frame = pendingBuffer.prefix(targetFrameBytes)
      pendingBuffer.removeFirst(targetFrameBytes)

      do {
        try outputFile.write(contentsOf: frame)
      } catch {
        emitStatus(type: "error", payload: ["message": error.localizedDescription])
      }
    }
  }

  private func emitStatus(type: String, payload: [String: Any]) {
    var envelope = payload
    envelope["type"] = type

    guard let data = try? JSONSerialization.data(withJSONObject: envelope, options: []),
          let line = String(data: data, encoding: .utf8) else {
      return
    }

    try? statusFile.write(contentsOf: Data((line + "\n").utf8))
  }

  private func stop() {
    teardownAudioUnit()
    stopSemaphore.signal()
  }

  private func teardownAudioUnit() {
    if let unit = audioUnit {
      AudioOutputUnitStop(unit)
      AudioUnitUninitialize(unit)
      AudioComponentInstanceDispose(unit)
      audioUnit = nil
    }
  }
}

private func inputRenderCallback(
  inRefCon: UnsafeMutableRawPointer,
  ioActionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
  inTimeStamp: UnsafePointer<AudioTimeStamp>,
  inBusNumber: UInt32,
  inNumberFrames: UInt32,
  ioData: UnsafeMutablePointer<AudioBufferList>?
) -> OSStatus {
  let capture = Unmanaged<VoiceIsolationCapture>.fromOpaque(inRefCon).takeUnretainedValue()
  return capture.handleInput(
    ioActionFlags: ioActionFlags,
    timeStamp: inTimeStamp,
    busNumber: inBusNumber,
    numberFrames: inNumberFrames
  )
}

private func outputRenderCallback(
  inRefCon: UnsafeMutableRawPointer,
  ioActionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
  inTimeStamp: UnsafePointer<AudioTimeStamp>,
  inBusNumber: UInt32,
  inNumberFrames: UInt32,
  ioData: UnsafeMutablePointer<AudioBufferList>?
) -> OSStatus {
  let capture = Unmanaged<VoiceIsolationCapture>.fromOpaque(inRefCon).takeUnretainedValue()
  return capture.handleOutput(ioData: ioData)
}

do {
  let capture = VoiceIsolationCapture()
  try capture.run()
} catch {
  let payload = [
    "type": "fatal",
    "message": error.localizedDescription,
  ]
  if let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
     let line = String(data: data, encoding: .utf8) {
    try? FileHandle.standardError.write(contentsOf: Data((line + "\n").utf8))
  }
  exit(1)
}
