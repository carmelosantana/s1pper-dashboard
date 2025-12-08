// Types for Klipper/Moonraker API responses and our internal API
export interface PrinterStatus {
  // Print job information
  print: {
    filename: string | null
    state: 'printing' | 'paused' | 'cancelled' | 'complete' | 'error' | 'ready' | 'offline'
    progress: number // 0-1
    currentLayer: number | null
    totalLayers: number | null
    printTime: number // seconds
    estimatedTimeLeft: number | null
    slicerEstimatedTime: number | null // total estimated time from slicer
    filamentUsed: number // mm
  }
  
  // Temperature information
  temperatures: {
    extruder: {
      actual: number
      target: number
      power: number
    }
    bed: {
      actual: number
      target: number
      power: number
    }
  }
  
  // Movement and positioning
  position: {
    x: number
    y: number
    z: number
    e: number
  }
  
  // Speeds and settings
  speeds: {
    current: number
    factor: number
  }
  
  // System state
  system: {
    klippyState: string
    klippyMessage: string
    homedAxes: string
  }
  
  // File information
  file: {
    name: string | null
    size: number
    position: number
  }
}

export interface TemperatureHistory {
  extruder: {
    temperatures: number[]
    targets: number[]
    powers: number[]
  }
  bed: {
    temperatures: number[]
    targets: number[]
    powers: number[]
  }
  timestamps: string[] // formatted time strings for chart display
}

// Raw Klipper API response types
export interface KlipperPrinterObjects {
  extruder: {
    temperature: number
    target: number
    power: number
    can_extrude: boolean
    pressure_advance: number
    smooth_time: number
  }
  heater_bed: {
    temperature: number
    target: number
    power: number
  }
  print_stats: {
    filename: string
    total_duration: number
    print_duration: number
    filament_used: number
    state: string
    message: string
    info: {
      total_layer: number | null
      current_layer: number | null
    }
  }
  virtual_sdcard: {
    file_path: string | null
    progress: number
    is_active: boolean
    file_position: number
    file_size: number
  }
  webhooks: {
    state: string
    state_message: string
  }
  toolhead?: {
    homed_axes: string
    position: number[]
    print_time: number
    estimated_print_time: number
  }
  gcode_move?: {
    speed: number
    speed_factor: number
    position: number[]
  }
}

export interface KlipperResponse {
  result: {
    eventtime: number
    status: KlipperPrinterObjects
  }
}

export interface KlipperTemperatureStore {
  result: {
    extruder: {
      temperatures: number[]
      targets: number[]
      powers: number[]
    }
    heater_bed: {
      temperatures: number[]
      targets: number[]
      powers: number[]
    }
  }
}

export interface KlipperInfoResponse {
  result: {
    state: string
    state_message: string
    hostname: string
    software_version: string
    cpu_info: string
  }
}

// Lifetime statistics interface
export interface LifetimeStats {
  totalJobs: number
  totalTime: number // total time including pauses (seconds)
  totalPrintTime: number // actual printing time (seconds)
  totalFilamentUsed: number // filament used (mm)
  longestJob: number // longest job duration (seconds)
  longestPrint: number // longest print duration (seconds)
}

// Moonraker totals API response
export interface MoonrakerTotalsResponse {
  result: {
    job_totals: {
      total_jobs: number
      total_time: number
      total_print_time: number
      total_filament_used: number
      longest_job: number
      longest_print: number
    }
    auxiliary_totals: Array<{
      provider: string
      field: string
      maximum: number | null
      total: number | null
    }>
  }
}

// Error response type
export interface ApiError {
  error: string
  details?: string
}

// Configuration file type
export interface ConfigFile {
  name: string
  description: string
  language: 'gcode' | 'python'
  content: string
}
// Webcam configuration from Moonraker
export interface WebcamConfig {
  uid: string
  name: string
  location: string
  service: string
  enabled: boolean
  icon: string
  aspect_ratio: string
  target_fps: number
  target_fps_idle: number
  stream_url: string
  snapshot_url: string
  flip_horizontal: boolean
  flip_vertical: boolean
  rotation: number
  source: string
  extra_data: Record<string, any>
}

// Moonraker webcam list response
export interface MoonrakerWebcamListResponse {
  result: {
    webcams: WebcamConfig[]
  }
}

// Camera settings stored in our database
export interface CameraSettings {
  id: number
  uid: string
  name: string
  enabled: boolean
  display_order: number
  created_at: string
  updated_at: string
}

// Thumbnail information from Moonraker
export interface ThumbnailInfo {
  width: number
  height: number
  size: number
  relative_path: string
}

// GCode file metadata from Moonraker
export interface GcodeMetadata {
  filename: string
  size: number
  modified: number
  uuid?: string
  slicer?: string
  slicer_version?: string
  gcode_start_byte?: number
  gcode_end_byte?: number
  object_height?: number
  estimated_time?: number
  nozzle_diameter?: number
  layer_height?: number
  first_layer_height?: number
  first_layer_extr_temp?: number
  first_layer_bed_temp?: number
  chamber_temp?: number
  filament_name?: string
  filament_type?: string
  filament_total?: number // mm
  filament_weight_total?: number // grams
  thumbnails?: ThumbnailInfo[]
  print_start_time?: number
  job_id?: string
}
